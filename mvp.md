# Calendar Web MVP - Detailed Tasks

**Goal:** Build a functional calendar web app with event CRUD, local storage, and ICS export.
**Timeline:** 1-2 weeks (focused development)
**Target:** Single developer, minimal dependencies, working product.

---

## Phase 1: Project Setup (Day 1)

### 1.1 Initialize Project
- [ ] Run `npm create vite@latest calendar-web -- --template react-ts`
- [ ] Install dependencies:
  ```bash
  npm install date-fns dexie zustand uuid zod lucide-react
  npm install -D tailwindcss postcss autoprefixer @types/uuid
  ```
- [ ] Initialize Tailwind: `npx tailwindcss init -p`
- [ ] Configure `tailwind.config.js` with content paths
- [ ] Add Tailwind directives to `src/index.css`

### 1.2 Project Structure
```
src/
├── components/
│   ├── Calendar.tsx        # Main calendar grid
│   ├── EventForm.tsx       # Create/edit event modal
│   ├── EventCard.tsx       # Single event display
│   └── Button.tsx          # Reusable button
├── lib/
│   ├── db.ts               # Dexie database setup
│   ├── ics.ts              # ICS export utilities
│   └── validation.ts       # Zod schemas
├── hooks/
│   └── useEvents.ts        # Event CRUD hook
├── types/
│   └── index.ts            # TypeScript types
├── store/
│   └── eventStore.ts       # Zustand store
└── App.tsx
```

### 1.3 Define Types
Create `src/types/index.ts`:
```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;  // ISO 8601
  endDate: string;    // ISO 8601
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Phase 2: Data Layer (Day 1-2)

### 2.1 Database Setup
Create `src/lib/db.ts`:

```typescript
import Dexie from 'dexie';
import { CalendarEvent } from '../types';

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
```

**Acceptance Criteria:**
- [ ] Database initializes without errors
- [ ] Can add/read/update/delete events

### 2.2 Validation Schema
Create `src/lib/validation.ts`:

```typescript
import { z } from 'zod';

export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isAllDay: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date must be after start date"
});

export type ValidatedEvent = z.infer<typeof CalendarEventSchema>;
```

**Acceptance Criteria:**
- [ ] Schema validates correct data
- [ ] Schema rejects invalid data (missing title, end before start)

---

## Phase 3: State Management (Day 2)

### 3.1 Zustand Store
Create `src/store/eventStore.ts`:

```typescript
import { create } from 'zustand';
import { CalendarEvent } from '../types';
import { db } from '../lib/db';

interface EventStore {
  events: CalendarEvent[];
  selectedDate: Date;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadEvents: (start: Date, end: Date) => Promise<void>;
  createEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  setSelectedDate: (date: Date) => void;
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  selectedDate: new Date(),
  isLoading: false,
  error: null,

  loadEvents: async (start, end) => {
    set({ isLoading: true });
    try {
      const events = await db.events
        .where('startDate')
        .between(start.toISOString(), end.toISOString())
        .or('endDate')
        .between(start.toISOString(), end.toISOString())
        .toArray();
      set({ events, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load events', isLoading: false });
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
    get().loadEvents(/* current range */);
  },

  updateEvent: async (id, updates) => {
    await db.events.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    get().loadEvents(/* current range */);
  },

  deleteEvent: async (id) => {
    await db.events.delete(id);
    get().loadEvents(/* current range */);
  },

  setSelectedDate: (date) => set({ selectedDate: date }),
}));
```

**Acceptance Criteria:**
- [ ] Store initializes with empty events array
- [ ] Can create event and it appears in store
- [ ] Can update event and changes reflect
- [ ] Can delete event and it disappears

---

## Phase 4: ICS Export (Day 2)

### 4.1 Simple ICS Generator
Create `src/lib/ics.ts`:

```typescript
import { CalendarEvent } from '../types';

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function formatDate(dateStr: string, isAllDay: boolean): string {
  const date = new Date(dateStr);
  if (isAllDay) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateICS(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalendarMVP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach(event => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@calendar.mvp`);
    lines.push(`DTSTAMP:${formatDate(new Date().toISOString(), false)}`);
    lines.push(`DTSTART${event.isAllDay ? ';VALUE=DATE' : ''}:${formatDate(event.startDate, event.isAllDay)}`);
    lines.push(`DTEND${event.isAllDay ? ';VALUE=DATE' : ''}:${formatDate(event.endDate, event.isAllDay)}`);
    lines.push(`SUMMARY:${escapeICS(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(events: CalendarEvent[], filename = 'calendar.ics'): void {
  const ics = generateICS(events);
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**Acceptance Criteria:**
- [ ] Generates valid ICS format
- [ ] Downloaded file opens in Apple Calendar
- [ ] Events display correct dates/times
- [ ] Special characters are properly escaped

---

## Phase 5: UI Components (Day 3-4)

### 5.1 Button Component
Create `src/components/Button.tsx`:

```typescript
import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

### 5.2 Event Form Modal
Create `src/components/EventForm.tsx`:

```typescript
import { useState } from 'react';
import { CalendarEvent } from '../types';
import { Button } from './Button';

interface EventFormProps {
  event?: CalendarEvent | null;
  selectedDate: Date;
  onSave: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function EventForm({ event, selectedDate, onSave, onCancel }: EventFormProps) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay || false);
  const [startDate, setStartDate] = useState(
    event?.startDate || selectedDate.toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState(
    event?.endDate || selectedDate.toISOString().slice(0, 16)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      isAllDay,
      startDate: isAllDay ? startDate.split('T')[0] + 'T00:00:00' : startDate,
      endDate: isAllDay ? endDate.split('T')[0] + 'T23:59:59' : endDate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {event ? 'Edit Event' : 'New Event'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
            />
            <label htmlFor="allDay">All day</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start</label>
              <input
                type={isAllDay ? 'date' : 'datetime-local'}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End</label>
              <input
                type={isAllDay ? 'date' : 'datetime-local'}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {event ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Form displays correctly
- [ ] Can enter title, description
- [ ] Can toggle all-day
- [ ] Date inputs change based on all-day toggle
- [ ] Submit calls onSave with correct data
- [ ] Cancel closes form

### 5.3 Calendar Component
Create `src/components/Calendar.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { CalendarEvent } from '../types';
import { Button } from './Button';
import { EventForm } from './EventForm';

interface CalendarProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onCreateEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  onDeleteEvent: (id: string) => void;
  onExportICS: () => void;
}

export function Calendar({
  events,
  selectedDate,
  onDateSelect,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onExportICS,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return isSameDay(day, eventStart) ||
             isSameDay(day, eventEnd) ||
             (day >= eventStart && day <= eventEnd);
    });
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDayClick = (day: Date) => {
    onDateSelect(day);
    setEditingEvent(null);
    setShowForm(true);
  };

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleSave = (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingEvent) {
      onUpdateEvent(editingEvent.id, eventData);
    } else {
      onCreateEvent(eventData);
    }
    setShowForm(false);
    setEditingEvent(null);
  };

  const handleDelete = () => {
    if (editingEvent) {
      onDeleteEvent(editingEvent.id);
      setShowForm(false);
      setEditingEvent(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">
            {format(currentMonth, 'MMMM yyyy')}
          </h1>
          <div className="flex gap-1">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded">
              <ChevronLeft size={20} />
            </button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <Button onClick={onExportICS} variant="secondary">
          <Download size={16} className="mr-2" />
          Export ICS
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`
                min-h-[100px] border rounded p-1 cursor-pointer
                ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}
                hover:bg-gray-50
              `}
            >
              <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : ''}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1 mt-1">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => handleEventClick(e, event)}
                    className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded truncate"
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <EventForm
          event={editingEvent}
          selectedDate={selectedDate}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingEvent(null);
          }}
        />
      )}

      {/* Delete button for editing */}
      {showForm && editingEvent && (
        <div className="fixed bottom-4 right-4">
          <Button variant="danger" onClick={handleDelete}>
            Delete Event
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Displays month grid correctly
- [ ] Can navigate between months
- [ ] Clicking day opens create form
- [ ] Clicking event opens edit form
- [ ] Events display on correct days
- [ ] Today is highlighted
- [ ] Export button triggers ICS download

---

## Phase 6: Main App Integration (Day 4-5)

### 6.1 App.tsx
Update `src/App.tsx`:

```typescript
import { useEffect } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Calendar } from './components/Calendar';
import { useEventStore } from './store/eventStore';
import { downloadICS } from './lib/ics';

function App() {
  const {
    events,
    selectedDate,
    isLoading,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setSelectedDate,
  } = useEventStore();

  useEffect(() => {
    const now = new Date();
    loadEvents(startOfMonth(now), endOfMonth(now));
  }, [loadEvents]);

  const handleExport = () => {
    downloadICS(events);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Calendar
        events={events}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onCreateEvent={createEvent}
        onUpdateEvent={updateEvent}
        onDeleteEvent={deleteEvent}
        onExportICS={handleExport}
      />
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded">Loading...</div>
        </div>
      )}
    </div>
  );
}

export default App;
```

### 6.2 Testing Checklist

**Manual Tests:**
- [ ] Create a new event
- [ ] Edit an existing event
- [ ] Delete an event
- [ ] Navigate to different months
- [ ] Export ICS and open in Apple Calendar
- [ ] Refresh page - events persist
- [ ] Test with all-day events
- [ ] Test with multi-day events

**Edge Cases:**
- [ ] Empty title (should show validation)
- [ ] End date before start date
- [ ] Special characters in title/description
- [ ] Very long titles/descriptions
- [ ] Many events on same day

---

## Phase 7: Build & Deploy (Day 5-6)

### 7.1 Build Configuration

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',  // For relative paths on static hosting
});
```

### 7.2 Deploy to Cloudflare Pages

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: calendar-mvp
          directory: dist
```

**Setup Steps:**
1. Push code to GitHub
2. Create Cloudflare Pages project
3. Add secrets to GitHub repository:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Push to main branch to trigger deploy

**Acceptance Criteria:**
- [ ] App builds without errors (`npm run build`)
- [ ] App deploys successfully
- [ ] Live URL works
- [ ] Data persists in browser

---

## MVP Feature Checklist

| Feature | Status | Notes |
|---------|--------|-------|
| Create event | ⬜ | |
| Edit event | ⬜ | |
| Delete event | ⬜ | |
| Month view | ⬜ | |
| Persist data (IndexedDB) | ⬜ | |
| ICS export | ⬜ | Download file only |
| Responsive design | ⬜ | Basic mobile support |

## Out of Scope (Post-MVP)

These features from plan.md are intentionally excluded from MVP:

- Recurring events
- Week/Day/Agenda views
- Drag & drop rescheduling
- Cloud sync (Dropbox/iCloud)
- ICS subscription URLs
- Push notifications
- Search/filter
- Color categories
- PWA features (offline, manifest)
- Dark mode

---

## Success Criteria

The MVP is successful when:
1. User can create, view, edit, delete events
2. Events persist after page refresh
3. User can export events to .ics file
4. Exported file opens correctly in Apple Calendar/Outlook
5. App is deployed and accessible via URL
