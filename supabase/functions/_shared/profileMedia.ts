// Validation d'un média du profil déposé par le titulaire (§17.6, §17.8) : type réel, dimensions,
// animation et absence de localisation. Un fichier refusé est purgé ; le visuel précédent reste en place.
import { probeImage } from './imageProbe.ts';

export interface PendingMedia { path: string; mime: string; bytes: number; status: string; usage: string }
export interface MediaVerdict {
  ok: boolean; mime: string; bytes: number; width: number; height: number;
  animated: boolean; durationMs: number | null; reason: string | null;
}
export interface MediaCommitDeps {
  /** Réservation lue avec le jeton du titulaire (session active, profil activé) ; null si inconnue. */
  pending(id: string): Promise<PendingMedia | null>;
  /** Contenu déposé, ou null s'il n'est pas (encore) présent. */
  download(path: string): Promise<Uint8Array | null>;
  result(id: string, verdict: MediaVerdict): Promise<{ status: string; reason?: string }>;
  log(event: string, data?: Record<string, unknown>): void;
}
export type MediaCommitResult = { status: 'ready' } | { status: 'missing' } | { status: 'rejected'; reason: string };

export async function commitProfileMedia(deps: MediaCommitDeps, id: string): Promise<MediaCommitResult> {
  const pending = await deps.pending(id);
  if (!pending) return { status: 'rejected', reason: 'unknown_media' };
  if (pending.status === 'ready') return { status: 'ready' };
  const bytes = await deps.download(pending.path);
  if (!bytes) return { status: 'missing' };
  const probe = probeImage(bytes);
  const reject = (reason: string) => ({ ok: false, mime: pending.mime, bytes: bytes.length, width: 16, height: 16, animated: false, durationMs: null, reason });
  const verdict: MediaVerdict = !probe.ok ? reject('format')
    : probe.mime !== pending.mime ? reject('format')
    : probe.hasLocation ? reject('location')
    : { ok: true, mime: probe.mime, bytes: bytes.length, width: probe.width, height: probe.height, animated: probe.animated, durationMs: probe.durationMs, reason: null };
  const outcome = await deps.result(id, verdict);
  deps.log('profile_media.commit', { status: outcome.status, reason: outcome.reason ?? null });
  return outcome.status === 'ready' ? { status: 'ready' } : { status: 'rejected', reason: outcome.reason ?? 'format' };
}
