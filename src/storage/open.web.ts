import { DEFAULT_SETTINGS, RunRecord, Settings } from '../core/types';
import { Draft, parseRun, StorageRepository, type DraftArchive } from './repository';

interface BrowserData { version: 1; history: RunRecord[]; draft: Draft | null; settings: Settings; archives?: DraftArchive[] }
class BrowserRepository implements StorageRepository {
  unreadableCount = 0;
  private key = 'sprinter.web.v1';
  private closed = new Set<string>();
  private read(): BrowserData {
    const raw = localStorage.getItem(this.key);
    if (!raw) return { version: 1, history: [], draft: null, settings: DEFAULT_SETTINGS };
    const data: BrowserData = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.history)) throw new Error('Stockage du navigateur illisible.');
    return data;
  }
  private save(data: BrowserData) { localStorage.setItem(this.key, JSON.stringify(data)); }
  async initialize() { this.read(); }
  async history() { this.unreadableCount = 0; return this.read().history.flatMap(r => { try { return [parseRun(JSON.stringify(r))]; } catch { this.unreadableCount++; return []; } }).sort((a, b) => b.startedAt - a.startedAt); }
  async loadDraft() { const draft = this.read().draft; if (draft) draft.run = parseRun(JSON.stringify(draft.run)); return draft; }
  async archiveDraft() {
    const data = this.read();
    if (!data.draft) return null;
    if (data.archives !== undefined && !Array.isArray(data.archives)) throw new Error('Archives de récupération illisibles. Les données restent conservées.');
    const archivedAt = Date.now(), id = archivedAt.toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const payload = JSON.stringify({ format: 'sprinter-recovery-v1', archivedAt, draft: data.draft });
    data.archives = [...(data.archives ?? []), { id, archivedAt, payload }];
    const sessionId = data.draft.run?.id;
    data.draft = null; this.save(data);
    if (sessionId) this.closed.add(sessionId);
    return id;
  }
  async listDraftArchives() {
    const archives = this.read().archives ?? [];
    if (!Array.isArray(archives)) throw new Error('Archives de récupération illisibles.');
    return archives.map(({ id, archivedAt, payload }) => ({ id, archivedAt, bytes: new Blob([payload]).size })).sort((a, b) => b.archivedAt - a.archivedAt);
  }
  async loadDraftArchive(id: string) { return (this.read().archives ?? []).find(archive => archive.id === id) ?? null; }
  async saveDraft(draft: Draft) {
    const data = this.read();
    if (this.closed.has(draft.run.id) || data.history.some(r => r.id === draft.run.id) ||
      (data.draft?.run.id === draft.run.id && data.draft.revision > draft.revision)) return;
    data.draft = draft; this.save(data);
  }
  async finish(run: RunRecord) {
    if (run.endedAt === null) throw new Error('Course non terminée.');
    const data = this.read(); data.history = [run, ...data.history.filter(r => r.id !== run.id)];
    if (data.draft?.run.id === run.id) data.draft = null;
    this.save(data); this.closed.add(run.id);
  }
  async deleteRun(id: string) { const data = this.read(); data.history = data.history.filter(r => r.id !== id); this.save(data); }
  async purgeLocalRuns() { const data = this.read(); data.history = []; this.save(data); }
  async loadSettings() {
    const settings = this.read().settings ?? DEFAULT_SETTINGS;
    return { ...settings, appearance: settings.appearance ?? DEFAULT_SETTINGS.appearance };
  }
  async saveSettings(settings: Settings) { const data = this.read(); data.settings = settings; this.save(data); }
}
export async function openRepository(): Promise<StorageRepository> { return new BrowserRepository(); }
