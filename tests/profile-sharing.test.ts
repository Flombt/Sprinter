import { describe, expect, it } from 'vitest';
import { WithdrawalQueue, linkFor, parseLink, snapshotsFor, type Withdrawal } from '../src/profile/sharingModel';
import { widgetKey } from '../src/profile/model';
import type { RunRecord } from '../src/core/types';

const NOW = Date.parse('2026-11-14T10:00:00Z');
const run = (startedAt: number, meters: number) => ({ id: String(startedAt), startedAt, endedAt: startedAt + 1800_000, activeSeconds: 1800, distanceMeters: meters, points: [], splits: [] }) as unknown as RunRecord;

describe('partage du profil (8c)', () => {
  it('lien : complet ou code seul', () => {
    const token = 'AbCdEfGhIjKlMnOpQrStUvWx-_12';
    expect(parseLink(linkFor(token))).toBe(token);
    expect(parseLink(`  ${token} `)).toBe(token);
    expect(parseLink('https://exemple.fr/?t=court')).toBeNull();
  });

  it('valeurs calculées : seulement les widgets montrés, valeur + libellé + période, objectif manuel exclu', () => {
    const shown = widgetKey('00000000-0000-4000-8000-000000000001'), hidden = widgetKey('00000000-0000-4000-8000-000000000002');
    const goal = widgetKey('00000000-0000-4000-8000-000000000003'), manual = widgetKey('00000000-0000-4000-8000-000000000004');
    const doc = {
      [shown]: { type: 'stats', stats: ['runs', 'distance'] }, [hidden]: { type: 'stats', stats: ['runs'] },
      [goal]: { type: 'goal', label: 'Mois', target: 100, source: 'distance_month' }, [manual]: { type: 'goal', label: 'Manuel', target: 10, progress: 3 },
    };
    const visibility = { [shown]: 'audience', [hidden]: 'owner', [goal]: 'audience', [manual]: 'audience' };
    const { snapshots, preview } = snapshotsFor(doc, visibility, [run(Date.parse('2026-11-02T08:00:00Z'), 10_000)], NOW);
    expect(Object.keys(snapshots).sort()).toEqual([shown, goal].sort());
    expect(snapshots[shown]).toEqual({ values: [
      { id: 'runs', label: 'Courses', value: '1', period: 'Depuis la première course' },
      { id: 'distance', label: 'Distance cumulée', value: '10 km', period: 'Depuis la première course' },
    ] });
    expect(snapshots[goal]).toEqual({ progress: 10 });
    expect(JSON.stringify(snapshots)).not.toMatch(/startedAt|latitude|points/);
    expect(preview.map((item) => item.label)).toEqual(['Courses', 'Distance cumulée', 'Mois']);
  });

  it('retrait hors ligne : gardé, affiché, rejoué dans l’ordre au retour du réseau', async () => {
    let stored: string | null = null;
    let online = false;
    const done: Withdrawal[] = [];
    const network = new Error('TypeError: Network request failed');
    const queue = new WithdrawalQueue({ get: async () => stored, set: async (value) => { stored = value; } },
      async (withdrawal) => { if (!online) throw network; done.push(withdrawal); }, (error) => error === network);
    expect(await queue.attempt({ type: 'hide', key: 'about' })).toBe('queued');
    expect(await queue.attempt({ type: 'private' })).toBe('queued');
    expect(await queue.attempt({ type: 'hide', key: 'about' })).toBe('queued');
    expect(await queue.list()).toEqual([{ type: 'private' }, { type: 'hide', key: 'about' }]);
    await expect(queue.flush()).rejects.toBe(network);
    online = true;
    await queue.flush();
    expect(done).toEqual([{ type: 'private' }, { type: 'hide', key: 'about' }]);
    expect(stored).toBeNull();
    const failing = new WithdrawalQueue({ get: async () => JSON.stringify([{ type: 'revoke' }]), set: async (value) => { stored = value; } },
      async () => { throw new Error('feature_disabled'); }, () => false);
    await failing.flush();
    expect(stored).toBeNull();
  });
});
