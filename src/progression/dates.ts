import type { Day } from './types';
const pad = (n: number) => String(n).padStart(2, '0');
export function dayKey(value: Date | number = Date.now()): Day {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function dateOf(day: Day): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Utilisez une date au format AAAA-MM-JJ.');
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const result = new Date(year, month - 1, date, 12);
  if (year < 100 || year > 9999 || dayKey(result) !== day) throw new Error('Date de calendrier invalide.');
  return result;
}
export const validDay = (day: unknown): day is Day => { try { if (typeof day !== 'string') return false; const date = dateOf(day); return date.getFullYear() >= 1900 && date.getFullYear() <= 2200; } catch { return false; } };
export function addDays(day: Day, count: number): Day { const d = dateOf(day); d.setDate(d.getDate() + count); return dayKey(d); }
export function monday(day: Day): Day { const d = dateOf(day); return addDays(day, -((d.getDay() + 6) % 7)); }
export function monthStart(day: Day): Day { const d = dateOf(day); d.setDate(1); return dayKey(d); }
export function addMonths(day: Day, count: number): Day { const d = dateOf(monthStart(day)); d.setMonth(d.getMonth() + count); return dayKey(d); }
export function dayStart(day: Day): number { const d = dateOf(day); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function calendarDays(from: Day, to: Day): number {
  const a = dateOf(from), b = dateOf(to);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}
export const dayLabel = (day: Day) => dateOf(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
export function period(day: Day, kind: 'week' | 'month') {
  const start = kind === 'week' ? monday(day) : monthStart(day);
  return { start, end: kind === 'week' ? addDays(start, 7) : addMonths(start, 1) };
}
