"""Create the three short, original PCM coaching cues (no external audio)."""
import math
import struct
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'assets'
notes = {
    'transition': [(0, .12, 620), (.16, .29, 780)],
    'success': [(0, .12, 523), (.16, .28, 659), (.32, .53, 784)],
    'failure': [(0, .20, 440), (.25, .48, 330)],
}
for name, tones in notes.items():
    frames = bytearray()
    for i in range(int(.65 * 44100)):
        t = i / 44100
        value = sum(.32 * max(0, min(1, (t - start) / .015, (end - t) / .035)) * math.sin(2 * math.pi * hz * (t - start)) for start, end, hz in tones if start <= t <= end)
        frames.extend(struct.pack('<h', int(value * 32767)))
    with wave.open(str(root / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(44100)
        output.writeframes(frames)
print('Three coaching cues generated.')
