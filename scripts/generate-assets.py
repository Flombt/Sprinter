"""Generate our own icon and two short PCM cues. No downloaded art or audio."""
import math
import struct
import wave
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'assets'
ROOT.mkdir(exist_ok=True)

def png(path, size, splash=False):
    def chunk(kind, content):
        return struct.pack('>I', len(content)) + kind + content + struct.pack('>I', zlib.crc32(kind + content) & 0xffffffff)
    # The same three forward strokes as the interface's SpeedMark.
    # Render a code-native mark; no source photograph or third-party artwork.
    polygons = [[(2, 25), (14, 3), (20, 3), (8, 25)],
                [(12, 25), (24, 3), (30, 3), (18, 25)],
                [(22, 25), (34, 3), (36, 3), (24, 25)]]
    scale = size * .70 / 36
    offset_x, offset_y = size * .15, size * .5 - 14 * scale
    def inside(px, py, polygon):
        positive = negative = False
        for a, b in zip(polygon, polygon[1:] + polygon[:1]):
            cross = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])
            positive |= cross > 0; negative |= cross < 0
        return not (positive and negative)
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            coverage = sum(any(inside((x + dx - offset_x) / scale, (y + dy - offset_y) / scale, p) for p in polygons)
                           for dx, dy in ((.25, .25), (.75, .25), (.25, .75), (.75, .75))) / 4
            color = tuple(round(base + (accent - base) * coverage) for base, accent in zip((16, 16, 17), (255, 92, 53)))
            row.extend(color)
        rows.append(bytes(row))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
    path.write_bytes(data)

def cue(name, notes, length):
    rate = 44100
    frames = bytearray()
    for i in range(int(length * rate)):
        t = i / rate
        value = 0
        for start, end, hz in notes:
            if start <= t <= end:
                envelope = min(1, (t - start) / .018, (end - t) / .04)
                value += .38 * max(0, envelope) * math.sin(2 * math.pi * hz * (t - start))
        frames.extend(struct.pack('<h', int(max(-1, min(1, value)) * 32767)))
    with wave.open(str(ROOT / name), 'wb') as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(rate); output.writeframes(frames)

png(ROOT / 'icon.png', 1024)
png(ROOT / 'splash.png', 256, True)
cue('slowDown.wav', [(0, .14, 660), (.25, .39, 440)], .5)
cue('speedUp.wav', [(0, .65, 880)], .75)
print('Generated icon, splash and two distinct audio cues.')
