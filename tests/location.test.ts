import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationObject } from 'expo-location';
const mocks = vi.hoisted(() => ({
  appState: { currentState: 'active' }, services: vi.fn(), foreground: vi.fn(), requestForeground: vi.fn(),
  background: vi.fn(), requestBackground: vi.fn(), watch: vi.fn(), remove: vi.fn(), start: vi.fn(), stop: vi.fn(), hasStarted: vi.fn(),
}));
vi.mock('react-native', () => ({ AppState: mocks.appState }));
vi.mock('../src/services/capabilities', () => ({ CAN_BACKGROUND: true, LOCATION_TASK: 'test.location' }));
vi.mock('expo-location', () => ({
  Accuracy: { Highest: 5, BestForNavigation: 6 }, ActivityType: { Fitness: 3 },
  hasServicesEnabledAsync: mocks.services, getForegroundPermissionsAsync: mocks.foreground, requestForegroundPermissionsAsync: mocks.requestForeground,
  getBackgroundPermissionsAsync: mocks.background, requestBackgroundPermissionsAsync: mocks.requestBackground,
  watchPositionAsync: mocks.watch, startLocationUpdatesAsync: mocks.start, stopLocationUpdatesAsync: mocks.stop, hasStartedLocationUpdatesAsync: mocks.hasStarted,
}));
import { DeviceLocationService, locationFix } from '../src/services/location';
const sample: LocationObject = { timestamp: 1800000000000, coords: { latitude: 48, longitude: 2, accuracy: 4, altitude: 120, altitudeAccuracy: 3, speed: -1, heading: -1 } };
beforeEach(() => {
  vi.resetAllMocks(); mocks.appState.currentState = 'active'; mocks.services.mockResolvedValue(true);
  mocks.foreground.mockResolvedValue({ granted: true }); mocks.background.mockResolvedValue({ granted: true });
  mocks.watch.mockResolvedValue({ remove: mocks.remove }); mocks.start.mockResolvedValue(undefined); mocks.stop.mockResolvedValue(undefined); mocks.hasStarted.mockResolvedValue(false);
});
describe('Core Location adapter through the Expo public API (simulated native services)', () => {
  it('carries horizontal and vertical precision without inventing a speed accuracy', () => {
    expect(locationFix(sample)).toEqual({ latitude: 48, longitude: 2, accuracy: 4, timestamp: sample.timestamp, altitude: 120, altitudeAccuracy: 3, speed: -1 });
    expect(locationFix({ ...sample, coords: null } as unknown as LocationObject)).toBeNull();
  });
  it('refuses to start with disabled location services', async () => {
    mocks.services.mockResolvedValue(false); await expect(new DeviceLocationService().ensureForeground()).rejects.toThrow('services');
    expect(mocks.requestForeground).not.toHaveBeenCalled(); expect(mocks.watch).not.toHaveBeenCalled();
  });
  it('does not keep asking for a permanently refused permission', async () => {
    mocks.foreground.mockResolvedValue({ granted: false, canAskAgain: false });
    await expect(new DeviceLocationService().ensureForeground()).rejects.toThrow('réglages'); expect(mocks.requestForeground).not.toHaveBeenCalled();
  });
  it('asks for foreground permission when allowed and checks precise iOS accuracy', async () => {
    mocks.foreground.mockResolvedValue({ granted: false, canAskAgain: true });
    mocks.requestForeground.mockResolvedValue({ granted: true, ios: { accuracy: 'reduced' } });
    await expect(new DeviceLocationService().ensureForeground()).rejects.toThrow('Position exacte'); expect(mocks.requestForeground).toHaveBeenCalledOnce();
  });
  it('uses the highest ordinary accuracy and a distance filter for a normal run', async () => {
    const service = new DeviceLocationService(); await service.start(false, false, vi.fn(), vi.fn());
    expect(mocks.watch.mock.calls[0]![0]).toEqual({ accuracy: 5, distanceInterval: 2, timeInterval: 1000 });
    expect(mocks.requestBackground).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled(); await service.stop();
  });
  it('requests stationary fixes for optional auto-pause instead of relying on silent GPS gaps', async () => {
    const service = new DeviceLocationService(); await service.start(false, true, vi.fn(), vi.fn());
    expect(mocks.watch.mock.calls[0]![0].distanceInterval).toBe(0); await service.stop();
  });
  it('configures the native background fitness task, batching, and system location indicator', async () => {
    const service = new DeviceLocationService(); expect(await service.start(true, true, vi.fn(), vi.fn())).toBe(true);
    expect(mocks.start).toHaveBeenCalledWith('test.location', expect.objectContaining({ accuracy: 5, activityType: 3, distanceInterval: 0,
      deferredUpdatesInterval: 3000, pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true }));
    expect(mocks.watch).not.toHaveBeenCalled();
  });
  it('explains a refused Always permission without silently claiming background tracking', async () => {
    mocks.background.mockResolvedValue({ granted: false }); mocks.requestBackground.mockResolvedValue({ granted: false });
    await expect(new DeviceLocationService().start(true, false, vi.fn(), vi.fn())).rejects.toThrow('Toujours');
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it('obtains Always permission during preparation before the session starts its clock', async () => {
    mocks.background.mockResolvedValue({ granted: false }); mocks.requestBackground.mockResolvedValue({ granted: true });
    await new DeviceLocationService().ensureForeground(true);
    expect(mocks.requestBackground).toHaveBeenCalledOnce(); expect(mocks.start).not.toHaveBeenCalled();
  });
  it('discards callbacks from a subscription that has been stopped', async () => {
    const service = new DeviceLocationService(), receive = vi.fn(), error = vi.fn();
    await service.start(false, false, receive, error);
    const onFix = mocks.watch.mock.calls[0]![1], onError = mocks.watch.mock.calls[0]![2]; onFix(sample);
    await service.stop(); onFix(sample); onError('late error');
    expect(receive).toHaveBeenCalledTimes(1); expect(error).not.toHaveBeenCalled(); expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it('removes a foreground subscription whose asynchronous start resolves after cancellation', async () => {
    let resolve!: (value: { remove: () => void }) => void;
    mocks.watch.mockReturnValue(new Promise(value => { resolve = value; }));
    const service = new DeviceLocationService(), pending = service.start(false, false, vi.fn(), vi.fn());
    await service.stop(); resolve({ remove: mocks.remove });
    await expect(pending).rejects.toThrow('écran'); expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it('stops a native background task whose start resolves after cancellation', async () => {
    let resolve!: () => void;
    mocks.start.mockReturnValue(new Promise<void>(value => { resolve = value; }));
    const service = new DeviceLocationService(), pending = service.start(true, false, vi.fn(), vi.fn());
    await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledOnce()); await service.stop(); resolve();
    await expect(pending).rejects.toThrow('annulé'); expect(mocks.stop).toHaveBeenCalledWith('test.location');
  });
  it('checks permissions again after returning to foreground', async () => {
    mocks.background.mockResolvedValue({ granted: false }); await expect(new DeviceLocationService().checkAccess(true)).rejects.toThrow('Toujours');
    mocks.foreground.mockResolvedValue({ granted: false }); await expect(new DeviceLocationService().checkAccess(false)).rejects.toThrow('refusée');
  });
  it('attempts native background cleanup even if a foreground remove throws, then allows retry', async () => {
    const service = new DeviceLocationService(); await service.start(false, false, vi.fn(), vi.fn());
    mocks.remove.mockImplementationOnce(() => { throw new Error('remove failed'); }); mocks.hasStarted.mockResolvedValue(true);
    await expect(service.stop()).rejects.toThrow('remove failed'); expect(mocks.stop).toHaveBeenCalledOnce();
    await service.stop(); expect(mocks.remove).toHaveBeenCalledTimes(2);
  });
});
