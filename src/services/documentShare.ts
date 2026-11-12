import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { ExportDocument } from '../analysis/export/types';

let sharing = false;

export async function shareDocument(document: ExportDocument): Promise<void> {
  if (sharing) throw new Error('Un partage de fichier est déjà ouvert.');
  sharing = true;
  try {
    if (!await Sharing.isAvailableAsync()) throw new Error('Le partage de fichiers est indisponible sur cet appareil.');
    const directory = new Directory(Paths.cache, 'sprinter-exports');
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, document.filename);
    file.create({ overwrite: true });
    await file.write(document.data);
    const fileType = Platform.OS === 'ios' && document.mimeType === 'application/gpx+xml'
      ? { UTI: 'com.topografix.gpx' } : { mimeType: document.mimeType };
    await Sharing.shareAsync(file.uri, { ...fileType, dialogTitle: 'Partager la copie choisie' });
  } finally {
    sharing = false;
  }
}
