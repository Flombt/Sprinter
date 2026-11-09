import type { RunRecord } from '../../core/types';
import { cleanTrack } from '../track';
import { gpxExporter } from './gpx';
import { csvExporter } from './csv';
import type { ActivityExporter, ExportDocument } from './types';
const exporters = new Map<string, ActivityExporter>([['gpx', gpxExporter], ['csv', csvExporter]]);
export function registerActivityExporter(exporter: ActivityExporter) {
  if (!exporter.id || exporters.has(exporter.id)) throw new Error('Cet exporteur existe déjà ou son identifiant est invalide.');
  exporters.set(exporter.id, exporter);
}
export function exportActivity(run: RunRecord, format = 'gpx'): ExportDocument {
  const exporter = exporters.get(format); if (!exporter) throw new Error(`Le format ${format} n’est pas implémenté.`);
  return exporter.encode({ run, track: cleanTrack(run) });
}
