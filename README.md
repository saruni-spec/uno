# Noni's Card House 🏠🃏

A chunky, cartoon-styled card game prototype inspired by classic shedding-card games (Crazy Eights / UNO family), now migrated to Next.js + Node/Express + Postgres.

> **Note on branding:** this is an original design. Gameplay takes inspiration from the shedding-card genre but the name, visuals, card art, and all copy are original to this project.

---

## 📁 File map

| Path                   | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `app/`                 | Next.js App Router pages                        |
| `components/next/`     | Next.js client UI components                    |
| `lib/engine/`          | Typed engine + tests                            |
| `lib/api/`             | Typed API client + config                       |
| `server/`              | Express API + auth + realtime websocket         |
| `src/engine.js`        | Legacy-compatible runtime engine used by server |
| `src/styles.css`       | Shared visual styles                            |

---

## 🎯 What it covers

### Platforms

- Same device / pass-and-play
- Local network (wifi)
- Internet multiplayer
- Invite flow supports all three via room codes + QR + share link

### Visual direction

- **Vibe:** cartoon / illustrated (bubbly, chunky, hand-drawn feel)
- **Palette:** deep purple base (`#120a2a` → `#241454`) with candy-bright card colors (red `#ff4d6d`, yellow `#ffc93c`, green `#3ddc84`, blue `#4a8cff`) and accents (hot pink `#ff3c7a`, sunshine `#ffd23f`, mint `#3ddcc8`, purple `#7b5cff`)
- **Typography:** Lilita One (display, chunky) + Fredoka (body) + JetBrains Mono (numbers)
- **Motion:** satisfying & juicy — card hover lifts, deck fan, direction spinner, turn bounce, confetti bursts, shake animation on SHOUT button
- **Cards:** chunky illustrated with thick black borders, offset drop shadows, glossy highlights, rotated numerals

### Screens

1. **Lobby** — hero with logo + CTA, live/waiting room cards with felt previews, player stacks, "Create room" tile
2. **Room setup** — full personalization:
   - Room name + icon picker (16 options)
   - 6 table felt designs (Classic Green, Neon Grid, Candy Pink, Midnight, Jungle, Sunset)
   - 6 card back designs
   - Player list with per-player team assignment (A/B/C/D badges)
   - Play mode toggle: Solo / Teams / Shared-hand
   - House rules panel
   - Match settings (score target, hand size, turn timer)
   - Invite modal (room code, QR, link, wifi, internet)
3. **Game table** — live play:
   - Opponents ring with turn indicator, card counts, team badges
   - Center play area: draw pile + direction indicator + discard pile
   - Player hand with playable/unplayable state
   - Wild color picker modal
   - Score strip (team totals, turn timer)
   - Chat side panel with emoji reactions
   - Confetti-burst SHOUT button (appears when ≤2 cards)
4. **Custom card creator** — live preview, icon picker, color picker (incl. wild), effect description, trigger rules, saved deck
5. **Stats & history** — win counts, points, streaks, medal leaderboard, recent games list, favorite-rules chart

### Teams

Both modes implemented:

- **Teams** — members have separate hands, share a win condition
- **Shared hand** — cooperative, one hand per team

### House rules (toggleable)

All rules are switches in the Room panel. Defaults shown.

| Rule                     | Default | Description                                                        |
| ------------------------ | ------- | ------------------------------------------------------------------ |
| 🥞 Stack Attack          | ON      | Stack +2 and +4 cards; next player adds or draws the total         |
| 🔄 7-0 Swap              | ON      | 7 swaps hands with someone; 0 rotates all hands                    |
| 🏃 Jump-In               | OFF     | Play identical card out of turn to interrupt                       |
| 💥 Progressive SHOUT     | OFF     | Last card must be played with a flourish                           |
| ⚖️ Challenge Wild +4     | ON      | Challenge an illegal +4; loser draws extra                         |
| 📚 Draw Until Playable   | OFF     | Keep drawing until you get a playable card                         |
| 😈 No Mercy              | ON      | Forget to call SHOUT? +2 penalty, no do-overs                      |
| 🎨 Blank Cards           | OFF     | Include custom-designed cards with unique effects                  |
| 💯 Points Scoring        | ON      | Play to 500 pts across rounds                                      |
| 🏁 **No Special Finish** | ON      | **Can't win on an action/wild — last card must be a plain number** |

**Plus:** a free-text "Add your own house rule" field for anything the presets don't cover — added rules become removable chips in the room.

### Room personalization

- Room name + emoji/icon
- Card back design / pattern (6 presets)
- Table background / felt color (6 presets)
- Player avatars (28 emoji + 12 color backgrounds)
- Custom deck colors (via card creator)

### Extra features

- **Chat in room** — side panel with emoji reactions
- **Leaderboard / stats** — all-time + monthly + weekly filters, medal icons, point bars, win streaks
- **Game history / replay** — chronological list with room, duration, winner, points, rounds
- **Custom card creator** — design new cards with icon, color, effect, trigger; saves to room deck
- Optional sound toggle (icon in game chrome)

### Tweaks panel

Toggle via the Tweaks toolbar button. Controls:

- Curved hand layout
- Big SHOUT button
- Chaos mode 🌀
- Card style (chunky / clean / retro)
- Jump-to-screen shortcuts

Defaults are persisted in an `EDITMODE` JSON block so changes survive reload.

---

## 🛠 How to run / iterate

### Local development

```bash
npm install   # one-time setup
npm run dev:api   # API at http://localhost:4000
npm run dev       # Next app at http://localhost:3002
```

To edit:

- Styling → `src/styles.css`
- Engine logic → `lib/engine/` and `src/engine.js`
- Next screens → `app/` + `components/next/`
- API routes → `server/routes.js`

Client session and match snapshots are persisted in `localStorage`.

### Testing

```bash
npm test
```

---

## 🚧 What this prototype is (and isn't)

**Is:** a playable card game with real engine (deck, turns, rules, scoring), high-fidelity UI, and match persistence.

**Isn't:** fully production-hardened internet scale multiplayer yet (Redis-backed fanout, presence analytics, and failover are follow-up work).

---

## 🔜 Next steps

- Redis-backed pub/sub fanout for multi-instance realtime
- Persistent profile & leaderboard backend
- Mobile layout pass (cards scale, bottom sheet for chat)
- Sound pack + haptics
- Animated card deal / play transitions

---

## 📚 Planning docs

- `IMPLEMENTATION_PLAN.md` — current implementation roadmap and status
- `NEXTJS_REWRITE_PLAN.md` — staged migration plan to Next.js
- `MIGRATION_QA_CHECKLIST.md` — go-live validation checklist
