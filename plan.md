# Calendar Web Application - Technical Plan

## Overview
A client-side calendar web application that supports event management with reminders and ICS subscription compatibility for seamless integration with native calendar apps (iPhone, Mac, Windows).

---

## 1. Event Management (CRUD + Reminders)

### 1.1 Data Model

```typescript
interface CalendarEvent {
  id: string;                    // UUID v4
  title: string;
  description?: string;
  location?: string;
  timezone: string;              // IANA timezone identifier, e.g., "America/New_York"
  startDate: string;             // ISO 8601 format with timezone offset
  endDate: string;               // ISO 8601 format with timezone offset
  isAllDay: boolean;
  recurrence?: RecurrenceRule;   // RRULE format
  recurrenceExceptions?: string[];  // ISO 8601 dates to exclude from recurrence
  recurrenceOverrides?: Record<string, Partial<CalendarEvent>>;  // Modified occurrences
  reminders: Reminder[];
  color?: string;                // Hex color for categorization
  createdAt: string;
  updatedAt: string;
}

interface Reminder {
  id: string;
  type: 'notification' | 'email' | 'popup';
  offset: number;                // Minutes before event
  customMessage?: string;
}

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;             // Every N days/weeks/months
  until?: string;                // End date
  count?: number;                // Max occurrences
  byDay?: string[];              // ['MO', 'WE', 'FR'] for weekly
}
```

### 1.2 Data Validation

Use Zod for runtime validation to prevent malformed data:

```typescript
import { z } from 'zod';

const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  timezone: z.string().min(1),   // IANA timezone
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isAllDay: z.boolean(),
  recurrence: RecurrenceRuleSchema.optional(),
  recurrenceExceptions: z.array(z.string().datetime()).optional(),
  reminders: z.array(ReminderSchema),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine(data => new Date(data.endDate) > new Date(data.startDate), {
  message: "End date must be after start date"
});

type CalendarEvent = z.infer<typeof CalendarEventSchema>;
```

### 1.3 Storage Strategy

Since static hosting has no backend:

| Storage Type | Purpose |
|-------------|---------|
| **localStorage** | User preferences, settings |
| **IndexedDB** | Events data (larger capacity, structured queries) |
| **OPFS** (Origin Private File System) | Large ICS exports, backup files (Chrome/Edge only) |
| **File System Access API** | Optional: Direct save to user-selected folder |

**Library Recommendation:** `idb` (lightweight IndexedDB wrapper) or **Dexie.js** for more ergonomic API

#### Database Schema with Migrations

```typescript
import { openDB } from 'idb';

const DB_NAME = 'calendar-app';
const DB_VERSION = 1;

export const initDB = () => openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion) {
    if (oldVersion < 1) {
      const eventStore = db.createObjectStore('events', { keyPath: 'id' });
      eventStore.createIndex('startDate', 'startDate');
      eventStore.createIndex('endDate', 'endDate');
      db.createObjectStore('settings', { keyPath: 'key' });
    }
    // Future migrations:
    // if (oldVersion < 2) { ... }
  }
});
```

**Note:** OPFS is only supported in Chrome/Edge. Always provide fallback for Firefox/Safari:

```typescript
async function saveToFile(data: Blob, filename: string): Promise<void> {
  // Try File System Access API first (Chrome/Edge)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Calendar Files',
          accept: { 'text/calendar': ['.ics'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return;
    } catch (err) {
      // User cancelled or API failed, fall through to fallback
    }
  }

  // Fallback: Traditional download
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 1.4 Event Operations

```typescript
// Core operations
- createEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarEvent>
- updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent>
- deleteEvent(id: string): Promise<void>
- getEvent(id: string): Promise<CalendarEvent | null>
- listEvents(start: Date, end: Date): Promise<CalendarEvent[]>
- searchEvents(query: string): Promise<CalendarEvent[]>
- exportAllData(): Promise<Blob>           // Full backup including settings
- importData(blob: Blob): Promise<{ events: number; errors: string[] }>
- parseICS(icsContent: string): Promise<CalendarEvent[]>  // Import from external calendars
```

### 1.5 Reminder System

**Challenge:** No server means no push notifications when tab is closed.

**Solutions:**
1. **Web Notifications** (while tab is open/backgrounded)
   - Use `Notification API` + `Service Worker`
   - Request notification permission on first reminder setup

2. **Background Sync** (limited support)
   - Schedule one-off sync events
   - Not reliable for precise timing

3. **Native Integration** (recommended)
   - Export to native calendar via ICS subscription (see Section 2)
   - Let OS handle notifications

**iOS Limitation:** Due to iOS Safari restrictions, web notifications only work when the app is in the foreground or backgrounded (not when completely closed). For reliable reminders on iOS, ICS subscription to native Calendar app is strongly recommended.

**Security Note:** Email reminders via services like SendGrid/Resend require API keys. Storing API keys client-side is a security risk as they could be extracted by malicious users. If email reminders are needed, users must provide their own API keys and understand the security implications.

### 1.6 UI Components & Accessibility

- **Calendar Views:** Month, Week, Day, Agenda (list)
- **Event Form:** Title, time picker, recurrence builder, reminder selector
- **Quick Add:** Natural language parsing ("Meeting tomorrow at 3pm")
- **Drag & Drop:** Move/resize events
- **Color Coding:** Custom categories/tags

#### Accessibility Requirements

- **ARIA labels:** Calendar grid (`role="grid"`), events (`role="button"`), navigation
- **Keyboard navigation:** Arrow keys to move between dates, Enter/Space to select, Escape to close modals
- **Screen reader support:** Live regions for date changes, proper heading hierarchy
- **Focus management:** Visible focus indicators, logical tab order
- **High contrast mode:** Support `prefers-contrast` media query

---

## 2. ICS Subscription Support

### 2.1 Architecture

Since static sites can't generate dynamic ICS feeds, use this approach:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Calendar App   │────▶│  ICS Feed URL    │────▶│  Static ICS     │
│ (iPhone/Mac/    │     │  (data URL or    │     │  file or        │
│  Windows)       │◄────│  hosted file)    │◄────│  generated blob │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### 2.2 ICS Generation & Parsing

**Recommendation:** Consider using `ical-generator` library instead of custom implementation. RFC 5545 is complex and easy to get wrong.

```typescript
// Alternative: ical-generator library
import ical from 'ical-generator';

function generateICSWithLib(events: CalendarEvent[]): string {
  const calendar = ical({ name: 'My Calendar' });

  events.forEach(event => {
    calendar.createEvent({
      id: event.id,
      summary: event.title,
      description: event.description,
      location: event.location,
      start: event.startDate,
      end: event.endDate,
      timezone: event.timezone,
      allDay: event.isAllDay,
    });
  });

  return calendar.toString();
}
```

If building custom implementation:

```typescript
// Generate ICS content from events
function generateICS(events: CalendarEvent[]): string {
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YourCalendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:My Calendar',
    'X-WR-TIMEZONE:UTC',
    ...events.flatMap(event => eventToVEvent(event)),
    'END:VCALENDAR'
  ];
  return icsLines.join('\r\n');
}

// ICS requires specific escaping per RFC 5545
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')   // Backslash must be escaped first
    .replace(/;/g, '\\;')     // Semicolon
    .replace(/,/g, '\\,')     // Comma
    .replace(/\n/g, '\\n')    // Newline
    .replace(/\r/g, '');      // Remove carriage returns
}

// ICS lines must be folded at 75 characters
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks = [];
  for (let i = 0; i < line.length; i += 74) {
    chunks.push(i === 0 ? line.slice(0, 75) : ' ' + line.slice(i, i + 74));
  }
  return chunks.join('\r\n');
}

function eventToVEvent(event: CalendarEvent): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id}@yourcalendar.app`,
    `DTSTAMP:${formatUTC(new Date())}`,
    `DTSTART${event.isAllDay ? ';VALUE=DATE' : ''}:${formatDate(event.startDate, event.isAllDay)}`,
    `DTEND${event.isAllDay ? ';VALUE=DATE' : ''}:${formatDate(event.endDate, event.isAllDay)}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`);
  if (event.recurrence) lines.push(`RRULE:${formatRRULE(event.recurrence)}`);
  if (event.recurrenceExceptions?.length) {
    lines.push(`EXDATE:${event.recurrenceExceptions.join(',')}`);
  }
  if (event.reminders.length > 0) {
    event.reminders.forEach(r => {
      lines.push(`BEGIN:VALARM`);
      lines.push(`ACTION:${r.type === 'email' ? 'EMAIL' : 'DISPLAY'}`);
      lines.push(`TRIGGER:-PT${r.offset}M`);
      lines.push(`END:VALARM`);
    });
  }
  lines.push('END:VEVENT');
  return lines.map(foldLine);
}

// ICS Parsing (import external calendars)
import ICAL from 'ical.js'; // or custom parser

function parseICS(icsContent: string): CalendarEvent[] {
  const jcalData = ICAL.parse(icsContent);
  const vcalendar = new ICAL.Component(jcalData);
  const vevents = vcalendar.getAllSubcomponents('vevent');

  return vevents.map(vevent => {
    const event = new ICAL.Event(vevent);
    return {
      id: event.uid || crypto.randomUUID(),
      title: event.summary || 'Untitled',
      description: event.description,
      location: event.location,
      timezone: event.startDate.timezone,
      startDate: event.startDate.toJSDate().toISOString(),
      endDate: event.endDate.toJSDate().toISOString(),
      isAllDay: event.startDate.isDate,
      reminders: [], // Parse VALARM components
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}
```

### 2.3 Subscription Methods

#### Method A: File Download (One-time import, NOT subscription)

**⚠️ This method cannot be used for live subscription.** It is only for one-time file download/import.

```typescript
function downloadICSFile(): void {
  const ics = generateICS(getAllEvents());
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'calendar.ics';
  a.click();

  URL.revokeObjectURL(url);
}
```

**Why `URL.createObjectURL()` doesn't work for subscriptions:**
- URLs are only valid within the current browser session
- URLs are not accessible to external calendar apps
- The URL changes every time, breaking any subscription

**Use case:** Export events to manually import into another calendar application.

#### Method B: WebDAV / External Storage (Recommended)
Sync ICS file to a user-controlled location:

| Service | Method |
|---------|--------|
| **iCloud Drive** | File System Access API + iCloud sync |
| **Dropbox** | Dropbox API (client-side OAuth) |
| **Google Drive** | Google Drive API |
| **OneDrive** | Microsoft Graph API |
| **Self-hosted** | WebDAV client (e.g., Nextcloud) |

**Workflow:**
1. User authenticates with chosen service
2. App exports ICS to folder (e.g., `/Apps/Calendar/calendar.ics`)
3. User subscribes to that file URL in their calendar app
4. App periodically updates the file when events change

#### Method C: GitHub Gist (Serverless persistence - Use with caution)

```typescript
// Create/update a secret gist with ICS content
// GitHub provides a raw URL that calendar apps can subscribe to
// Rate limits: 60/hour unauthenticated, 5000/hour authenticated
```

**⚠️ Security Warning:**
- GitHub "secret" gists are **not encrypted** or truly private
- Anyone with the URL can access the calendar data
- Do not use for sensitive events (medical appointments, personal meetings with location)
- Consider this experimental/development-only
- Gists may be discoverable through GitHub's API

### 2.4 Platform-Specific Setup Instructions

**iPhone/iPad (iOS):**
1. Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar
2. Enter ICS URL
3. Set refresh frequency (15 min - 1 week)

**Mac (macOS):**
1. Calendar app → File → New Calendar Subscription
2. Enter ICS URL
3. Configure auto-refresh interval

**Windows (Outlook/Microsoft 365):**
1. Outlook → Add Calendar → From Internet
2. Paste ICS URL
3. Set subscription name and folder

**Google Calendar (Web):**
1. Other Calendars → Add by URL
2. Paste ICS URL
3. Note: Google syncs every 12-24 hours (slow)

### 2.5 Auto-Refresh Considerations

| Platform | Refresh Frequency | Notes |
|----------|------------------|-------|
| iOS/macOS | User-configurable (15min-1week) | Most flexible |
| Outlook | ~24 hours | Slow, not configurable |
| Google Calendar | 12-24 hours | Very slow |

**Recommendation:** Document this limitation clearly. For real-time sync, native apps or WebDAV with frequent polling work best.

---

## 3. Static Hosting Solutions

### 3.1 Recommended Platforms

| Platform | Best For | Custom Domain | Build CI | Notes |
|----------|----------|---------------|----------|-------|
| **GitHub Pages** | Open source projects, simple hosting | Yes | GitHub Actions | Public repos free, private need Pro |
| **Cloudflare Pages** | Performance, edge functions | Yes | Built-in | Generous free tier, fastest CDN |
| **Vercel** | Next.js/React apps | Yes | Built-in | Great for SPA, analytics included |
| **Netlify** | JAMstack, forms | Yes | Built-in | Good free tier, easy setup |
| **Firebase Hosting** | Google ecosystem | Yes | GitHub Actions | Good for PWAs |

### 3.2 Recommended Choice: Cloudflare Pages

**Why Cloudflare Pages:**
- **Fastest global CDN** (250+ locations)
- **Generous free tier:** 500 builds/month, unlimited bandwidth
- **Preview deployments** for every PR
- **Analytics included**
- **KV storage** available if needed later (for multi-user sync)

### 3.3 Build Configuration

```yaml
# wrangler.toml (Cloudflare configuration)
name = "calendar-web"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[site]
bucket = "./dist"

# Headers for ICS subscription support
[[headers]]
for = "/*.ics"
[headers.values]
Content-Type = "text/calendar; charset=utf-8"
Content-Disposition = "inline"
Access-Control-Allow-Origin = "*"
```

### 3.4 Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
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
          projectName: calendar-web
          directory: dist
```

### 3.5 Required Features for Static Hosting

| Feature | Implementation |
|---------|---------------|
| **Client-side routing** | Hash-based routing (`/#/event/123`) or history API with 404 fallback |
| **SPA entry point** | All routes serve `index.html` |
| **Asset caching** | Long-term cache for JS/CSS, short-term for HTML |
| **PWA support** | Service worker for offline access |
| **Data export/import** | JSON/ICS download/upload for backup |

---

## 4. Technical Stack Recommendation

### 4.1 Core Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 + TypeScript |
| **Build Tool** | Vite (fast dev, optimized builds) |
| **UI Library** | Tailwind CSS + Headless UI |
| **Calendar Component** | FullCalendar or custom with date-fns |
| **State Management** | Zustand (lightweight) |
| **Storage** | IndexedDB via Dexie.js |
| **Date Handling** | date-fns + date-fns-tz (timezone support) |
| **ICS Generation** | ical-generator / ical.js libraries |
| **Validation** | Zod |
| **Icons** | Lucide React |
| **Notifications** | Service Worker + Notification API |

### 4.2 Project Structure

```
src/
├── components/
│   ├── calendar/           # Calendar views (month, week, day)
│   ├── events/             # Event form, event card
│   ├── reminders/          # Reminder settings
│   └── common/             # Buttons, modals, inputs
├── hooks/
│   ├── useEvents.ts        # CRUD operations
│   ├── useReminders.ts     # Notification scheduling
│   └── useICS.ts           # ICS generation/export
├── lib/
│   ├── db.ts               # IndexedDB setup
│   ├── ics.ts              # ICS format utilities
│   ├── recurrence.ts       # RRULE parsing/generation
│   └── storage/            # Cloud sync adapters
├── types/
│   └── index.ts            # TypeScript interfaces
├── workers/
│   └── service-worker.ts   # Background sync, notifications
└── App.tsx
```

### 4.3 Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "date-fns": "^3.0.0",
    "date-fns-tz": "^2.0.0",
    "zod": "^3.22.0",
    "dexie": "^3.2.0",
    "zustand": "^4.4.0",
    "uuid": "^9.0.0",
    "rrule": "^2.8.0",
    "ical-generator": "^6.0.0",
    "ical.js": "^1.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/uuid": "^9.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.17.0"
  }
}
```

**Notes on dependencies:**
- **`ical-generator`** / **`ical.js`**: For reliable ICS generation/parsing instead of custom implementation
- **`date-fns-tz`**: Required for timezone-aware date operations
- **`zod`**: Runtime validation to prevent malformed data
- **`dexie`**: More ergonomic IndexedDB wrapper with better TypeScript support

---

## 5. Implementation Phases

**Note:** Timeline estimates are for focused, full-time development. Adjust based on team size and availability.

### Phase 1: Core Calendar (Weeks 1-2)
- [ ] Project setup with Vite + React + TypeScript
- [ ] IndexedDB schema with migrations
- [ ] Zod validation schemas
- [ ] Month/Week/Day calendar views
- [ ] Event creation/editing form with timezone support
- [ ] Basic styling with Tailwind
- [ ] Accessibility: ARIA labels, keyboard navigation

### Phase 2: Advanced Features (Weeks 3-4)
- [ ] Recurring events (RRULE support)
- [ ] Recurrence exceptions and overrides
- [ ] Drag-and-drop event rescheduling
- [ ] Search and filter
- [ ] Color categories
- [ ] Import/export JSON backup

### Phase 3: ICS & Integration (Weeks 5-6)
- [ ] ICS generation (using ical-generator library)
- [ ] ICS parsing for import (using ical.js)
- [ ] Download .ics files
- [ ] Cloud storage integration (Dropbox/iCloud)
- [ ] Platform-specific setup guides

### Phase 4: Polish & Deploy (Week 7)
- [ ] PWA setup (manifest, service worker)
- [ ] Push notifications (while app open)
- [ ] Dark mode
- [ ] Responsive mobile UI
- [ ] Deploy to Cloudflare Pages

---

## 6. Limitations & Workarounds

| Limitation | Workaround |
|------------|------------|
| No server-side push notifications | Use native calendar integration via ICS |
| No real-time collaboration | Export/import sharing, future: CRDT sync |
| Browser storage limits (~50MB) | Compress data, offer cloud backup |
| No email reminders without backend | Integrate with email API (user provides key) |
| Calendar apps refresh slowly | Document clearly, recommend frequent refresh settings |

---

## 7. Future Enhancements

- **Sync Service:** Cloudflare Workers + Durable Objects for real-time sync
- **Mobile Apps:** Capacitor/Cordova wrapper for native app stores
- **AI Features:** Natural language event creation, smart scheduling
- **Integrations:** Google Calendar API, Outlook API for two-way sync
- **Sharing:** Public calendar links, embedded calendars

---

## 8. Resources

- [RFC 5545 - iCalendar Specification](https://datatracker.ietf.org/doc/html/rfc5545)
- [MDN - Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [MDN - Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [date-fns Documentation](https://date-fns.org/)
