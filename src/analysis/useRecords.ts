import { useEffect, useState } from 'react';
import type { RunRecord } from '../core/types';
import { personalRecords, runRecords } from './records';
import type { PersonalRecord, RecordPerformance } from './types';
export function usePersonalRecords(history: RunRecord[]) {
  const [state, setState] = useState<{ source: RunRecord[] | null; busy: boolean; done: number; records: PersonalRecord[]; unavailable: number }>({ source: null, busy: false, done: 0, records: personalRecords([]), unavailable: 0 });
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout> | null = null;
    setState({ source: history, busy: history.length > 0, done: 0, records: personalRecords([]), unavailable: 0 });
    const performances: RecordPerformance[] = []; let index = 0, unavailable = 0;
    const next = () => {
      if (cancelled) return;
      const run = history[index];
      if (run) { try { const values = runRecords(run); performances.push(...values); if (!values.length) unavailable++; } catch { unavailable++; } index++; }
      setState({ source: history, busy: index < history.length, done: index, records: personalRecords(performances), unavailable });
      if (index < history.length) timer = setTimeout(next, 0);
    };
    if (history.length) timer = setTimeout(next, 0);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [history]);
  return state.source === history ? state : { source: history, busy: history.length > 0, done: 0, records: personalRecords([]), unavailable: 0 };
}
