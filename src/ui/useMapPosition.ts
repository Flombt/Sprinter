import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import { validCoordinate } from '../routes/geometry';
import type { RouteCoordinate } from '../routes/types';

type Preview = { position?: RouteCoordinate; status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable' };

function suitablePosition(value: Location.LocationObject | null, maximumAge: number): RouteCoordinate | undefined {
  if (!value || !validCoordinate(value.coords)) return;
  const age = Date.now() - value.timestamp;
  const { latitude, longitude, accuracy } = value.coords;
  if (age >= -1000 && age <= maximumAge && accuracy !== null && accuracy >= 0 && accuracy <= 150) return { latitude, longitude };
}

/** One foreground preview fix. The session exclusively records the route. */
export function useMapPosition(enabled: boolean) {
  const [preview, setPreview] = useState<Preview>({ status: 'idle' });
  const pending = useRef<AbortController | null>(null);

  const locate = useCallback(async (ask: boolean) => {
    if (!enabled || pending.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    pending.current = controller;
    try {
      // On web, asking for the position must be an explicit user action.
      if (!ask && Platform.OS === 'web') return;
      const current = await Location.getForegroundPermissionsAsync();
      if (signal.aborted) return;
      const permission = !current.granted && ask && current.canAskAgain ? await Location.requestForegroundPermissionsAsync() : current;
      if (signal.aborted) return;
      if (!permission.granted) {
        setPreview({ status: permission.status === 'denied' ? 'denied' : 'idle' });
        return;
      }
      if (permission.ios?.accuracy === 'reduced' || !await Location.hasServicesEnabledAsync()) {
        if (!signal.aborted) setPreview({ status: 'unavailable' });
        return;
      }
      if (signal.aborted) return;
      setPreview(previous => ({ ...previous, status: 'locating' }));
      const last = Platform.OS !== 'web'
        ? suitablePosition(await Location.getLastKnownPositionAsync({ maxAge: 15000, requiredAccuracy: 150 }).catch(() => null), 15000)
        : undefined;
      if (signal.aborted) return;
      if (last) setPreview({ position: last, status: 'locating' });
      await new Promise<void>(resolve => {
        let subscription: Location.LocationSubscription | undefined;
        let settled = false;
        const finish = (position?: RouteCoordinate) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          signal.removeEventListener('abort', cancel);
          subscription?.remove();
          if (!signal.aborted) setPreview({ position: position ?? last, status: position || last ? 'ready' : 'unavailable' });
          resolve();
        };
        const cancel = () => finish();
        const timeout = setTimeout(cancel, 10000);
        signal.addEventListener('abort', cancel, { once: true });
        void Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 1000 }, value => {
          const position = suitablePosition(value, 10000);
          if (position) finish(position);
        }, cancel).then(value => {
          subscription = value;
          if (settled) value.remove();
        }).catch(cancel);
      });
    } catch {
      if (!signal.aborted) setPreview({ status: 'unavailable' });
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    const stop = () => { pending.current?.abort(); pending.current = null; };
    if (!enabled) { stop(); return; }
    void locate(false);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') stop();
      if (state === 'active') void locate(false);
    });
    return () => { stop(); subscription.remove(); };
  }, [enabled, locate]);

  return { ...preview, locate };
}
