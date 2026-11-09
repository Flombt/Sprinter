import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ExportDocument } from '../analysis/export/types';
export async function shareDocument(document: ExportDocument): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Le partage de fichiers est indisponible sur cet appareil.');
  const directory = new Directory(Paths.cache, 'sprinter-exports');
  await directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, document.filename);
  await file.create({ overwrite: true }); await file.write(document.data);
  await Sharing.shareAsync(file.uri, { mimeType: document.mimeType, dialogTitle: 'Partager la copie choisie' });
}
