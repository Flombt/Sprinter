import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { GPSFix } from '../core/types';
import { CAN_BACKGROUND, LOCATION_TASK } from './capabilities';

export interface LocationService {
  readonly canBackground: boolean;
  ensureForeground(background?: boolean): Promise<void>;
  checkAccess(background: boolean): Promise<void>;
  start(background: boolean, autoPause: boolean, receive: (locations: Location.LocationObject[]) => void, error: (message: string) => void): Promise<boolean>;
  stop(): Promise<void>;
}
export function locationFix(location: Location.LocationObject): GPSFix | null {
  if (!location?.coords) return null;
  const c = location.coords;
  return { latitude: c.latitude, longitude: c.longitude, timestamp: location.timestamp, accuracy: c.accuracy ?? -1,
    speed: c.speed, altitude: c.altitude, altitudeAccuracy: c.altitudeAccuracy };
}
/** Expo Location delegates to CLLocationManager on iOS. Only this adapter owns native subscriptions. */
export class DeviceLocationService implements LocationService {
  readonly canBackground = CAN_BACKGROUND;
  private subscription: Location.LocationSubscription | null = null; private generation = 0;
  async checkAccess(background: boolean) {
    if (!await Location.hasServicesEnabledAsync()) throw new Error('Activez les services de localisation de l’iPhone pour enregistrer votre course.');
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Localisation refusée. Autorisez Sprinter dans les réglages de l’iPhone.');
    if (permission.ios?.accuracy === 'reduced') throw new Error('Activez « Position exacte » dans les réglages de localisation pour mesurer votre allure.');
    if (background && !(await Location.getBackgroundPermissionsAsync()).granted) throw new Error('Le suivi écran verrouillé nécessite l’autorisation de localisation « Toujours ».');
  }
  private async ensureBackground() {
    const current = await Location.getBackgroundPermissionsAsync();
    const permission = current.granted ? current : current.canAskAgain === false ? current : await Location.requestBackgroundPermissionsAsync();
    if (!permission.granted) throw new Error('Le suivi écran verrouillé nécessite « Toujours » dans les réglages de localisation. Vous pouvez désactiver ce mode dans Réglages.');
  }
  async ensureForeground(background = false) {
    if (!await Location.hasServicesEnabledAsync()) throw new Error('Activez les services de localisation de l’iPhone pour commencer.');
    const current = await Location.getForegroundPermissionsAsync();
    const permission = current.granted || current.canAskAgain === false ? current : await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Autorisez la localisation dans les réglages de l’iPhone pour enregistrer votre course.');
    if (permission.ios?.accuracy === 'reduced') throw new Error('Activez « Position exacte » dans les réglages de localisation pour mesurer votre allure.');
    if (background && this.canBackground) await this.ensureBackground();
  }
  async start(background: boolean, autoPause: boolean, receive: (locations: Location.LocationObject[]) => void, error: (message: string) => void) {
    if (this.subscription) throw new Error('Un suivi GPS est déjà actif. Mettez-le en pause avant de recommencer.');
    const generation = ++this.generation;
    // Highest avoids navigation-specific extra sensors. iOS controls delivery cadence.
    const options = { accuracy: Location.Accuracy.Highest, distanceInterval: autoPause ? 0 : 2, timeInterval: 1000 };
    if (background && this.canBackground) {
      await this.ensureBackground();
      if (generation !== this.generation) throw new Error('Démarrage de la localisation annulé.');
      if (AppState.currentState === 'background') throw new Error('Revenez dans Sprinter pour démarrer le suivi de votre course.');
      await Location.startLocationUpdatesAsync(LOCATION_TASK, { ...options, activityType: Location.ActivityType.Fitness,
        deferredUpdatesInterval: 3000, pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true });
      if (generation !== this.generation) { await Location.stopLocationUpdatesAsync(LOCATION_TASK); throw new Error('Démarrage de la localisation annulé.'); }
      return true;
    }
    const subscription = await Location.watchPositionAsync(options, location => { if (generation === this.generation) receive([location]); },
      message => { if (generation === this.generation) error(message); });
    if (generation !== this.generation || AppState.currentState === 'background') {
      subscription.remove(); throw new Error('Gardez Sprinter à l’écran pour démarrer ou reprendre dans ce mode.');
    }
    this.subscription = subscription; return false;
  }
  async stop() {
    this.generation++; let failure: unknown;
    try { this.subscription?.remove(); this.subscription = null; } catch (error) { failure = error; }
    try { if (this.canBackground && await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK); }
    catch (error) { failure ??= error; }
    if (failure) throw failure;
  }
}
