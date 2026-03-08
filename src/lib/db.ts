import Dexie from 'dexie';
import type { CalendarEvent } from '../types';

export class CalendarDB extends Dexie {
  events!: Dexie.Table<CalendarEvent, string>;

  constructor() {
    super('calendar-app');
    this.version(1).stores({
      events: 'id, startDate, endDate'
    });
  }
}

export const db = new CalendarDB();
