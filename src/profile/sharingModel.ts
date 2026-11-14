// Logique pure du partage (8c) : liens, valeurs calculées à confirmer, file des retraits faits hors ligne.
import type { RunRecord } from '../core/types';
import { computeStats, goalProgress, type ProfileDoc, type StatId, type WidgetPayload } from './model';

export type SharingMode = 'private' | 'link' | 'members';
export type Withdrawal = { type: 'private' } | { type: 'hide'; key: string } | { type: 'revoke' } | { type: 'unsearchable'; mode: SharingMode; handle: string | null; presence: 'nobody' | 'audience' };

export const linkFor = (token: string) => `sprinter://profil?t=${token}`;
/** Accepte un lien complet ou le code seul. */
export function parseLink(input: string): string | null {
  const match = /(?:[?&#]t=)?([A-Za-z0-9_-]{16,64})\s*$/.exec(input.trim());
  return match ? match[1]! : null;
}

export const STAT_PERIODS: Record<StatId, string> = {
  seniority: 'Première course Sprinter enregistrée', runs: 'Depuis la première course', distance: 'Depuis la première course', best_effort: 'Meilleur segment GPS',
};
/** Valeurs calculées sur l'appareil, à confirmer avant de les rendre visibles (§17.5) : valeur, libellé, période. */
export function snapshotsFor(doc: ProfileDoc, visibility: Record<string, string>, history: RunRecord[], now: number) {
  const snapshots: Record<string, unknown> = {};
  const preview: { key: string; label: string; value: string }[] = [];
  for (const key of Object.keys(doc).filter((item) => item.startsWith('widget:') && doc[item] && visibility[item] === 'audience').sort()) {
    const widget = doc[key] as unknown as WidgetPayload;
    if (widget.type === 'stats') {
      const values = computeStats(history, widget.stats ?? [], now).map((stat) => ({ id: stat.id, label: stat.label, value: stat.value, period: STAT_PERIODS[stat.id] }));
      snapshots[key] = { values };
      for (const value of values) preview.push({ key, label: value.label, value: value.value });
    } else if (widget.type === 'goal' && (widget.source ?? 'manual') !== 'manual') {
      const progress = goalProgress(widget, history, now).value;
      snapshots[key] = { progress };
      preview.push({ key, label: widget.label || 'Objectif', value: String(progress) });
    }
  }
  return { snapshots, preview };
}

export interface WithdrawalStore { get(): Promise<string | null>; set(value: string | null): Promise<void> }
/** Retraits (rendre privé, masquer, révoquer, quitter la recherche) gardés hors ligne et rejoués dans l'ordre. */
export class WithdrawalQueue {
  constructor(private store: WithdrawalStore, private run: (withdrawal: Withdrawal) => Promise<void>, private isNetwork: (error: unknown) => boolean) {}
  async list(): Promise<Withdrawal[]> {
    const raw = await this.store.get();
    try { return raw ? JSON.parse(raw) as Withdrawal[] : []; } catch { return []; }
  }
  async add(withdrawal: Withdrawal) {
    const pending = await this.list();
    await this.store.set(JSON.stringify([...pending.filter((item) => JSON.stringify(item) !== JSON.stringify(withdrawal)), withdrawal]));
  }
  /** Tente l'action ; hors ligne, la garde et renvoie 'queued'. Les autres erreurs remontent. */
  async attempt(withdrawal: Withdrawal): Promise<'done' | 'queued'> {
    try { await this.run(withdrawal); return 'done'; }
    catch (error) {
      if (!this.isNetwork(error)) throw error;
      await this.add(withdrawal);
      return 'queued';
    }
  }
  /** Rejoue la file ; s'arrête (et relance l'erreur) au premier échec réseau. */
  async flush() {
    let pending = await this.list();
    while (pending.length) {
      try { await this.run(pending[0]!); }
      catch (error) { if (this.isNetwork(error)) throw error; }
      pending = pending.slice(1);
      await this.store.set(pending.length ? JSON.stringify(pending) : null);
    }
  }
}
