import type { RunRecord } from '../../core/types';
import type { CleanTrack } from '../types';
export interface ExportSource { run: RunRecord; track: CleanTrack }
export interface ExportDocument { filename: string; mimeType: string; data: string | Uint8Array; points: number; segments: number }
/** Future binary encoders (such as FIT) use the same source, without changing UI or sharing. */
export interface ActivityExporter { readonly id: string; readonly label: string; encode(source: ExportSource): ExportDocument }
