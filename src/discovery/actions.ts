import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import {
  publicHttps,
  validPoint,
  type DiscoveryItem,
} from '../../supabase/functions/_shared/discovery-model';

export async function openOfficial(url: string) {
  if (!publicHttps(url)) throw new Error('Ce lien est indisponible.');
  if (Platform.OS === 'web') await Linking.openURL(url);
  else await WebBrowser.openBrowserAsync(url);
}

export async function directions(item: DiscoveryItem) {
  const destination = item.point
    ? `${item.point.latitude},${item.point.longitude}`
    : [item.address ?? item.venue ?? item.title, item.city].join(', ');
  const target = encodeURIComponent(destination);
  await Linking.openURL(
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${target}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${target}&travelmode=walking`,
  );
}

export async function shareDiscovery(item: DiscoveryItem): Promise<string | undefined> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: item.title, url: item.officialUrl });
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
      }
      return;
    }
    if (await Clipboard.setStringAsync(item.officialUrl)) return 'Lien officiel copié.';
    throw new Error('Le partage est indisponible sur ce navigateur.');
  }
  await Share.share(
    Platform.OS === 'ios'
      ? { message: item.title, url: item.officialUrl }
      : { message: `${item.title}\n${item.officialUrl}` },
  );
}

export async function discoveryPosition() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error('Localisation refusée. Tu peux continuer avec le secteur sélectionné.');
  const cached = await Location.getLastKnownPositionAsync({ maxAge: 300_000, requiredAccuracy: 1000 }).catch(
    () => null,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result =
      cached ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Position indisponible. Réessaie ou choisis un secteur.')),
            8000,
          );
        }),
      ]));
    const point = { latitude: result.coords.latitude, longitude: result.coords.longitude };
    if (!validPoint(point)) throw new Error('Position indisponible.');
    return point;
  } finally {
    clearTimeout(timer);
  }
}
