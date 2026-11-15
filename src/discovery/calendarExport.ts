import { addDiscoveryDays, type DiscoveryItem } from '../../supabase/functions/_shared/discovery-model';
import type { ExportDocument } from '../analysis/export/types';

const escapeText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
const asDate = (day: string) => day.replace(/-/g, '');
const asUtc = (instant: number) => new Date(instant).toISOString().replace(/[-:]|\.\d{3}/g, '');

// RFC 5545 physical lines are bounded by octets, and never split a Unicode character.
function fold(line: string): string {
  let bytes = 0;
  let value = '';
  for (const character of line) {
    const cp = character.codePointAt(0)!;
    const width = cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
    if (bytes + width > 75) {
      value += '\r\n ';
      bytes = 1;
    }
    value += character;
    bytes += width;
  }
  return value;
}

export function calendarDocument(item: DiscoveryItem, now = Date.now()): ExportDocument {
  const { schedule } = item;
  if (!schedule || item.state !== 'published')
    throw new Error('Cette fiche ne dispose pas d’une date exportable.');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sprinter//Découvrir//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${item.id}@sprinter`,
    `DTSTAMP:${asUtc(now)}`,
    `SUMMARY:${escapeText(item.title)}`,
    `LOCATION:${escapeText([item.venue, item.address, item.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escapeText(`${item.summary}\nInformations officielles : ${item.officialUrl}`)}`,
    `URL:${item.officialUrl}`,
  ];
  if (schedule.startAt && (!schedule.lastDay || schedule.lastDay === schedule.day || schedule.endAt)) {
    lines.push(`DTSTART:${asUtc(Date.parse(schedule.startAt))}`);
    if (schedule.endAt) lines.push(`DTEND:${asUtc(Date.parse(schedule.endAt))}`);
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${asDate(schedule.day)}`,
      `DTEND;VALUE=DATE:${asDate(addDiscoveryDays(schedule.lastDay ?? schedule.day, 1))}`,
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return {
    filename: `${item.id}.ics`,
    mimeType: 'text/calendar',
    data: lines.map(fold).join('\r\n') + '\r\n',
    points: 0,
    segments: 0,
  };
}
