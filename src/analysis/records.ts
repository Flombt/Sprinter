import type { RunRecord, TrackPoint } from '../core/types';
import { sanitizeConfig } from '../core/coach';
import { cleanTrack, EPS } from './track';
import { RECORD_DISTANCES, type PersonalRecord, type RecordPerformance } from './types';

interface Node { point: TrackPoint; meters: number; active: number; elapsed: number; timestamp: number }
interface Chunk { nodes: Node[]; timing: RecordPerformance['timing'] }
function recordChunks(run: RunRecord): Chunk[] {
  const result: Chunk[] = [];
  for (const segment of cleanTrack(run, { maximumAccuracy: 15, maximumGap: 6 }).segments) {
    let nodes: Node[] = [], timing: Chunk['timing'] | null = null;
    const flush = () => { if (nodes.length >= 2) result.push({ nodes, timing: timing! }); nodes = []; };
    for (const p of segment) {
      const source = p.totalSeconds !== undefined && Number.isFinite(p.totalSeconds) && p.totalSeconds >= p.activeSeconds - .01 ? 'monotonic' : 'timestamps';
      const elapsed = source === 'monotonic' ? p.totalSeconds! : p.fix.timestamp / 1000;
      const previous = nodes.at(-1);
      if (previous && (source !== timing || elapsed <= previous.elapsed || p.activeSeconds < previous.active ||
          Math.abs((elapsed - previous.elapsed) - (p.activeSeconds - previous.active)) > Math.max(.25, (elapsed - previous.elapsed) * .1))) flush();
      timing = source; nodes.push({ point: p, meters: p.meters, active: p.activeSeconds, elapsed, timestamp: p.fix.timestamp });
    }
    flush();
  }
  return result;
}
function interpolate(a: Node, b: Node, meters: number): Node {
  if (Math.abs(b.meters - a.meters) < EPS) return a;
  const ratio = Math.max(0, Math.min(1, (meters - a.meters) / (b.meters - a.meters)));
  return { point: a.point, meters, active: a.active + ratio * (b.active - a.active), elapsed: a.elapsed + ratio * (b.elapsed - a.elapsed), timestamp: a.timestamp + ratio * (b.timestamp - a.timestamp) };
}
/** Both start-aligned and end-aligned windows are needed for an exact minimum on a piecewise-linear distance curve. */
export function bestMeasuredSegment(run: RunRecord, meters: number, chunks = recordChunks(run)): RecordPerformance | null {
  if (run.endedAt === null || !Number.isFinite(run.endedAt) || !Number.isFinite(meters) || meters <= 0) return null;
  let best: RecordPerformance | null = null;
  const maximumSpeed = sanitizeConfig(run.config).maximumSpeed;
  const consider = (from: Node, to: Node, timing: Chunk['timing']) => {
    const active = to.active - from.active, seconds = Math.max(to.elapsed - from.elapsed, active);
    if (!(seconds > 0) || active < 0 || meters / seconds > maximumSpeed + .1 || Math.abs((to.meters - from.meters) - meters) > EPS) return;
    if (best && best.seconds <= seconds + 1e-9) return;
    best = { runId: run.id, meters, seconds, activeSeconds: active, pace: seconds / meters * 1000,
      fromMeters: from.meters, toMeters: to.meters, fromActiveSeconds: from.active, toActiveSeconds: to.active,
      startedAt: from.timestamp, endedAt: to.timestamp, timing };
  };
  for (const { nodes, timing } of chunks) {
    const first = nodes[0]!, last = nodes.at(-1)!;
    if (last.meters - first.meters + EPS < meters) continue;
    let end = 1;
    for (let start = 0; start < nodes.length; start++) {
      const from = nodes[start]!, wanted = from.meters + meters;
      if (wanted > last.meters + EPS) break;
      while (end < nodes.length && nodes[end]!.meters < wanted - EPS) end++;
      if (end >= nodes.length) break;
      const target = Math.min(wanted, last.meters), a = nodes[Math.max(0, end - 1)]!, b = nodes[end]!;
      const to = Math.abs(b.meters - target) <= EPS ? b : interpolate(a, b, target);
      consider(from, to, timing);
    }
    let start = 0;
    for (let endIndex = 1; endIndex < nodes.length; endIndex++) {
      const to = nodes[endIndex]!, wanted = to.meters - meters;
      if (wanted < first.meters - EPS) continue;
      while (start + 1 < endIndex && nodes[start + 1]!.meters <= wanted + EPS) start++;
      const target = Math.max(wanted, first.meters), a = nodes[start]!, b = nodes[Math.min(start + 1, endIndex)]!;
      const from = Math.abs(a.meters - target) <= EPS ? a : interpolate(a, b, target);
      consider(from, to, timing);
    }
  }
  return best;
}
const cache = new WeakMap<RunRecord, RecordPerformance[]>();
export function runRecords(run: RunRecord): RecordPerformance[] {
  const cached = cache.get(run); if (cached) return cached;
  const chunks = recordChunks(run);
  const performances = RECORD_DISTANCES.flatMap(({ meters }) => { const record = bestMeasuredSegment(run, meters, chunks); return record ? [record] : []; });
  cache.set(run, performances); return performances;
}
/** An immutable ghost curve from the same continuous span that qualified the record. */
export function measuredSegmentTrace(run: RunRecord, performance: RecordPerformance): { meters: number; seconds: number }[] {
  if (performance.runId !== run.id) throw new Error('La course ne correspond pas au record.');
  const chunk = recordChunks(run).find(c => c.timing === performance.timing && c.nodes[0]!.active <= performance.fromActiveSeconds + EPS &&
    c.nodes.at(-1)!.active >= performance.toActiveSeconds - EPS && c.nodes[0]!.meters <= performance.fromMeters + EPS && c.nodes.at(-1)!.meters >= performance.toMeters - EPS);
  if (!chunk) throw new Error('Le segment fiable de ce record est indisponible.');
  const next = chunk.nodes.findIndex(n => n.active >= performance.fromActiveSeconds - EPS);
  if (next < 0) throw new Error('Départ du record indisponible.');
  const after = chunk.nodes[next]!, before = chunk.nodes[Math.max(0, next - 1)]!;
  const ratio = after.active > before.active ? Math.max(0, Math.min(1, (performance.fromActiveSeconds - before.active) / (after.active - before.active))) : 0;
  const origin = before.elapsed + ratio * (after.elapsed - before.elapsed);
  const candidates = chunk.nodes.filter(n => n.active > performance.fromActiveSeconds + EPS && n.active < performance.toActiveSeconds - EPS);
  const step = Math.max(1, Math.ceil(candidates.length / 1000));
  const trace = [{ meters: 0, seconds: 0 }];
  for (let i = 0; i < candidates.length; i += step) {
    const n = candidates[i]!, seconds = n.elapsed - origin, meters = n.meters - performance.fromMeters, previous = trace.at(-1)!;
    if (seconds > previous.seconds && seconds < performance.seconds && meters >= previous.meters && meters < performance.meters) trace.push({ meters, seconds });
  }
  trace.push({ meters: performance.meters, seconds: performance.seconds }); return trace;
}
export function personalRecords(performances: RecordPerformance[]): PersonalRecord[] {
  return RECORD_DISTANCES.map(({ meters, label }) => {
    const attempts = performances.filter(p => p.meters === meters).sort((a, b) => a.seconds - b.seconds || a.startedAt - b.startedAt);
    return { meters, label, best: attempts[0] ?? null, performances: attempts };
  });
}
