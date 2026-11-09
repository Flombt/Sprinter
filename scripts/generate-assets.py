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
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            u, v = (x / size - .5), (y / size - .5)
            # Three speed strokes and an oval running track, in the app's lime accent.
            angle = math.atan2(v / .30, u / .30)
            radius = math.sqrt((u / .30) ** 2 + (v / .30) ** 2)
            ring = abs(radius - 1) < .075 and not (-.7 < angle < .25)
            strokes = any(abs(v - (k * .115 - .115)) < .026 and -.18 < u - v * .55 < .20 for k in range(3))
            color = (209, 241, 125) if ring or strokes else (16, 18, 16)
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
