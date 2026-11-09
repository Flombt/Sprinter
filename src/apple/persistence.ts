import * as SQLite from 'expo-sqlite';
import { defaultApplePreferences, ApplePreferences } from './types';
import { validHealthUUID } from './mapping';
export interface ApplePersistence { load(): Promise<ApplePreferences>; save(data: ApplePreferences): Promise<void> }
export function parseApplePreferences(value: unknown): ApplePreferences {
  const data = value as ApplePreferences;
  if (!data || data.version !== 1 || typeof data.autoWrite !== 'boolean' || typeof data.readRequested !== 'boolean' || typeof data.liveEnabled !== 'boolean' || !Array.isArray(data.receipts) || data.receipts.length > 100000 ||
      !data.receipts.every(r => r && typeof r.runId === 'string' && r.runId.length > 0 && r.runId.length <= 250 && validHealthUUID(r.uuid) && Number.isFinite(r.syncedAt))) throw new Error('État des intégrations Apple illisible ou plus récent. Données conservées.');
  if (new Set(data.receipts.map(r => r.runId)).size !== data.receipts.length || new Set(data.receipts.map(r => r.uuid.toLowerCase())).size !== data.receipts.length) throw new Error('Associations Santé dupliquées dans le journal local. Données conservées.');
  if (data.pendingRunIds !== undefined && (!Array.isArray(data.pendingRunIds) || data.pendingRunIds.length > 10000 || !data.pendingRunIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 250) || new Set(data.pendingRunIds).size !== data.pendingRunIds.length)) throw new Error('File de synchronisation Santé illisible. Données conservées.');
  return data;
}
export async function openApplePersistence(): Promise<ApplePersistence> {
  const db = await SQLite.openDatabaseAsync('sprinter-apple-v1.db');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) > 1) throw new Error('Version du journal Apple non prise en charge.');
  await db.execAsync('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS apple (slot INTEGER PRIMARY KEY CHECK(slot=1), payload TEXT NOT NULL); PRAGMA user_version=1;');
  return { async load() { const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM apple WHERE slot=1'); return row ? parseApplePreferences(JSON.parse(row.payload)) : defaultApplePreferences(); },
    async save(data) { await db.runAsync('INSERT INTO apple (slot,payload) VALUES (1,?) ON CONFLICT(slot) DO UPDATE SET payload=excluded.payload', JSON.stringify(data)); } };
}
export const appleDatabaseDirectory = SQLite.defaultDatabaseDirectory;
