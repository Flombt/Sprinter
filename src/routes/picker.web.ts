import * as DocumentPicker from 'expo-document-picker';
import { importGPX, MAX_GPX_BYTES } from './gpx';
export async function pickGPX() {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0]; if (!asset?.file) throw new Error('Lecture du fichier indisponible dans cet aperçu.');
  if (asset.file.size > MAX_GPX_BYTES) throw new Error('Le fichier dépasse la limite de 2 Mo.');
  return importGPX(await asset.file.text(), asset.name);
}
