import Constants from 'expo-constants';
import { UpdateManager, type UpdateInfo } from './updateManager';

// Web loads its own deployed bundle; EAS Update is exclusively native.
export const updateManager = new UpdateManager({
  enabled: () => false,
  safety: () => ({ ready: false, loading: false, busy: false, run: null, foreground: false, online: false }),
  check: async () => ({ isAvailable: false }),
  fetch: async () => ({ isNew: false }),
  report: () => {},
});
export const startUpdates = () => undefined;
export const getUpdateInfo = (): UpdateInfo => ({
  version: Constants.expoConfig?.version ?? '—',
  build: null,
  enabled: false,
  channel: null,
  runtime: null,
  updateId: null,
  createdAt: null,
  embedded: true,
  emergency: false,
});
