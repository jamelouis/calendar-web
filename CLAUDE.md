# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Type-check with tsc and build for production
npm run preview      # Preview production build locally

# Linting
npm run lint         # Run ESLint on all TypeScript files
```

## Architecture

This is a client-side calendar SPA built with React 19, TypeScript, and Vite. All data is stored locally in the browser via IndexedDB.

### Data Flow

1. **Components** interact with **Zustand store** (`src/store/eventStore.ts`)
2. **Store** manages state and persists to **IndexedDB** via Dexie (`src/lib/db.ts`)
3. **ICS export** generates .ics files for calendar integration (`src/lib/ics.ts`)

### Key Types

```typescript
// src/types/index.ts
interface CalendarEvent {
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

### State Management Pattern

The Zustand store (`src/store/eventStore.ts`) provides:
- `events: CalendarEvent[]` - events for the current month range
- `loadEvents(start?, end?)` - loads events overlapping the date range (falls back to current month)
- `createEvent()`, `updateEvent()`, `deleteEvent()` - CRUD operations that auto-refresh the list

Events are filtered in-memory after fetching from Dexie (Dexie doesn't support complex OR queries well). The overlap check handles: events starting within range, ending within range, or spanning the entire range.

### Database

Dexie is configured with a single table:
```typescript
// src/lib/db.ts
this.version(1).stores({
  events: 'id, startDate, endDate'
});
```

### TypeScript Configuration

Strict TypeScript is enabled (`tsconfig.app.json`):
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `verbatimModuleSyntax: true` (requires `import type` for type imports)

### Build Notes

- Vite uses relative paths (`base: './'`) for static hosting compatibility
- Build output goes to `dist/` directory
- GitHub Actions workflow deploys to Cloudflare Pages on push to `main`

## Tech Stack

- React 19.2 + TypeScript 5.9
- Vite 7.3 (build tool)
- Tailwind CSS 3.4 + PostCSS
- Zustand 5.0 (state management)
- Dexie 4.3 (IndexedDB wrapper)
- date-fns 4.1 (date utilities)
- Zod 4.3 (validation)
- ESLint 9 (flat config)
