import assert from 'node:assert/strict';
import { probeImage } from '../_shared/imageProbe.ts';
import { commitProfileMedia, type MediaCommitDeps, type MediaVerdict } from '../_shared/profileMedia.ts';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const u32be = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const u16le = (value: number) => [value & 255, (value >>> 8) & 255];
const u24le = (value: number) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];
const u32le = (value: number) => [...u24le(value), (value >>> 24) & 255];

// JPEG minimal : SOI, APP1 EXIF (facultatif), SOF0 640×480, SOS.
function jpeg(withGps: boolean) {
  const tiff = [...ascii('II'), 42, 0, ...u32le(8), ...u16le(1), ...u16le(withGps ? 0x8825 : 0x0112), ...u16le(4), ...u32le(1), ...u32le(0), ...u32le(0)];
  const exif = [...ascii('Exif'), 0, 0, ...tiff];
  const app1 = [0xff, 0xe1, ...[(exif.length + 2) >> 8, (exif.length + 2) & 255], ...exif];
  const sof = [0xff, 0xc0, 0, 17, 8, ...[480 >> 8, 480 & 255], ...[640 >> 8, 640 & 255], 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return bytes(0xff, 0xd8, ...app1, ...sof, 0xff, 0xda, 0, 2, 0xff, 0xd9);
}
function png(animated: boolean) {
  const chunk = (type: string, data: number[]) => [...u32be(data.length), ...ascii(type), ...data, 0, 0, 0, 0];
  return bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', [...u32be(300), ...u32be(100), 8, 6, 0, 0, 0]),
    ...(animated ? chunk('acTL', [...u32be(3), ...u32be(0)]) : []), ...chunk('IDAT', [0]), ...chunk('IEND', []));
}
function webpAnimated() {
  const vp8x = [...ascii('VP8X'), ...u32le(10), 0x02, 0, 0, 0, ...u24le(199), ...u24le(99)];
  const frame = (ms: number) => [...ascii('ANMF'), ...u32le(16), ...u24le(0), ...u24le(0), ...u24le(199), ...u24le(99), ...u24le(ms), 0];
  const body = [...ascii('WEBP'), ...vp8x, ...frame(100), ...frame(150)];
  return bytes(...ascii('RIFF'), ...u32le(body.length), ...body);
}
function gif(frames: number, delay: number) {
  const frame = [0x21, 0xf9, 4, 0, ...u16le(delay), 0, 0, 0x2c, 0, 0, 0, 0, ...u16le(32), ...u16le(16), 0, 2, 2, 0x4c, 0x01, 0];
  return bytes(...ascii('GIF89a'), ...u16le(32), ...u16le(16), 0, 0, 0, ...Array.from({ length: frames }, () => frame).flat(), 0x3b);
}

Deno.test('type réel, dimensions et animation des formats acceptés', () => {
  assert.deepEqual(probeImage(jpeg(false)), { ok: true, mime: 'image/jpeg', width: 640, height: 480, animated: false, frames: 1, durationMs: null, hasLocation: false });
  assert.equal((probeImage(jpeg(true)) as { hasLocation: boolean }).hasLocation, true, 'EXIF avec IFD GPS détecté');
  assert.deepEqual(probeImage(png(false)), { ok: true, mime: 'image/png', width: 300, height: 100, animated: false, frames: 1, durationMs: null, hasLocation: false });
  assert.equal((probeImage(png(true)) as { animated: boolean }).animated, true, 'APNG reconnu comme animé');
  assert.deepEqual(probeImage(webpAnimated()), { ok: true, mime: 'image/webp', width: 200, height: 100, animated: true, frames: 2, durationMs: 250, hasLocation: false });
  assert.deepEqual(probeImage(gif(3, 20)), { ok: true, mime: 'image/gif', width: 32, height: 16, animated: true, frames: 3, durationMs: 600, hasLocation: false });
  assert.deepEqual(probeImage(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'))), { ok: false, reason: 'format' });
  assert.deepEqual(probeImage(jpeg(false).slice(0, 20)), { ok: false, reason: 'truncated' });
});

function deps(content: Uint8Array | null, mime = 'image/jpeg', status = 'pending') {
  const verdicts: MediaVerdict[] = [];
  const value: MediaCommitDeps = {
    async pending() { return { path: 'u/m.jpg', mime, bytes: 100, status, usage: 'avatar' }; },
    async download() { return content; },
    async result(_id, verdict) { verdicts.push(verdict); return verdict.ok ? { status: 'ready' } : { status: 'rejected', reason: verdict.reason ?? 'format' }; },
    log() {},
  };
  return { value, verdicts };
}

Deno.test('profile-media-commit : validé, refusé ou à réessayer', async () => {
  const ok = deps(jpeg(false));
  assert.deepEqual(await commitProfileMedia(ok.value, 'm'), { status: 'ready' });
  assert.equal(ok.verdicts[0]!.width, 640);
  assert.deepEqual(await commitProfileMedia(deps(jpeg(true)).value, 'm'), { status: 'rejected', reason: 'location' }, 'aucune localisation conservée');
  assert.deepEqual(await commitProfileMedia(deps(png(false)).value, 'm'), { status: 'rejected', reason: 'format' }, 'type déclaré ≠ type réel');
  assert.deepEqual(await commitProfileMedia(deps(null).value, 'm'), { status: 'missing' }, 'dépôt pas encore arrivé : on réessaie');
  const already = deps(null, 'image/jpeg', 'ready');
  assert.deepEqual(await commitProfileMedia(already.value, 'm'), { status: 'ready' }, 'rejeu idempotent');
  assert.equal(already.verdicts.length, 0);
});
