import * as Location from 'expo-location';
import type { RouteCoordinate } from '../routes/types';
import { validCoordinate } from '../routes/geometry';
export interface WeatherSnapshot {
  provider: string; attributionURL: string; latitude: number; longitude: number; fetchedAt: number; validAt: number; intervalSeconds: number;
  temperature: number; precipitation: number; wind: number; gusts: number; code: number;
}
export interface WeatherProvider { fetch(position: RouteCoordinate, signal: AbortSignal): Promise<WeatherSnapshot> }
let cached: WeatherSnapshot | null = null;
export const openMeteo: WeatherProvider = {
  async fetch(position, signal) {
    if (!__DEV__) throw new Error('Le service météo doit être configuré avec une licence adaptée à cette version.');
    if (signal.aborted) throw new Error('Consultation annulée.');
    if (!validCoordinate(position)) throw new Error('Zone météo indisponible.');
    // Deliberate coarse rounding: no trajectory, identifier or exact departure point is sent.
    const latitude = Math.round(position.latitude * 100) / 100, longitude = Math.round(position.longitude * 100) / 100;
    if (cached && cached.latitude === latitude && cached.longitude === longitude && Date.now() - cached.fetchedAt < 600000) return cached;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timeformat=unixtime&forecast_days=1`;
    const controller = new AbortController(), abort = () => controller.abort(); signal.addEventListener('abort', abort);
    if (signal.aborted) controller.abort();
    const timer = setTimeout(abort, 10000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Le service météo est temporairement indisponible.');
      const raw = await response.text(); if (raw.length > 100000) throw new Error('Réponse météo trop volumineuse.');
      const value = JSON.parse(raw), data = value.current, units = value.current_units;
      if (!data || !units || units.temperature_2m !== '°C' || units.precipitation !== 'mm' || units.wind_speed_10m !== 'km/h' || units.wind_gusts_10m !== 'km/h' ||
        ![data.temperature_2m, data.precipitation, data.wind_speed_10m, data.wind_gusts_10m, data.weather_code, data.time, data.interval].every(Number.isFinite) ||
        data.temperature_2m < -90 || data.temperature_2m > 65 || data.precipitation < 0 || data.precipitation > 500 || data.wind_speed_10m < 0 || data.wind_gusts_10m < 0 ||
        data.wind_speed_10m > 500 || data.wind_gusts_10m > 500 || !Number.isInteger(data.weather_code) || data.weather_code < 0 || data.weather_code > 99 || data.interval <= 0 || data.interval > 3600 || Math.abs(Date.now() - data.time * 1000) > 7200000) throw new Error('Données météo absentes, anciennes ou incompatibles.');
      cached = { provider: 'Open-Meteo', attributionURL: 'https://open-meteo.com/', latitude, longitude, fetchedAt: Date.now(), validAt: data.time * 1000, intervalSeconds: data.interval,
        temperature: data.temperature_2m, precipitation: data.precipitation, wind: data.wind_speed_10m, gusts: data.wind_gusts_10m, code: data.weather_code };
      return cached;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  },
};
// The public free endpoint is for this personal development build. A distributed commercial
// product must supply a suitably licensed provider rather than silently using the free tier.
export const configuredWeatherProvider: WeatherProvider | null = __DEV__ ? openMeteo : null;
export async function weatherPosition(signal: AbortSignal): Promise<RouteCoordinate> {
  const current = await Location.getForegroundPermissionsAsync();
  const permission = current.granted ? current : await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('La météo près de vous nécessite votre accord de localisation. Vous pouvez consulter celle du départ d’un parcours choisi.');
  if (signal.aborted) throw new Error('Consultation annulée.');
  return new Promise((resolve, reject) => {
    let finished = false; let subscription: Location.LocationSubscription | null = null;
    const finish = (point?: RouteCoordinate, error?: Error) => {
      if (finished) return; finished = true; clearTimeout(timer); signal.removeEventListener('abort', aborted); subscription?.remove();
      if (point) resolve(point); else reject(error ?? new Error('Position météo indisponible.'));
    };
    const aborted = () => finish(undefined, new Error('Consultation annulée.'));
    const timer = setTimeout(() => finish(undefined, new Error('Position météo indisponible. Le départ de la course reste accessible.')), 12000);
    signal.addEventListener('abort', aborted);
    void Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 1000 }, value => {
      const age = Date.now() - value.timestamp;
      if (age >= -1000 && age <= 30000 && validCoordinate(value.coords) && value.coords.accuracy !== null && value.coords.accuracy >= 0 && value.coords.accuracy <= 5000) finish(value.coords);
    }, () => finish()).then(value => { subscription = value; if (finished) value.remove(); }).catch(error => finish(undefined, error instanceof Error ? error : new Error(String(error))));
  });
}
export function weatherLabel(code: number): string {
  if (code === 0) return 'Ciel dégagé'; if (code <= 3) return 'Nuages / éclaircies'; if ([45, 48].includes(code)) return 'Brouillard';
  if ([56, 57, 66, 67].includes(code)) return 'Précipitations verglaçantes'; if ([51, 53, 55].includes(code)) return 'Bruine';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'Pluie / averses'; if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Neige';
  if ([95, 96, 99].includes(code)) return 'Orages possibles'; return 'Conditions non classées';
}
export function weatherAdvice(value: WeatherSnapshot): string[] {
  const items: string[] = [];
  if (value.temperature >= 28) items.push('Chaleur annoncée : envisagez une sortie plus fraîche et adaptée à vos sensations.');
  if (value.temperature <= 0 || [56, 57, 66, 67].includes(value.code)) items.push('Froid ou gel possibles : vérifiez l’adhérence et les conditions locales avant de partir.');
  if (value.precipitation > 0 || [61, 63, 65, 80, 81, 82].includes(value.code)) items.push('Pluie possible : sol et visibilité peuvent être dégradés.');
  if (value.wind >= 30 || value.gusts >= 50) items.push('Vent soutenu annoncé : consultez les bulletins locaux et adaptez votre parcours.');
  if ([95, 96, 99].includes(value.code)) items.push('Orages possibles : consultez les vigilances officielles avant votre départ.');
  return items;
}
