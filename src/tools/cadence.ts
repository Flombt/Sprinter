import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { IS_EXPO_GO } from '../services/capabilities';
export interface CadenceCapabilities { available: boolean; permission: 'authorized' | 'denied' | 'notDetermined' }
interface CadenceBridge {
  capabilities(): CadenceCapabilities; requestAuthorization(): Promise<CadenceCapabilities>; start(): Promise<void>; stop(): Promise<void>;
  addListener(name: 'onCadence', listener: (event: { spm: number | null; timestamp: number }) => void): { remove(): void };
}
export const cadenceBridge = Platform.OS === 'ios' && !IS_EXPO_GO ? requireOptionalNativeModule<CadenceBridge>('SprinterCadence') : null;
export const emptyCadenceCapabilities: CadenceCapabilities = { available: false, permission: 'notDetermined' };
export class CadenceSensor {
  private enabled = false; private generation = 0; private subscription: { remove(): void } | null = null;
  private queue: Promise<void> = Promise.resolve();
  constructor(private onValue: (value: { spm: number; timestamp: number } | null) => void, private onError: (message: string) => void) {}
  configure(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled; const generation = ++this.generation;
    if (!enabled) { this.subscription?.remove(); this.subscription = null; this.onValue(null); }
    const task = this.queue.then(async () => {
      if (!cadenceBridge) return;
      await cadenceBridge.stop();
      this.subscription?.remove(); this.subscription = null;
      if (!enabled || generation !== this.generation) return;
      this.subscription = cadenceBridge.addListener('onCadence', event => {
        if (generation !== this.generation || !this.enabled) return;
        const age = Date.now() - event.timestamp;
        this.onValue(event.spm !== null && Number.isFinite(event.spm) && event.spm >= 40 && event.spm <= 300 && Number.isFinite(event.timestamp) && age >= -1000 && age <= 10000 ? { spm: event.spm, timestamp: event.timestamp } : null);
      });
      await cadenceBridge.start();
      if (generation !== this.generation) await cadenceBridge.stop();
    });
    this.queue = task.catch(error => { this.subscription?.remove(); this.subscription = null; this.onValue(null); this.onError(`Cadence indisponible : ${error instanceof Error ? error.message : String(error)}.`); });
  }
}
