import type { CalendarEvent } from '../types';

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function formatDate(dateStr: string, isAllDay: boolean, isEndDate = false): string {
  const date = new Date(dateStr);

  if (isAllDay) {
    // For all-day events, extract date parts directly to avoid timezone issues
    // ICS all-day dates are exclusive for end dates, so add 1 day to end date
    const d = new Date(date);
    if (isEndDate) {
      d.setDate(d.getDate() + 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  // For timed events, convert to UTC for ICS format
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateICS(events: CalendarEvent[]): string {
  const now = new Date().toISOString();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalendarMVP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Calendar MVP',
    `X-WR-TIMEZONE:${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  ];

  events.forEach((event, index) => {
    const created = new Date(event.createdAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const modified = new Date(event.updatedAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push('BEGIN:VEVENT');
    // Use event.id with sequence to ensure unique UIDs
    lines.push(`UID:${event.id}@calendar.mvp`);
    lines.push(`DTSTAMP:${formatDate(now, false)}`);
    lines.push(`CREATED:${created}`);
    lines.push(`LAST-MODIFIED:${modified}`);
    lines.push(`SEQUENCE:${index}`);
    lines.push(`DTSTART${event.isAllDay ? ';VALUE=DATE' : ''}:${formatDate(event.startDate, event.isAllDay)}`);
    lines.push(`DTEND${event.isAllDay ? ';VALUE=DATE' : ''}:${formatDate(event.endDate, event.isAllDay, true)}`);
    lines.push(`SUMMARY:${escapeICS(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(events: CalendarEvent[], filename = 'calendar.ics'): void {
  const ics = generateICS(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
