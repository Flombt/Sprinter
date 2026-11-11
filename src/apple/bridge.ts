import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { IS_EXPO_GO, IS_SIDELOAD_BUILD } from '../services/capabilities';
import type { HealthCapabilities, HealthPage, HealthWrite } from './types';
interface NativeApple {
  capabilities(): HealthCapabilities;
  prepareStorage(directory: string): Promise<HealthCapabilities>;
  requestAuthorization(read: boolean, write: boolean): Promise<HealthCapabilities>;
  writeWorkout(payload: string): Promise<string>;
  readWorkouts(from: number, until: number, anchor: string | null): Promise<string>;
}
export const nativeApple = Platform.OS === 'ios' && !IS_EXPO_GO && !IS_SIDELOAD_BUILD ? requireOptionalNativeModule<NativeApple>('SprinterApple') : null;
export const APPLE_BUILD_REQUIRED = IS_SIDELOAD_BUILD
  ? 'Santé et l’affichage verrouillé sont indisponibles dans cette version de test à signature gratuite. La course, le coach et les exports locaux restent disponibles.'
  : 'Cette intégration exige une version iOS installée incluant les modules Apple. Expo Go conserve la course et les exports locaux.';
export const unavailableCapabilities: HealthCapabilities = { available: false, workoutWrite: 'notDetermined', distanceWrite: 'notDetermined', liveAllowed: false, backupProtected: false };
export async function writeHealthWorkout(payload: HealthWrite): Promise<{ uuid: string; alreadyExists: boolean }> {
  if (!nativeApple) throw new Error(APPLE_BUILD_REQUIRED);
  return JSON.parse(await nativeApple.writeWorkout(JSON.stringify(payload)));
}
export async function readHealthWorkouts(from: number, until: number, anchor: string | null): Promise<HealthPage> {
  if (!nativeApple) throw new Error(APPLE_BUILD_REQUIRED);
  return JSON.parse(await nativeApple.readWorkouts(from, until, anchor));
}
