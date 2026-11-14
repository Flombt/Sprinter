import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { accountKv } from './kv';

const DEVICE_KEY = 'device.id.v1';
let cached: Promise<string> | null = null;

/** Identifiant d'installation (§6.3) : généré une fois, jamais dérivé du matériel. */
export function deviceId(): Promise<string> {
  cached ??= (async () => {
    const existing = await accountKv.get(DEVICE_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const fresh = randomUUID();
    await accountKv.set(DEVICE_KEY, fresh);
    return fresh;
  })();
  return cached;
}

export function devicePlatform(): 'ios' | 'android' | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

export const appVersion = (): string => Constants.expoConfig?.version ?? '0.0.0';
export const osVersion = (): string => String(Platform.Version ?? '').slice(0, 32);

/** Jour local de l'appareil au format AAAA-MM-JJ (mesure d'usage §5). */
export function localDay(date = new Date()): string {
  const year = date.getFullYear(), month = String(date.getMonth() + 1).padStart(2, '0'), day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function timeZone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null; } catch { return null; }
}
