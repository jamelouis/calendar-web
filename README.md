# Calendar MVP

A client-side calendar web application with event CRUD and ICS export.

## Features

- **Month view calendar** with navigation
- **Create, edit, delete** events
- **All-day** and **timed** events
- **ICS export** (download .ics file)
- **Local persistence** via IndexedDB
- **Responsive design**

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Dexie (IndexedDB wrapper)
- Zustand (state management)
- date-fns (date utilities)

## Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Deploy to Cloudflare Pages

1. Push code to GitHub
2. Create Cloudflare Pages project
3. Add secrets to GitHub repository:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Push to main branch to trigger deploy

## Project Structure

```
src/
├── components/       # React components
├── lib/             # Utilities (db, ics, validation)
├── store/           # Zustand store
├── types/           # TypeScript types
└── App.tsx          # Main app
```

## License

MIT
