// Import d'une image pour l'avatar ou la bannière (§17.8) : sélection, réencodage JPEG (orientation
// corrigée, métadonnées et position retirées), taille bornée, copie dans le dossier du titulaire.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { LocalMedia } from './localStore';
import type { ProfileFiles } from './remote';

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = { avatar: 1024, banner: 1800, gallery: 1600 } as const;
const extension = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg');
const folder = (owner: string) => {
  const directory = new Directory(Paths.document, 'profile', owner);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
};

export type PickResult = { media: LocalMedia } | { error: string } | null;

export async function pickProfileImage(owner: string, id: string, usage: LocalMedia['usage'], now: number): Promise<PickResult> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsEditing: false });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  try {
    const max = MAX_SIDE[usage];
    const context = ImageManipulator.manipulate(asset.uri);
    if (asset.width > max || asset.height > max) context.resize(asset.width >= asset.height ? { width: max } : { height: max });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    const target = new File(folder(owner), `${id}.jpg`);
    if (target.exists) target.delete();
    new File(saved.uri).move(target);
    const bytes = target.size ?? 0;
    if (!bytes || bytes > IMAGE_MAX_BYTES) { target.delete(); return { error: 'Cette image est trop lourde, même après compression (5 Mo au plus).' }; }
    return { media: { id, usage, mime: 'image/jpeg', bytes, width: saved.width, height: saved.height, uri: target.uri, path: null, state: 'local', createdAt: now } };
  } catch {
    return { error: 'Cette image n’a pas pu être lue. Essayez une photo au format JPEG, PNG ou HEIC.' };
  }
}

export const profileFiles: ProfileFiles = {
  async read(uri) { return new Uint8Array(await new File(uri).arrayBuffer()); },
  async write(owner, id, mime, bytes) {
    const target = new File(folder(owner), `${id}.${extension(mime)}`);
    if (target.exists) target.delete();
    target.create();
    target.write(bytes);
    return target.uri;
  },
};

/** Supprime les fichiers locaux d'un titulaire (compte supprimé). */
export function removeOwnerFiles(owner: string) {
  try { const directory = new Directory(Paths.document, 'profile', owner); if (directory.exists) directory.delete(); } catch { /* déjà absent */ }
}
export function removeMediaFile(uri: string | null) {
  if (!uri) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* déjà absent */ }
}
