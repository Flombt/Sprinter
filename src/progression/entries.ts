import { uid } from '../workouts/definition';
import type { CalendarEntry } from './types';
export const newEntry = (day: string, kind: CalendarEntry['kind'] = 'run'): CalendarEntry => ({ id: uid(), day, title: kind === 'run' ? 'Ma séance' : 'Repos prévu', kind,
  workout: null, status: 'planned', completedRunId: null, planId: null, note: '', createdAt: Date.now(), updatedAt: Date.now() });
