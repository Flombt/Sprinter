import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { importGPX, MAX_GPX_BYTES } from './gpx';
export async function pickGPX() {
  // Some iOS document providers do not advertise a GPX MIME type. Validate the content ourselves.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0]; if (!asset) return null;
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > MAX_GPX_BYTES) throw new Error('Le fichier dépasse la limite de 2 Mo.');
    return importGPX(await file.text(), asset.name);
  } finally {
    // Only our copied cache file may be removed; never delete a document provider's original.
    const prefix = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
    if (file.uri.startsWith(prefix)) { try { file.delete(); } catch {} }
  }
}
