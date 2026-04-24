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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` / `npm start` | Start dev server on port 3000 |
| `npm run dev:api` | Start Express API on port 4000 |
| `npm run db:migrate` | Apply PostgreSQL schema migrations |
| `npm test` | Start test server on port 3001 (prints URL) |
| `npm run test:open` | Start test server and auto-open browser |

## Project Structure

```
Noni's Card House.html    # Entry point — open directly or via dev server
src/
  engine.js               # Pure game logic (no React deps)
  state/gameState.jsx     # React context + engine integration
  adapters/dbAdapter.js   # No-op stub for future API
  components.jsx          # UI primitives
  game.jsx                # Game table screen
  lobby.jsx               # Room lobby
  room.jsx                # Room setup
  data.jsx                # Seed data
  app.jsx                 # App shell + routing
  styles.css              # All styling
test/
  engine.test.html        # Engine unit tests (browser-based)
```

## How It Works

This is a **client-side only** prototype — no build step required.

- React 18 + Babel standalone compile JSX in the browser
- `src/engine.js` is pure JavaScript with no dependencies
- `src/state/gameState.jsx` bridges engine → React via Context API
- localStorage persists match state between refreshes

## Testing

### Engine Tests (Browser)
```bash
npm run test:open
# or manually: open http://localhost:3001/test/engine.test.html
```

### Manual Testing
1. `npm run dev`
2. Click "▶ Play" from nav or go to Room → Start Game
3. Play cards, draw, verify turn rotation

## Browser Compatibility

- Chrome/Edge/Firefox/Safari (latest)
- ES2020+ features used
- CSS custom properties (variables)

## Troubleshooting

**Blank page?** Check browser console for JSX compilation errors. Files must load in order:
1. `engine.js`
2. `adapters/dbAdapter.js`
3. `data.jsx`
4. `components.jsx`
5. `state/gameState.jsx`
6. Screens (`game.jsx`, etc.)
7. `app.jsx`

**Tests failing?** Make sure you're viewing `test/engine.test.html` through the server (not `file://` protocol) due to module loading.
