import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RunRecord, DEFAULT_SETTINGS, DEFAULT_TARGET } from '../src/core/types';
import type { LocationObject } from 'expo-location';
import type { LocationService } from '../src/services/location';

const mocks = vi.hoisted(() => ({
  foreground: vi.fn(), permission: vi.fn(), services: vi.fn(), watch: vi.fn(), remove: vi.fn(),
  stopAlert: vi.fn(), sendAlert: vi.fn(), finish: vi.fn(), saveDraft: vi.fn(),
  history: vi.fn(), loadDraft: vi.fn(), settings: vi.fn(), saveSettings: vi.fn(),
}));
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: vi.fn() } }));
vi.mock('expo-location', () => ({
  getForegroundPermissionsAsync: mocks.foreground, requestForegroundPermissionsAsync: mocks.permission,
  hasServicesEnabledAsync: mocks.services, watchPositionAsync: mocks.watch,
  Accuracy: { Highest: 5, BestForNavigation: 6 }, ActivityType: { Fitness: 3 },
}));
vi.mock('../src/services/capabilities', () => ({ CAN_BACKGROUND: false, IS_EXPO_GO: true, LOCATION_TASK: 'test.location' }));
vi.mock('../src/services/alerts', () => ({ alerts: { stop: mocks.stopAlert, send: mocks.sendAlert } }));
vi.mock('../src/workouts/coaching', () => ({ coaching: { reset: vi.fn(), stop: mocks.stopAlert, cancelPace: vi.fn(), pump: vi.fn() } }));
vi.mock('../src/workouts/store', () => ({ workouts: { getSnapshot: () => ({ preferences: { voiceEnabled: false } }) } }));
vi.mock('../src/storage/open', () => ({ openRepository: async () => ({
  initialize: async () => {}, history: mocks.history, loadDraft: mocks.loadDraft, loadSettings: mocks.settings,
  saveDraft: mocks.saveDraft, finish: mocks.finish, saveSettings: mocks.saveSettings, unreadableCount: 0,
}) }));
import { RunningStore } from '../src/services/session';
import { RunEngine } from '../src/core/engine';

let store: RunningStore;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  mocks.foreground.mockResolvedValue({ granted: true }); mocks.permission.mockResolvedValue({ granted: true });
  mocks.services.mockResolvedValue(true); mocks.watch.mockResolvedValue({ remove: mocks.remove });
  mocks.history.mockResolvedValue([]); mocks.loadDraft.mockResolvedValue(null);
  mocks.settings.mockResolvedValue({ ...DEFAULT_SETTINGS }); mocks.saveDraft.mockResolvedValue(undefined);
  mocks.finish.mockResolvedValue(undefined); mocks.sendAlert.mockResolvedValue(undefined);
  store = new RunningStore();
});
afterEach(async () => { await store.pause(); vi.clearAllTimers(); vi.useRealTimers(); });
function nativeFix(epoch: number, t: number, meters: number, speed = 3): LocationObject {
  return { timestamp: epoch + t * 1000, coords: { latitude: 48 + meters / 6371000 * 180 / Math.PI, longitude: 2,
    accuracy: 4, speed, heading: 0, altitude: 100, altitudeAccuracy: 3 } };
}
describe('session lifecycle (simulated platform services)', () => {
  it('starts recording only after permissions and saves an initial checkpoint', async () => {
    await store.initialize(); expect(await store.start(DEFAULT_TARGET)).toBe(true);
    expect(mocks.watch).toHaveBeenCalledOnce(); expect(mocks.saveDraft).toHaveBeenCalled();
    expect(store.getSnapshot().running).toBe(true);
  });
  it('automatically pauses Expo Go on backgrounding and freezes active time', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET);
    await vi.advanceTimersByTimeAsync(10000); await store.appStateChanged('background');
    const active = store.getSnapshot().run!.activeSeconds;
    expect(store.getSnapshot().running).toBe(false); expect(mocks.remove).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30000);
    expect(store.getSnapshot().run!.activeSeconds).toBe(active);
    expect(store.getSnapshot().message).toContain('pause');
  });
  it('keeps a failed final save paused and recoverable', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET); mocks.finish.mockRejectedValueOnce(new Error('Disk full'));
    expect(await store.finish()).toBeNull();
    expect(store.getSnapshot().run).not.toBeNull(); expect(store.getSnapshot().running).toBe(false);
    expect(store.getSnapshot().message).toContain('Disk full');
  });
  it('finishes and removes the active session only after history commit', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET);
    const result = await store.finish(); expect(result?.endedAt).not.toBeNull();
    expect(mocks.finish).toHaveBeenCalledOnce(); expect(store.getSnapshot().run).toBeNull();
  });
  it('does not create a session when location permission is refused', async () => {
    mocks.foreground.mockResolvedValue({ granted: false }); mocks.permission.mockResolvedValue({ granted: false });
    await store.initialize(); expect(await store.start(DEFAULT_TARGET)).toBe(false);
    expect(store.getSnapshot().run).toBeNull(); expect(mocks.watch).not.toHaveBeenCalled();
  });
  it('requires precise iOS location before starting', async () => {
    mocks.foreground.mockResolvedValue({ granted: true, ios: { accuracy: 'reduced' } });
    await store.initialize(); expect(await store.start(DEFAULT_TARGET)).toBe(false);
    expect(mocks.watch).not.toHaveBeenCalled(); expect(store.getSnapshot().message).toContain('Position exacte');
  });
  it('restores an interrupted course in pause with no elapsed downtime', async () => {
    const run: RunRecord = new RunEngine(DEFAULT_TARGET).record; run.activeSeconds = 75;
    mocks.loadDraft.mockResolvedValue({ version: 1, revision: 20, run });
    await store.initialize(); await vi.advanceTimersByTimeAsync(60000);
    expect(store.getSnapshot().restored).toBe(true); expect(store.getSnapshot().running).toBe(false);
    expect(store.getSnapshot().run!.activeSeconds).toBe(75); expect(mocks.watch).not.toHaveBeenCalled();
  });
  it('prevents a second start while a run is active', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET);
    expect(await store.start(DEFAULT_TARGET)).toBe(false); expect(mocks.watch).toHaveBeenCalledOnce();
  });
  it('serializes repeated finish requests before asynchronous commit', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET);
    const [first, second] = await Promise.all([store.finish(), store.finish()]);
    expect(first).not.toBeNull(); expect(second).toBeNull(); expect(mocks.finish).toHaveBeenCalledOnce();
  });
  it('saves a paused checkpoint even if stopping the native watcher fails', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET); await vi.advanceTimersByTimeAsync(3000);
    const calls = mocks.saveDraft.mock.calls.length; mocks.remove.mockImplementationOnce(() => { throw new Error('Native teardown failed'); });
    await store.pause(); expect(store.getSnapshot().running).toBe(false);
    expect(mocks.saveDraft.mock.calls.length).toBeGreaterThan(calls); expect(store.getSnapshot().message).toContain('Native teardown');
  });
  it('reports a committed run as saved even when reloading history subsequently fails', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET); mocks.history.mockRejectedValueOnce(new Error('Read failed'));
    const result = await store.finish(); expect(result).not.toBeNull(); expect(store.getSnapshot().run).toBeNull();
    expect(store.getSnapshot().history[0]!.id).toBe(result!.id); expect(store.getSnapshot().message).toContain('enregistrée');
  });
  it('coalesces timer checkpoints while a write is pending and flushes the latest paused state afterwards', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET);
    let resolve!: () => void; mocks.saveDraft.mockReturnValueOnce(new Promise<void>(value => { resolve = value; }));
    await vi.advanceTimersByTimeAsync(25000); expect(mocks.saveDraft).toHaveBeenCalledTimes(2);
    const paused = store.pause(); await Promise.resolve(); resolve(); await paused;
    expect(mocks.saveDraft).toHaveBeenCalledTimes(3); expect(mocks.saveDraft.mock.calls.at(-1)![0].run.activeSeconds).toBe(25);
  });
  it('cancels an in-flight foreground start when the app backgrounds and keeps the recovery checkpoint', async () => {
    await store.initialize(); let resolve!: (value: { remove: () => void }) => void;
    mocks.watch.mockReturnValueOnce(new Promise(value => { resolve = value; }));
    const starting = store.start(DEFAULT_TARGET);
    await vi.waitFor(() => expect(mocks.watch).toHaveBeenCalledOnce());
    await store.appStateChanged('background'); resolve({ remove: mocks.remove }); await starting;
    expect(store.getSnapshot().running).toBe(false); expect(store.getSnapshot().run).not.toBeNull();
    expect(mocks.remove).toHaveBeenCalled(); expect(mocks.saveDraft).toHaveBeenCalled();
  });
  it('keeps native GPS active while automatically paused, without creating a second watcher on manual resumption', async () => {
    mocks.settings.mockResolvedValue({ ...DEFAULT_SETTINGS, autoPauseEnabled: true });
    await store.initialize(); await store.start(DEFAULT_TARGET); const epoch = Date.now(); store.receive([nativeFix(epoch, 0, 0)]);
    for (let t = 1; t <= 35; t++) { await vi.advanceTimersByTimeAsync(1000); store.receive([nativeFix(epoch, t, Math.min(20, t) * 3, t > 20 ? 0 : 3)]); }
    expect(store.getSnapshot().autoPaused).toBe(true); expect(store.getSnapshot().running).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.watch.mock.calls[0]![0].distanceInterval).toBe(0);
    await store.resume(); expect(store.getSnapshot().running).toBe(true); expect(mocks.watch).toHaveBeenCalledOnce();
  });
  it('manually pauses an automatically paused Expo Go run when it goes into the background', async () => {
    mocks.settings.mockResolvedValue({ ...DEFAULT_SETTINGS, autoPauseEnabled: true });
    await store.initialize(); await store.start(DEFAULT_TARGET); const epoch = Date.now();
    for (let t = 1; t <= 10; t++) { await vi.advanceTimersByTimeAsync(1000); store.receive([nativeFix(epoch, t, 0, 0)]); }
    expect(store.getSnapshot().autoPaused).toBe(true); await store.appStateChanged('background');
    expect(store.getSnapshot().autoPaused).toBe(false); expect(store.getSnapshot().running).toBe(false); expect(mocks.remove).toHaveBeenCalled();
  });
  it('revalidates permissions after returning to foreground and pauses if permission has been revoked', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET); mocks.foreground.mockResolvedValue({ granted: false });
    await store.appStateChanged('active'); expect(store.getSnapshot().running).toBe(false); expect(store.getSnapshot().message).toContain('refusée');
  });
  it('processes background batches and checkpoints before yielding, while UI timers are suspended', async () => {
    const location: LocationService = { canBackground: true, ensureForeground: vi.fn(async () => {}), checkAccess: vi.fn(async () => {}),
      start: vi.fn(async () => true), stop: vi.fn(async () => {}) };
    store = new RunningStore(location); mocks.settings.mockResolvedValue({ ...DEFAULT_SETTINGS, backgroundEnabled: true });
    await store.initialize(); await store.start(DEFAULT_TARGET); const epoch = Date.now(); store.receive([nativeFix(epoch, 0, 0)]);
    await store.appStateChanged('background'); const calls = mocks.saveDraft.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000); await store.handleBackground([nativeFix(epoch, 3, 9), nativeFix(epoch, 1, 3), nativeFix(epoch, 2, 6)]);
    expect(store.getSnapshot().running).toBe(true); expect(store.getSnapshot().backgroundActive).toBe(true);
    expect(store.getSnapshot().run!.activeSeconds).toBe(3); expect(store.getSnapshot().run!.distanceMeters).toBeCloseTo(9, 4);
    expect(mocks.saveDraft.mock.calls.length).toBeGreaterThan(calls);
  });
  it('preserves data and pauses after a fatal background location interruption', async () => {
    await store.initialize(); await store.start(DEFAULT_TARGET); await vi.advanceTimersByTimeAsync(3000);
    await store.handleLocationError('Native location interrupted', true);
    expect(store.getSnapshot().running).toBe(false); expect(store.getSnapshot().run!.activeSeconds).toBe(3);
    expect(store.getSnapshot().message).toContain('interruption'); expect(mocks.saveDraft.mock.calls.at(-1)![0].run.activeSeconds).toBe(3);
  });
  it('does not block access to stored activities if native residual cleanup is unavailable', async () => {
    const location: LocationService = { canBackground: true, ensureForeground: vi.fn(async () => {}), checkAccess: vi.fn(async () => {}),
      start: vi.fn(async () => true), stop: vi.fn(async () => { throw new Error('cleanup denied'); }) };
    store = new RunningStore(location); await store.initialize(); expect(store.getSnapshot().ready).toBe(true);
    expect(store.getSnapshot().error).toBeNull(); expect(store.getSnapshot().message).toContain('cleanup');
  });
  it('waits for permissions before starting the active clock', async () => {
    mocks.foreground.mockResolvedValue({ granted: false }); let resolve!: (value: { granted: boolean }) => void;
    mocks.permission.mockReturnValueOnce(new Promise(value => { resolve = value; }));
    await store.initialize(); const starting = store.start(DEFAULT_TARGET);
    await vi.waitFor(() => expect(mocks.permission).toHaveBeenCalledOnce()); await vi.advanceTimersByTimeAsync(30000);
    expect(store.getSnapshot().run).toBeNull(); resolve({ granted: true }); await starting;
    expect(store.getSnapshot().run!.activeSeconds).toBe(0); expect(store.getSnapshot().run!.totalSeconds).toBe(0);
  });
  it('freezes the finished result at the user action even if native teardown takes time', async () => {
    const location: LocationService = { canBackground: false, ensureForeground: vi.fn(async () => {}), checkAccess: vi.fn(async () => {}),
      start: vi.fn(async () => false), stop: vi.fn(async () => {}) };
    store = new RunningStore(location); await store.initialize(); await store.start(DEFAULT_TARGET); await vi.advanceTimersByTimeAsync(5000);
    const endedAt = Date.now(); let resolve!: () => void;
    vi.mocked(location.stop).mockReturnValueOnce(new Promise<void>(value => { resolve = value; }));
    const finishing = store.finish(); await vi.advanceTimersByTimeAsync(10000); resolve(); const result = await finishing;
    expect(result!.activeSeconds).toBe(5); expect(result!.totalSeconds).toBe(5); expect(result!.endedAt).toBe(endedAt);
  });
});
