import type { ApplePersistence } from './persistence';
import { defaultApplePreferences } from './types';
export const appleDatabaseDirectory = '';
export async function openApplePersistence(): Promise<ApplePersistence> {
  // Native-only preferences and health data are never persisted by the web preview.
  return { async load() { return defaultApplePreferences(); }, async save() {} };
}
