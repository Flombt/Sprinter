import { describe, expect, it, vi } from 'vitest';
import { CueAudio, CueAudioBackend, CuePlayer } from '../src/services/cueAudio';
function setup() {
  let finished: () => void = () => {};
  const player: CuePlayer = { seekTo: vi.fn().mockResolvedValue(undefined), play: vi.fn(), pause: vi.fn(), onFinish(callback) { finished = callback; } };
  const backend: CueAudioBackend = { activateDuck: vi.fn().mockResolvedValue(undefined), deactivate: vi.fn().mockResolvedValue(undefined), create: vi.fn().mockReturnValue(player) };
  return { audio: new CueAudio(backend), player, backend, finish: () => finished() };
}
describe('short cue audio sessions (simulated audio backend)', () => {
  it('ducks only for the cue and releases the native session at completion', async () => {
    const { audio, player, backend, finish } = setup(); await audio.play('slowDown');
    expect(backend.activateDuck).toHaveBeenCalledOnce(); expect(player.play).toHaveBeenCalledOnce();
    expect(backend.deactivate).not.toHaveBeenCalled(); finish(); await Promise.resolve();
    expect(backend.deactivate).toHaveBeenCalledOnce();
  });
  it('stops a pending cue before it plays and does not leave the music ducked', async () => {
    const { audio, player, backend } = setup(); const pending = audio.play('speedUp'); audio.stop(); await pending;
    expect(player.play).not.toHaveBeenCalled(); expect(backend.activateDuck).not.toHaveBeenCalled();
  });
  it('releases ducking on pause/cancellation', async () => {
    const { audio, player, backend } = setup(); await audio.play('speedUp'); audio.stop(); await Promise.resolve();
    expect(player.pause).toHaveBeenCalled(); expect(backend.deactivate).toHaveBeenCalledOnce();
  });
  it('releases a partially activated session if playback fails', async () => {
    const { audio, player, backend } = setup(); vi.mocked(player.seekTo).mockRejectedValueOnce(new Error('Audio interruption'));
    await expect(audio.play('speedUp')).rejects.toThrow('Audio interruption'); await Promise.resolve();
    expect(backend.deactivate).toHaveBeenCalledOnce();
  });
});
