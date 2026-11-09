import type { ExportDocument } from '../analysis/export/types';
export async function shareDocument(document: ExportDocument): Promise<void> {
  const blob = new Blob([typeof document.data === 'string' ? document.data : new Uint8Array(document.data).buffer], { type: document.mimeType });
  const url = URL.createObjectURL(blob), link = window.document.createElement('a');
  link.href = url; link.download = document.filename; window.document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
