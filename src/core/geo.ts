import { GPSFix } from './types';
export function distance(a: Pick<GPSFix, 'latitude' | 'longitude'>, b: Pick<GPSFix, 'latitude' | 'longitude'>): number {
  const r = Math.PI / 180;
  const hav = Math.sin((b.latitude - a.latitude) * r / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin((b.longitude - a.longitude) * r / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, hav))), Math.sqrt(Math.max(0, 1 - hav)));
}
export const usableSpeed = (fix: GPSFix) => fix.speed !== null && Number.isFinite(fix.speed) && fix.speed >= 0 ? fix.speed : null;
