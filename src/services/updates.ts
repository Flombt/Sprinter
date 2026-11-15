/* eslint-disable @typescript-eslint/no-require-imports -- Optional native modules are loaded only in store release clients. */
import Constants from 'expo-constants';
import { AppState } from 'react-native';
import { IS_EXPO_GO, IS_SIDELOAD_BUILD } from './capabilities';
import { session } from './session';
import { UpdateManager, type UpdateInfo } from './updateManager';

type UpdatesModule = typeof import('expo-updates');
let native: UpdatesModule | null = null;
if (!__DEV__ && !IS_EXPO_GO && !IS_SIDELOAD_BUILD) {
  try {
    native = require('expo-updates') as UpdatesModule;
  } catch {
    console.warn('Sprinter OTA : module indisponible.');
  }
}

let started = false;
let online = false;
export const updateManager = new UpdateManager({
  enabled: () => native?.isEnabled === true,
  safety: () => ({
    ...session.getSnapshot(),
    foreground: started && AppState.currentState === 'active',
    online,
  }),
  check: () => native!.checkForUpdateAsync(),
  fetch: () => native!.fetchUpdateAsync(),
  report: (code) => console.warn(`Sprinter OTA : ${code}.`),
});

export function getUpdateInfo(): UpdateInfo {
  return {
    version: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '—',
    build: Constants.nativeBuildVersion,
    enabled: native?.isEnabled === true,
    channel: native?.channel ?? null,
    runtime: native?.runtimeVersion ?? null,
    updateId: native?.updateId ?? null,
    createdAt: native?.createdAt?.toISOString() ?? null,
    embedded: native?.isEmbeddedLaunch ?? true,
    emergency: native?.isEmergencyLaunch ?? false,
  };
}

/** Non-blocking, debounced triggers; no background polling and no automatic reload. */
export function startUpdates() {
  if (started || !native?.isEnabled) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void updateManager.request();
    }, 1000);
  };
  const app = AppState.addEventListener('change', schedule);
  let previous = '';
  const unsubscribeSession = session.subscribe(() => {
    const state = session.getSnapshot();
    const key = `${state.ready}:${state.loading}:${state.busy}:${!!state.run}:${!!state.recoveryBlocked}`;
    if (key !== previous) {
      previous = key;
      schedule();
    }
  });
  let unsubscribeNetwork: (() => void) | undefined;
  try {
    const NetInfo = (
      require('@react-native-community/netinfo') as typeof import('@react-native-community/netinfo')
    ).default;
    unsubscribeNetwork = NetInfo.addEventListener((state) => {
      online =
        state.isConnected === true &&
        state.isInternetReachable !== false &&
        !state.details?.isConnectionExpensive;
      schedule();
    });
  } catch {
    online = false;
  }
  schedule();
  return () => {
    started = false;
    online = false;
    if (timer) clearTimeout(timer);
    app.remove();
    unsubscribeSession();
    unsubscribeNetwork?.();
  };
}
