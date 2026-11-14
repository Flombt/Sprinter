import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { backend } from './env';
import { accountKv } from './kv';
import { AppConfigStore, updateRequired, type AppConfig, type FlagKey } from './configStore';

export const appConfig = new AppConfigStore({
  backend,
  kv: accountKv,
  fetch: (input, init) => fetch(input, init),
});

let foregroundListener: { remove(): void } | null = null;
/** Lecture au lancement, jamais bloquante ; relecture opportuniste au retour au premier plan. */
export function startAppConfig() {
  if (!appConfig.enabled) return;
  void appConfig.initialize();
  foregroundListener ??= AppState.addEventListener('change', (state) => {
    if (state === 'active') void appConfig.refreshIfStale();
  });
}

export const useAppConfig = (): AppConfig => useSyncExternalStore(appConfig.subscribe, appConfig.getSnapshot, appConfig.getSnapshot);
export const useFlag = (key: FlagKey): boolean => useAppConfig().flags[key];
export const installedVersion = (): string | null => Constants.expoConfig?.version ?? null;
export const useUpdateRequired = (): boolean => updateRequired(useAppConfig(), Platform.OS, installedVersion());
