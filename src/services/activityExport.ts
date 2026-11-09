import type { RunRecord } from '../core/types';
import { exportActivity } from '../analysis/export';
import { shareDocument } from './documentShare';
export async function shareActivityExport(run: RunRecord, format = 'gpx'): Promise<void> {
  await shareDocument(exportActivity(run, format));
}
