// Type réel, dimensions, animation et localisation d'une image (§17.8), sans dépendance.
// Lit les en-têtes JPEG, PNG, WebP et GIF ; toute lecture hors limites est traitée comme un fichier tronqué.

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
export type ProbeResult =
  | { ok: true; mime: ImageMime; width: number; height: number; animated: boolean; frames: number; durationMs: number | null; hasLocation: boolean }
  | { ok: false; reason: 'format' | 'truncated' };

class Truncated extends Error {}

class Reader {
  constructor(readonly bytes: Uint8Array) {}
  get length() { return this.bytes.length; }
  u8(offset: number): number {
    const value = this.bytes[offset];
    if (value === undefined) throw new Truncated();
    return value;
  }
  u16be(offset: number) { return (this.u8(offset) << 8) | this.u8(offset + 1); }
  u16le(offset: number) { return this.u8(offset) | (this.u8(offset + 1) << 8); }
  u24le(offset: number) { return this.u8(offset) | (this.u8(offset + 1) << 8) | (this.u8(offset + 2) << 16); }
  u32be(offset: number) { return ((this.u8(offset) << 24) >>> 0) + (this.u8(offset + 1) << 16) + (this.u8(offset + 2) << 8) + this.u8(offset + 3); }
  u32le(offset: number) { return this.u8(offset) + (this.u8(offset + 1) << 8) + (this.u8(offset + 2) << 16) + ((this.u8(offset + 3) << 24) >>> 0); }
  ascii(offset: number, length: number) {
    let text = '';
    for (let index = 0; index < length; index++) text += String.fromCharCode(this.u8(offset + index));
    return text;
  }
}

/** Un bloc TIFF (EXIF) contient-il l'IFD GPS (balise 0x8825) dans son premier répertoire ? */
function tiffHasGps(reader: Reader, start: number): boolean {
  const order = reader.ascii(start, 2);
  if (order !== 'II' && order !== 'MM') return false;
  const little = order === 'II';
  const u16 = (offset: number) => little ? reader.u16le(offset) : reader.u16be(offset);
  const u32 = (offset: number) => little ? reader.u32le(offset) : reader.u32be(offset);
  const ifd = start + u32(start + 4);
  const count = u16(ifd);
  for (let index = 0; index < count; index++) if (u16(ifd + 2 + index * 12) === 0x8825) return true;
  return false;
}

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function probeJpeg(reader: Reader): ProbeResult {
  let offset = 2, hasLocation = false;
  while (offset + 4 <= reader.length) {
    if (reader.u8(offset) !== 0xff) return { ok: false, reason: 'format' };
    const marker = reader.u8(offset + 1);
    if (marker === 0xff) { offset++; continue; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { offset += 2; continue; }
    const length = reader.u16be(offset + 2);
    if (length < 2) return { ok: false, reason: 'format' };
    if (marker === 0xe1 && reader.ascii(offset + 4, 6) === 'Exif\0\0') hasLocation ||= tiffHasGps(reader, offset + 10);
    if (SOF.has(marker)) {
      return { ok: true, mime: 'image/jpeg', height: reader.u16be(offset + 5), width: reader.u16be(offset + 7), animated: false, frames: 1, durationMs: null, hasLocation };
    }
    if (marker === 0xda || marker === 0xd9) return { ok: false, reason: 'format' };
    offset += 2 + length;
  }
  return { ok: false, reason: 'truncated' };
}

function probePng(reader: Reader): ProbeResult {
  if (reader.ascii(12, 4) !== 'IHDR') return { ok: false, reason: 'format' };
  const width = reader.u32be(16), height = reader.u32be(20);
  let offset = 8, animated = false, hasLocation = false, frames = 1;
  while (offset + 8 <= reader.length) {
    const length = reader.u32be(offset), type = reader.ascii(offset + 4, 4);
    if (type === 'acTL') { animated = true; frames = reader.u32be(offset + 8); }
    if (type === 'eXIf') hasLocation ||= tiffHasGps(reader, offset + 8);
    if (type === 'IDAT' || type === 'IEND') break;
    offset += 12 + length;
  }
  return { ok: true, mime: 'image/png', width, height, animated, frames, durationMs: null, hasLocation };
}

function probeWebp(reader: Reader): ProbeResult {
  let offset = 12, width = 0, height = 0, animated = false, frames = 0, duration = 0, hasLocation = false;
  const end = Math.min(reader.length, 8 + reader.u32le(4));
  while (offset + 8 <= end) {
    const type = reader.ascii(offset, 4), size = reader.u32le(offset + 4), data = offset + 8;
    if (type === 'VP8X') {
      animated = (reader.u8(data) & 0x02) !== 0;
      width = 1 + reader.u24le(data + 4);
      height = 1 + reader.u24le(data + 7);
    } else if (type === 'VP8 ' && !width) {
      if (reader.u8(data + 3) !== 0x9d || reader.u8(data + 4) !== 0x01 || reader.u8(data + 5) !== 0x2a) return { ok: false, reason: 'format' };
      width = reader.u16le(data + 6) & 0x3fff;
      height = reader.u16le(data + 8) & 0x3fff;
    } else if (type === 'VP8L' && !width) {
      if (reader.u8(data) !== 0x2f) return { ok: false, reason: 'format' };
      const b1 = reader.u8(data + 1), b2 = reader.u8(data + 2), b3 = reader.u8(data + 3), b4 = reader.u8(data + 4);
      width = 1 + ((b1 | (b2 << 8)) & 0x3fff);
      height = 1 + (((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)) & 0x3fff);
    } else if (type === 'ANMF') {
      frames++;
      duration += reader.u24le(data + 12);
    } else if (type === 'EXIF') {
      hasLocation ||= tiffHasGps(reader, reader.ascii(data, 6) === 'Exif\0\0' ? data + 6 : data);
    }
    offset = data + size + (size % 2);
  }
  if (!width || !height) return { ok: false, reason: 'truncated' };
  return { ok: true, mime: 'image/webp', width, height, animated, frames: animated ? frames : 1, durationMs: animated ? duration : null, hasLocation };
}

function skipSubBlocks(reader: Reader, offset: number): number {
  let cursor = offset;
  for (let size = reader.u8(cursor); size !== 0; size = reader.u8(cursor)) cursor += size + 1;
  return cursor + 1;
}

function probeGif(reader: Reader): ProbeResult {
  const width = reader.u16le(6), height = reader.u16le(8), packed = reader.u8(10);
  let offset = 13 + ((packed & 0x80) ? 3 * (1 << ((packed & 0x07) + 1)) : 0);
  let frames = 0, duration = 0;
  for (;;) {
    const block = reader.u8(offset);
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = reader.u8(offset + 1);
      if (label === 0xf9) duration += reader.u16le(offset + 4) * 10;
      offset = skipSubBlocks(reader, offset + 2);
    } else if (block === 0x2c) {
      frames++;
      const local = reader.u8(offset + 9);
      offset += 10 + ((local & 0x80) ? 3 * (1 << ((local & 0x07) + 1)) : 0);
      offset = skipSubBlocks(reader, offset + 1);
    } else {
      return { ok: false, reason: 'format' };
    }
  }
  if (frames === 0) return { ok: false, reason: 'format' };
  return { ok: true, mime: 'image/gif', width, height, animated: frames > 1, frames, durationMs: frames > 1 ? duration : null, hasLocation: false };
}

export function probeImage(bytes: Uint8Array): ProbeResult {
  const reader = new Reader(bytes);
  try {
    if (reader.length < 16) return { ok: false, reason: 'truncated' };
    if (reader.u8(0) === 0xff && reader.u8(1) === 0xd8 && reader.u8(2) === 0xff) return probeJpeg(reader);
    if (reader.u32be(0) === 0x89504e47 && reader.u32be(4) === 0x0d0a1a0a) return probePng(reader);
    if (reader.ascii(0, 4) === 'RIFF' && reader.ascii(8, 4) === 'WEBP') return probeWebp(reader);
    if (reader.ascii(0, 6) === 'GIF87a' || reader.ascii(0, 6) === 'GIF89a') return probeGif(reader);
    return { ok: false, reason: 'format' };
  } catch (error) {
    if (error instanceof Truncated) return { ok: false, reason: 'truncated' };
    throw error;
  }
}
