import { create } from 'zustand';
import type { CalendarEvent } from '../types';
import { db } from '../lib/db';
import { startOfMonth, endOfMonth } from 'date-fns';

interface EventStore {
  events: CalendarEvent[];
  selectedDate: Date;
  isLoading: boolean;
  error: string | null;
  currentMonthRange: { start: Date; end: Date };

  // Actions
  loadEvents: (start?: Date, end?: Date) => Promise<void>;
  createEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  setSelectedDate: (date: Date) => void;
  setCurrentMonthRange: (date: Date) => void;
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  selectedDate: new Date(),
  isLoading: false,
  error: null,
  currentMonthRange: {
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  },

  loadEvents: async (start, end) => {
    set({ isLoading: true });
    try {
      const { currentMonthRange } = get();
      const rangeStart = start || currentMonthRange.start;
      const rangeEnd = end || currentMonthRange.end;

      // Get all events and filter in memory (Dexie doesn't support complex OR queries well)
      const allEvents = await db.events.toArray();
      const events = allEvents.filter(event => {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        // Event overlaps with range if:
        // - Event starts within range, OR
        // - Event ends within range, OR
        // - Event spans the entire range
        return (
          (eventStart >= rangeStart && eventStart <= rangeEnd) ||
          (eventEnd >= rangeStart && eventEnd <= rangeEnd) ||
          (eventStart <= rangeStart && eventEnd >= rangeEnd)
        );
      });

      set({ events, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load events', isLoading: false });
      console.error('Load events error:', error);
    }
  },

  createEvent: async (eventData) => {
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      ...eventData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.events.add(event);
    // Reload all events without date filter to ensure new event is visible
    const allEvents = await db.events.toArray();
    set({ events: allEvents });
  },

  updateEvent: async (id, updates) => {
    await db.events.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    // Reload all events to ensure updated event is visible
    const allEvents = await db.events.toArray();
    set({ events: allEvents });
  },

  deleteEvent: async (id) => {
    await db.events.delete(id);
    // Reload all events to refresh the list
    const allEvents = await db.events.toArray();
    set({ events: allEvents });
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  setCurrentMonthRange: (date) => {
    set({
      currentMonthRange: {
        start: startOfMonth(date),
        end: endOfMonth(date)
      }
    });
  },
}));
