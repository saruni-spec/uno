# Development Guide

## Quick Start

```bash
# Install dev server (one-time)
npm install

# Start local dev server
npm run dev
# Opens at http://localhost:3000
```

## Backend Quick Start (Node + Postgres)

```bash
# 1) Copy env template
cp .env.example .env

# 2) Start postgres (example uses local postgres://postgres:postgres@localhost:5432/nonis_card_house)
# 3) Run migrations
npm run db:migrate

# 4) Run API server
npm run dev:api
```

To enable backend mode in the frontend, open:

- `http://localhost:3000/?backend=1`

or set in browser console:

```js
localStorage.setItem("shout.useBackendData", "true");
```

Backend identity is now session-based:

- `POST /api/auth/session` creates/reuses a persistent user and returns a real `user.id`.
- Frontend stores it in `localStorage` as `shout.user` and sends it as `x-user-id`.
- `POST /api/bootstrap/seed` creates initial users/room/custom cards when the database is empty.

## Docker Quick Start

```bash
# Build and start postgres + api + web
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Postgres: `localhost:5432` (`postgres/postgres`, db: `nonis_card_house`)

Notes:

- Migrations run automatically when `api` starts.
- Frontend backend mode can still be toggled with `?backend=1` or localStorage.
- To stop and remove containers: `docker compose down`
- To also clear DB data: `docker compose down -v`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` / `npm start` | Start Next.js app on port 3002 |
| `npm run dev:api` | Start Express API on port 4000 |
| `npm run db:migrate` | Apply PostgreSQL schema migrations |
| `npm test` | Run Vitest engine tests |
| `npm run qa:migration` | Run migration smoke checklist (API/WS) |

## Project Structure

```
app/                      # Next.js routes
components/next/          # Next client components
lib/engine/               # Typed engine modules + tests
lib/api/                  # Typed API client
server/                   # Express API + websocket realtime
src/engine.js             # Runtime engine used by server routes
src/styles.css            # Shared visual styles
scripts/migration-qa.mjs  # End-to-end migration smoke script
```

## How It Works

This is now a Next.js + Express application with Postgres-backed APIs.

- Next App Router renders all core screens
- Express handles auth, room lifecycle, moves, history, and custom cards
- WebSocket channel broadcasts authoritative room-state updates
- localStorage keeps session and active-match resume snapshots

## Testing

### Engine Tests
```bash
npm test
```

### Manual Testing
1. `npm run dev:api`
2. `npm run dev`
3. Create/join a room, start game, and verify moves sync

## Browser Compatibility

- Chrome/Edge/Firefox/Safari (latest)
- ES2020+ features used
- CSS custom properties (variables)

## Troubleshooting

**Backend not reachable?** Check:
1. `DATABASE_URL` in `.env`
2. `npm run db:migrate` ran successfully
3. API started (`npm run dev:api`)
4. Next env points to API (`NEXT_PUBLIC_API_BASE_URL`)
7. `app.jsx`

**Tests failing?** Make sure you're viewing `test/engine.test.html` through the server (not `file://` protocol) due to module loading.
