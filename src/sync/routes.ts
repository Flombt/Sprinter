import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import type { RunRecord, TrackPoint } from '../core/types';
import { bestMeasuredSegment } from '../analysis/records';
import { endpointZones, maskedSegments } from '../sharing/privacy';
import type { SyncLocalStore } from './localStore';
import type { SyncExtension } from './engine';

/**
 * Tracés GPS dans le cloud (§8), sur choix explicite. Les points sont compressés au repos,
 * jamais pendant une course, puis déposés dans le bucket privé `run-tracks`. Le serveur ne
 * lit jamais leur contenu ; l'aperçu stocké exclut le départ et l'arrivée (300 m).
 */
export const MAX_ROUTE_BYTES = 8 * 1024 * 1024;
export const ROUTE_BATCH = 5;
export const BEST_EFFORT_DISTANCES = [1000, 5000, 10000, 21097.5] as const;

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** base64url (RFC 4648 §5) sans remplissage, sur l'UTF-8 de l'identifiant. */
export function base64Url(text: string): string {
  const bytes = strToU8(text);
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!, b = bytes[index + 1], c = bytes[index + 2];
    out += BASE64[a >> 2]! + BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b !== undefined) out += BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c !== undefined) out += BASE64[c & 63]!;
  }
  return out;
}
export const routeObjectName = (userId: string, runId: string) => `${userId}/${base64Url(runId)}.json.gz`;

export function compressPoints(points: readonly TrackPoint[]): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(points)), { level: 6 });
}
export function decompressPoints(bytes: Uint8Array): TrackPoint[] {
  const value = JSON.parse(strFromU8(gunzipSync(bytes))) as unknown;
  if (!Array.isArray(value)) throw new Error('Tracé illisible.');
  return value as TrackPoint[];
}

/** Polyline encodée (algorithme Google), ≤ 300 points, sans les 300 premiers ni les 300 derniers mètres. */
export function previewPolyline(points: readonly TrackPoint[], maxPoints = 300, hiddenRadius = 300): string | null {
  const bySegment = new Map<number, { latitude: number; longitude: number }[]>();
  for (const point of points) {
    const list = bySegment.get(point.segment) ?? [];
    list.push({ latitude: point.fix.latitude, longitude: point.fix.longitude });
    bySegment.set(point.segment, list);
  }
  const segments = [...bySegment.values()];
  const visible = maskedSegments(segments, endpointZones(segments), hiddenRadius).flat();
  if (visible.length < 2) return null;
  const step = Math.max(1, Math.ceil(visible.length / maxPoints));
  const sampled = visible.filter((_, index) => index % step === 0);
  let previousLat = 0, previousLng = 0, out = '';
  const encode = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    out += String.fromCharCode(v + 63);
  };
  for (const point of sampled) {
    const lat = Math.round(point.latitude * 1e5), lng = Math.round(point.longitude * 1e5);
    encode(lat - previousLat); encode(lng - previousLng);
    previousLat = lat; previousLng = lng;
  }
  return out;
}

/** Meilleurs efforts calculés sur l'appareil (§8.3) : secondes pour 1 km, 5 km, 10 km, semi. */
export function bestEfforts(run: RunRecord): Record<string, number> | undefined {
  if (run.endedAt === null || run.points.length < 2) return undefined;
  const out: Record<string, number> = {};
  for (const meters of BEST_EFFORT_DISTANCES) {
    if (run.distanceMeters < meters) continue;
    const segment = bestMeasuredSegment(run, meters);
    if (segment && Number.isFinite(segment.seconds) && segment.seconds > 0) out[String(meters)] = Math.round(segment.seconds * 10) / 10;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface RouteTransport {
  upload(path: string, bytes: Uint8Array): Promise<void>;
  download(path: string): Promise<Uint8Array>;
  remove(paths: string[]): Promise<void>;
  register(runId: string, path: string, pointsCount: number, bytes: number, preview: string | null): Promise<void>;
  deleteRoutes(runIds: string[] | null): Promise<string[]>;
}

export class RouteSync implements SyncExtension {
  name = 'routes';
  constructor(
    private local: SyncLocalStore,
    private transport: RouteTransport,
    private deps: { userId(): string | null; enabled(): boolean; runActive(): boolean; wifi(): boolean; historyChanged(): Promise<void> },
  ) {}
  /** Envoi des tracés des courses déjà synchronisées, puis préchargement des 5 derniers en Wi-Fi. */
  async run({ routesOn, guard = () => {} }: { routesOn: boolean; guard?(): void }) {
    const userId = this.deps.userId();
    if (!routesOn || !this.deps.enabled() || !userId) return;
    for (const id of await this.local.routeCandidates(ROUTE_BATCH)) {
      if (this.deps.runActive()) return;
      const points = await this.local.pointsOf(id);
      if (!points.length) continue;
      const bytes = compressPoints(points);
      if (bytes.length > MAX_ROUTE_BYTES) { await this.local.markRoute(id, 'too_large'); continue; }
      const path = routeObjectName(userId, id);
      guard();
      await this.transport.upload(path, bytes);
      guard();
      await this.transport.register(id, path, points.length, bytes.length, previewPolyline(points));
      guard();
      await this.local.markRoute(id, 'uploaded');
    }
    if (this.deps.wifi()) {
      let fetched = 0;
      for (const id of await this.local.cloudRouteRuns(ROUTE_BATCH)) {
        if (this.deps.runActive()) break;
        guard();
        try { await this.download(id, userId, guard); fetched++; } catch { /* réessayé plus tard */ }
      }
      if (fetched) await this.deps.historyChanged();
    }
  }
  /** Téléchargement à la demande (détail d'une course sans points locaux, §8.4). */
  async download(runId: string, userId = this.deps.userId(), guard: () => void = () => {}) {
    if (!userId) throw new Error('Connectez-vous pour récupérer ce parcours.');
    const points = decompressPoints(await this.transport.download(routeObjectName(userId, runId)));
    guard();
    if (this.deps.userId() !== userId) throw new Error('Le compte a changé.');
    await this.local.attachPoints(runId, points);
    await this.local.markRoute(runId, 'uploaded');
    return points.length;
  }
  /** « Supprimer aussi mes parcours en ligne » (§8.5) : références, aperçus puis fichiers. */
  async deleteOnline() {
    const paths = await this.transport.deleteRoutes(null);
    for (let index = 0; index < paths.length; index += 100) {
      await this.transport.remove(paths.slice(index, index + 100)).catch(() => undefined); // la purge serveur reprend sinon
    }
    await this.local.clearRouteMeta();
    return paths.length;
  }
}
