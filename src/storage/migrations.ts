import type { RunRecord } from '../core/types';
/** Version upgrades alter the envelope only; absent sensor-quality observations are never invented. */
export function migrateActivity(value: unknown): RunRecord {
  if (!value || typeof value !== 'object') throw new Error('Activité illisible.');
  const version = (value as { dataVersion?: unknown }).dataVersion ?? 1;
  if (version !== 1 && version !== 2 && version !== 3) throw new Error('Version d’activité non prise en charge. Les données ont été conservées.');
  return { ...value, dataVersion: 3 } as RunRecord;
}
