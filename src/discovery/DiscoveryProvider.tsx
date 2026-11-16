import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  parisDay,
  readDiscoveryItem,
  type DiscoveryItem,
} from '../../supabase/functions/_shared/discovery-model';
import { backend } from '../account/env';
import { accountKv } from '../account/kv';
import { account } from '../account/account';
import { getSupabase } from '../account/supabaseClient';
import { session } from '../services/session';
import { haptic } from '../ui/haptics';
import editorial from './catalogue.json';
import { market, mergeCatalogue, remaining } from './catalog';
import { fetchDiscoveryFeed, feedTtl, parseCachedFeed, type DiscoveryFeed } from './feed';
import { emptyPreferences, updateSaved, type DiscoveryPreferences } from './preferences';
import { discoveryStorage } from './storage';

const bundle = editorial.map(readDiscoveryItem).filter((item): item is DiscoveryItem => item !== null);
const cacheKey = `discovery:v1:catalog:${market.id}`;
const emptyEntriesMap = new Map<string, DiscoveryItem | null>();
const isTracking = () => {
  const state = session.getSnapshot();
  return !!state.run || state.busy;
};

function useDiscoveryState(userId: string, visible: boolean, blocked: boolean) {
  const [now, setNow] = useState(Date.now);
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background');
  const [offline, setOffline] = useState(false);
  const [booted, setBooted] = useState(false);
  const [prefs, setPrefs] = useState(emptyPreferences);
  const [canSave, setCanSave] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  const [feed, setFeed] = useState<DiscoveryFeed>();
  const [syncing, setSyncing] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const [retry, setRetry] = useState(0);
  const lastFetch = useRef(0);
  const attempt = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    setForeground(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const appState = AppState.addEventListener('change', (s) => {
      setForeground(s === 'active');
      if (s === 'active') setNow(Date.now());
    });
    const stopNetwork = NetInfo.addEventListener((network) => {
      setOffline(network.isConnected === false || network.isInternetReachable === false);
    });
    return () => {
      appState.remove();
      stopNetwork();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !foreground) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [foreground, visible]);

  useEffect(() => {
    if (!visible || booted) return;
    let cancelled = false;
    void Promise.allSettled([
      discoveryStorage.load(userId),
      accountKv.get(cacheKey).then((raw) => (raw ? parseCachedFeed(raw, market.id, Date.now()) : undefined)),
    ]).then(([preferences, cache]) => {
      if (cancelled) return;
      if (preferences.status === 'fulfilled') {
        setPrefs(preferences.value);
        setCanSave(true);
      } else setStorageError('Tes favoris et préférences locales sont indisponibles.');
      if (cache.status === 'fulfilled' && cache.value) {
        setFeed(cache.value);
        lastFetch.current = cache.value.loadedAt;
      }
      setBooted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [booted, userId, visible]);

  const refresh = useCallback(() => {
    lastFetch.current = 0;
    attempt.current = 0;
    setRetry((value) => value + 1);
  }, []);

  const mayFetch = booted && visible && foreground && !offline && !blocked;
  useEffect(() => {
    if (!backend || !mayFetch) return;
    const configuration = backend;
    let operation: AbortController | undefined;
    let stopped = false;
    const refreshIfDue = () => {
      const time = Date.now();
      if (operation || isTracking() || time - lastFetch.current < feedTtl || time - attempt.current < 300_000)
        return;
      const controller = new AbortController();
      operation = controller;
      attempt.current = time;
      setSyncing(true);
      setFeedError(false);
      const watchdog = setTimeout(() => controller.abort(), 12_000);
      void (async () => {
        const client = getSupabase();
        const result = await client?.auth.getSession();
        const auth = result?.data.session;
        if (!auth || auth.user.id !== userId || account.getSnapshot().userId !== userId)
          throw new Error('Session indisponible.');
        return fetchDiscoveryFeed(configuration, market.id, auth.access_token, controller.signal);
      })()
        .then(async (snapshot) => {
          if (stopped || controller.signal.aborted || isTracking()) return;
          lastFetch.current = snapshot.loadedAt;
          setFeed(snapshot);
          await accountKv.set(cacheKey, JSON.stringify(snapshot)).catch(() => undefined);
        })
        .catch(() => {
          if (!stopped && !isTracking()) setFeedError(true);
        })
        .finally(() => {
          clearTimeout(watchdog);
          operation = undefined;
          if (!stopped) setSyncing(false);
        });
    };
    const timer = setInterval(refreshIfDue, 60_000);
    const stopSession = session.subscribe(() => {
      if (isTracking()) operation?.abort();
    });
    refreshIfDue();
    return () => {
      stopped = true;
      clearInterval(timer);
      stopSession();
      operation?.abort();
      setSyncing(false);
    };
  }, [mayFetch, retry, userId]);

  const persist = useCallback(
    async (apply: (old: DiscoveryPreferences) => DiscoveryPreferences) => {
      if (!canSave || account.getSnapshot().userId !== userId) return false;
      try {
        const next = await discoveryStorage.change(userId, apply);
        if (account.getSnapshot().userId !== userId) return false;
        setPrefs(next);
        setStorageError(undefined);
        return true;
      } catch (error) {
        setStorageError(
          error instanceof Error && error.message.includes('150 fiches')
            ? error.message
            : 'Enregistrement local impossible. Réessaie.',
        );
        return false;
      }
    },
    [canSave, userId],
  );

  const toggleFavorite = useCallback(
    async (item: DiscoveryItem) => {
      const saved = await persist((old) =>
        updateSaved(old, item, { favorite: !old.saves.find((save) => save.item.id === item.id)?.favorite }),
      );
      if (saved) haptic.select();
      return saved;
    },
    [persist],
  );

  const setGoal = useCallback(
    (item: DiscoveryItem, distanceKm?: number) => {
      if (
        distanceKm !== undefined &&
        (isTracking() ||
          item.kind !== 'race' ||
          !remaining(item, Date.now()) ||
          !item.distancesKm?.includes(distanceKm))
      )
        return;
      return persist((old) =>
        updateSaved(old, item, {
          goal: distanceKm === undefined ? undefined : { distanceKm, addedOn: parisDay(Date.now()) },
        }),
      );
    },
    [persist],
  );

  const entries = useMemo(
    () => (feed ? new Map(feed.entries.map(({ id, item }) => [id, item])) : emptyEntriesMap),
    [feed],
  );
  const items = useMemo(() => mergeCatalogue(bundle, entries), [entries]);
  return {
    items,
    entries,
    now,
    booted,
    prefs,
    canSave,
    storageError,
    persist,
    toggleFavorite,
    setGoal,
    loadedAt: feed?.loadedAt,
    syncing,
    offline,
    feedError,
    refresh,
    blocked,
    refreshAvailable: !!backend && !offline && !blocked,
  };
}

const DiscoveryContext = createContext<ReturnType<typeof useDiscoveryState> | null>(null);

export function DiscoveryProvider({
  userId,
  visible,
  blocked,
  children,
}: {
  userId: string;
  visible: boolean;
  blocked: boolean;
  children: ReactNode;
}) {
  const state = useDiscoveryState(userId, visible, blocked);
  return <DiscoveryContext.Provider value={state}>{children}</DiscoveryContext.Provider>;
}

export function useDiscovery() {
  const state = useContext(DiscoveryContext);
  if (!state) throw new Error('Découvrir doit être monté après l’ouverture du compte.');
  return state;
}
