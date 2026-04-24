# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Noni's Card House** — a chunky, cartoon-styled multiplayer card game (Crazy Eights / UNO family). The codebase is mid-migration from a legacy single-HTML-file prototype to a Next.js + Express + PostgreSQL stack.

## Commands

```bash
npm install           # one-time setup
npm run dev           # Next.js app at http://localhost:3002 (runs predev lock-file cleanup first)
npm run dev:api       # Express API at http://localhost:4000 (separate process)
npm test              # Vitest engine tests (lib/**/*.test.ts)
npm run db:migrate    # Apply PostgreSQL migrations from server/migrations/
npm run qa:migration  # End-to-end smoke test (API + WebSocket)
```

**Single test file:**
```bash
npx vitest run lib/engine/engine.test.ts
```

**Docker (full stack):**
```bash
docker compose up --build   # postgres + api + web, migrations run automatically
docker compose down -v      # stop and clear DB
```

## Architecture

### Two stacks coexist during migration

**New stack (active development):**
- `app/` — Next.js App Router pages
- `components/next/` — Client React components
- `lib/engine/` — TypeScript engine module + Vitest tests
- `lib/api/` — Typed API client (`client.ts`, `config.ts`, `types.ts`)
- `lib/game/` — Session/match-state helpers (localStorage persistence)
- `lib/bot/` — Bot adapter
- `lib/server/` — Server-side helpers (db wrapper, API helpers)

**Legacy (kept for server runtime compatibility):**
- `src/engine.js` — JS engine used by Express routes
- `src/styles.css` — Shared CSS (imported by `app/layout.tsx`)

**Backend:**
- `server/db.js` — pg Pool, `query()` and `withTransaction()` helpers
- `server/utils.js` — Shared Express utilities
- `server/migrations/` — SQL migration files (run in order by `server/scripts/migrate.js`)

### API and realtime

Express runs on port 4000. The Next app calls it via `NEXT_PUBLIC_API_BASE_URL`. All API calls go through `lib/api/client.ts`, which:
- Reads/writes the user session from `localStorage` (`shout.user`)
- Attaches `Authorization: Bearer <token>` on every request
- Falls back to HTTP polling (1.5 s interval) when `NEXT_PUBLIC_WS_BASE_URL` is not set; uses WebSocket otherwise

Auth flow: `POST /api/auth/session` creates or reuses a user and returns a JWT. The frontend stores it in localStorage; the header `x-user-id` is also accepted.

### Engine

`lib/engine/index.ts` exports a single `Engine` object. Key methods:
- `Engine.initGame(config)` — shuffles, deals, picks safe first top card (never an action/wild)
- `Engine.applyCardEffect(state, card)` — returns new state (immutable pattern)
- `Engine.canPlay(card, topCard, currentColor, rules)` — card legality
- `Engine.drawMultiple(deck, count, discardPile)` — auto-reshuffles discard when deck is empty

`src/engine.js` is the legacy JS equivalent used by the Express routes. Keep both in sync when fixing engine logic.

### State persistence (client)
- `shout.user` — session user (id, token, name, avatar, color)
- `shout.screen` — active screen (legacy key, still used)
- `shout.useBackendData` — toggle backend mode (`"true"` enables API calls)
- `next:room-config:{roomId}` — room config snapshot for match resume

## Environment variables

Copy `.env.example` to `.env`. Key variables:
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Must be changed from default for any real deployment |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL used by the browser |
| `NEXT_PUBLIC_WS_BASE_URL` | WebSocket URL; omit to fall back to polling |
| `NEXT_PUBLIC_USE_BACKEND_DATA` | Set `true` to enable API mode by default |

## Migration context

The project follows a strangler-fig migration (see `NEXTJS_REWRITE_PLAN.md`). Phases 0–3 (scaffold, engine port, shell, API client) are complete. New UI work goes in `app/` + `components/next/`. The legacy `src/*.jsx` files are deleted — do not recreate them.

`MIGRATION_QA_CHECKLIST.md` is the go-live validation checklist; consult it before declaring any migration phase complete.

## Design system

Colors are CSS custom properties in `src/styles.css`:
- Background: `--bg-0 #120a2a` → `--bg-2 #241454`
- Cards: `--card-red #ff4d6d`, `--card-yellow #ffc93c`, `--card-green #3ddc84`, `--card-blue #4a8cff`, `--card-wild #7b5cff`
- Accents: `--accent #ff3c7a`, `--accent-2 #ffd23f`, `--accent-3 #3ddcc8`, `--accent-4 #7b5cff`

Fonts (loaded in `app/layout.tsx`): Lilita One (display), Fredoka (body), Luckiest Guy (headings).
