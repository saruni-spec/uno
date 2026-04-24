# Implementation Plan — Game Engine & Multiplayer

> **Goal:** Enable real gameplay with multiplayer sync and temporary scoring, architected for easy database/Redis integration later.
>
> **Related roadmap:** See `NEXTJS_REWRITE_PLAN.md` for the staged migration plan to Next.js.

---

## Phase 1: Game Engine Foundation (Local Only)

**Objective:** Make the prototype actually playable locally before adding network complexity.

### Tasks

1. **Extract game logic from `game.jsx`**
   - Create `src/engine.js` with pure functions:
     ```javascript
     // Pure functions, no React, no side effects
     const Engine = {
       createDeck(customCards = []), // See Custom Cards section below
       shuffle(deck),
       deal(deck, playerCount, handSize),
       canPlay(card, topCard, currentColor),
       playCard(gameState, playerId, cardId),
       drawCard(gameState, playerId),
       applyCardEffect(gameState, card), // skip, reverse, +2, wild, etc.
       nextPlayer(gameState),
       checkWinner(gameState),
       calculateScore(hand),
     };
     ```

2. **Game state shape (single source of truth)**

   ```javascript
   // src/gameState.jsx — React context or hook
   {
     gameId: 'local-123',
     phase: 'playing' | 'finished',
     direction: 'cw' | 'ccw',
     currentPlayerIndex: 0,
     currentColor: 'red', // active color after wild
     topCard: { id, color, value },
     deck: [{ id, color, value }, ...],
     discardPile: [...],
     players: [
       {
         id: 'p1',
         name: 'You',
         avatar: { emoji, color },
         hand: [...],
         cardCount: 7, // for opponents
         isConnected: true,
         team: 'A', // 'A' | 'B' | 'C' | 'D' | null (for solo)
       }
     ],
     mode: 'solo' | 'teams' | 'shared-hand', // From room setup
     rules: {
       // Match IDs in src/data.jsx exactly
       stack: true,           // 🥞 Stack Attack
       sevenZero: true,      // 🔄 7-0 Swap
       jumpIn: false,        // 🏃 Jump-In
       progressive: false,    // 💥 Progressive SHOUT
       challenge: true,       // ⚖️ Challenge Wild +4
       drawPlay: false,       // 📚 Draw Until Playable
       noMercy: true,        // 😈 No Mercy
       blankCards: false,    // 🎨 Blank Cards
       points: true,          // 💯 Points Scoring
       noSpecialFinish: true, // 🏁 Can't win on action/wild
     },
     scores: {
       p1: 0,
       p2: 0,
     },
     round: 1,
     winner: null,
   }
   ```

3. **Replace mock data with engine-driven state**
   - `game.jsx` subscribes to game state
   - Cards become actually playable via `Engine.playCard()`
   - Drawing actually removes from deck
   - Turn rotation works end-to-end

4. **Local scoring**
   - Track points per player/team in memory
   - Display running score during game
   - When hand ends, calculate and add to cumulative score
   - First to `scoreTarget` (default 500) wins match

5. **Handle `noSpecialFinish` rule**
   - `checkWinner()` must reject wins where last card is action/wild
   - Only number cards allowed as finishing move when rule enabled

6. **Team mode support**
   - Solo mode: individual scores, individual winner
   - Teams mode: team scores (sum of members), team winner
   - Shared-hand mode: one hand per team, cooperative win

### Success Criteria

- [ ] Can play a complete game from deal to win locally
- [ ] Rules (stack, 7-0 swap, etc.) actually enforce
- [ ] Score updates after each hand
- [ ] Can start new round, continue match

### Database Hook

```javascript
// src/adapters/dbAdapter.js — stub for now
export const dbAdapter = {
  async saveGameState(gameId, state) {
    /* no-op */
  },
  async loadGameState(gameId) {
    return null;
  },
  async logMove(gameId, move) {
    /* no-op */
  },
};
```

All engine operations call `dbAdapter.saveGameState()` — currently no-op, later wired to API.

### Custom Cards Integration

Custom cards from `src/data.jsx` have free-text `effect` fields. Engine cannot interpret arbitrary text.

**Options (pick one):**

1. **Constrain to templates** — Custom card creator offers structured effects:
   - `swapHands: { target: 'choose' | 'all' | 'next' }`
   - `drawCards: { count: N, target: 'self' | 'next' | 'all' }`
   - `skipTurns: { count: N }`
   - `shield: { blocks: ['skip', 'draw2', 'wild4'] }`

2. **Flavor-only wilds** — Treat custom cards as wild cards with fun names; actual effect = wild color change

**Recommendation:** Start with option 2, migrate to option 1 if needed.

---

## Phase 2: Multiplayer Abstraction Layer

**Objective:** Add multiplayer without breaking local play. Support 3 modes:

- **Local:** Pass-and-play on same device
- **LAN:** WebRTC mesh (no server needed)
- **Online:** WebSocket through future server

### Tasks

1. **Create transport abstraction**

   ```javascript
   // src/sync/transport.js
   class BaseTransport {
     async connect(roomId, playerId) {}
     async broadcast(message) {}
     async send(toPlayerId, message) {}
     onMessage(callback) {}
     disconnect() {}
   }

   class LocalTransport extends BaseTransport {
     // Single device, no network. Broadcast = local emit.
   }

   class WebRTCTransport extends BaseTransport {
     // Mesh network for LAN play
   }

   class WebSocketTransport extends BaseTransport {
     // Future: connect to server
   }
   ```

2. **Sync layer (authoritative client for now)**

   ```javascript
   // src/sync/syncEngine.js
   class SyncEngine {
     constructor(transport, gameState, isHost) {
       // Host = authoritative (for now, until server exists)
       // All clients validate, host resolves conflicts
     }

     async submitMove(move) {
       // 1. Optimistically apply locally
       // 2. Broadcast to peers
       // 3. Wait for acknowledgments
       // 4. If conflict, host version wins
     }

     onPeerMove(move) {
       // Apply remote move, update game state
     }

     onPeerJoin(player) {
       /* add to game */
     }
     onPeerLeave(playerId) {
       /* mark disconnected, AI takeover or pause */
     }
   }
   ```

   **Interactive Moves (Challenge, Jump-In):**
   - **Challenge +4:** After wild4 played, next player has 5s to challenge. If challenged, reveal hand to all; loser draws 4 (or 6 if challenge wrong). Requires request/response flow, not fire-and-forget.
   - **Jump-In:** Any player can play identical card out-of-turn. Opens 2s window after each play. If jump-in succeeds, turn skips to jumper.
   - **Turn Timer:** If `turn_timer_sec` expires, auto-draw 1 card (or auto-play first legal if enabled). Timer resets on any valid action.

   ```

   ```

3. **Room setup → transport selection**
   - Room screen adds "Play Mode" section:
     - Same Device (LocalTransport)
     - Local Network / WiFi (WebRTCTransport)
     - Internet (WebSocketTransport — shows "coming soon" for now)
   - Generate/join room code triggers transport.connect()

4. **Presence & reconnection**
   - Show connection status per player (green dot)
   - If player disconnects:
     - < 30s: Pause, wait for reconnect
     - > 30s: Replace with AI or allow kick

5. **AI Takeover (Minimal Bot)**
   ```javascript
   // src/ai.js — Dumb but legal
   const AI = {
     chooseMove(gameState, playerId) {
       // 1. Play first legal card found
       // 2. If wild, pick most common color in hand
       // 3. If no legal card, draw
       // 4. If drawn card legal, play it immediately (if rules allow)
       return { type: "play", cardId } | { type: "draw" };
     },
   };
   ```

   - Runs locally on host device when peer disconnects
   - Replaces player until they reconnect or hand ends

### Success Criteria

- [ ] Can create LAN room, see peers join in real-time
- [ ] Moves sync across devices within ~200ms
- [ ] If host leaves, new host elected (or game pauses)
- [ ] Graceful handling of disconnects

### Database Hook

```javascript
// src/adapters/syncAdapter.js
export const syncAdapter = {
  // Currently uses WebRTC signaling server (can be simple HTTP)
  async signalJoin(roomCode, playerInfo) {
    return { peers: [...] }; // For WebRTC handshake
  },

  // Future: WebSocket auth
  async authenticate(token) { return { userId: 'temp-' + Date.now() }; },
};
```

---

## Phase 3: Temporary Scoring & Match State

**Objective:** Keep scores for the duration of a match (multiple rounds), persist only to `localStorage` for now.

### Tasks

1. **Match state management**

   ```javascript
   // src/matchState.js
   const MatchState = {
     load(roomId) {
       // Try localStorage first: `match:${roomId}`
       // Return saved state or fresh match
     },

     save(roomId, state) {
       // localStorage.setItem(`match:${roomId}`, JSON.stringify(state))
     },

     clear(roomId) {
       localStorage.removeItem(`match:${roomId}`);
     },
   };
   ```

2. **Match structure**

   ```javascript
   {
     roomId: 'abc123',
     createdAt: Date,
     players: [...], // locked at start
     targetScore: 500,
     currentRound: 3,
     cumulativeScores: { p1: 245, p2: 380, p3: 120 },
     roundHistory: [
       { winner: 'p2', scores: { p1: 85, p2: 0, p3: 120 } },
       { winner: 'p1', scores: { p1: 0, p2: 195, p3: 0 } },
     ],
     status: 'active' | 'finished',
     winner: null | playerId,
   }
   ```

3. **Score display UI**
   - Game screen shows score strip: "Round 3 · You: 245 · Priya: 380 · Kofi: 120"
   - End-of-hand modal: shows who won hand, points awarded, cumulative scores
   - End-of-match screen: winner celebration, option to rematch or exit

4. **Resume interrupted match**
   - Lobby checks `localStorage` for `match:*` keys
   - Shows "Resume Game" card if match in progress
   - Clicking restores full game state

### Tweak Panel State (Local-Only)

Tweaks (card style, hand curve, big SHOUT, chaos mode) are **per-device preferences**, not synced.

- Stored in `localStorage` under `shout.tweaks` (separate from match state)
- Each device sees their own card style, hand layout
- Does not affect gameplay logic, only presentation

### Success Criteria

- [ ] Scores persist across browser refresh
- [ ] Can play multi-round match (first to 500)
- [ ] Can resume interrupted game
- [ ] End-of-match shows correct winner

### Database Hook

```javascript
// src/adapters/scoreAdapter.js
export const scoreAdapter = {
  async saveMatch(matchState) {
    // Current: localStorage
    MatchState.save(matchState.roomId, matchState);

    // Future: await fetch(`/api/matches/${matchState.roomId}`, { method: 'PUT', body })
  },

  async loadMatch(roomId) {
    // Current: localStorage
    return MatchState.load(roomId);

    // Future: return fetch(`/api/matches/${roomId}`).then(r => r.json())
  },
};
```

---

## Phase 4: Integration Hooks (Prep for DB/Redis)

**Objective:** All data flows through adapter pattern. Swapping from local to backend = changing adapter implementations only.

### Adapter Pattern

```
src/
├── adapters/
│   ├── gameAdapter.js      // Game state persistence
│   ├── syncAdapter.js      // Multiplayer transport
│   ├── scoreAdapter.js     // Match/round scoring
│   └── index.js            // Export current adapters
├── engine/
│   ├── gameEngine.js       // Pure game logic
│   └── rules/              // Individual rule implementations
├── sync/
│   ├── transport.js        // Base transport classes
│   ├── syncEngine.js       // Conflict resolution
│   └── signaling/          // WebRTC / WebSocket signaling
└── state/
    ├── gameState.jsx       // React context/hooks
    ├── matchState.js       // Match persistence logic
    └── useGame.js          // Hook: useGame(roomId)
```

### Migration Path

| Phase     | Adapter        | Implementation                    |
| --------- | -------------- | --------------------------------- |
| **Now**   | `gameAdapter`  | In-memory + `localStorage` backup |
| **Now**   | `syncAdapter`  | WebRTC mesh for LAN               |
| **Now**   | `scoreAdapter` | `localStorage` only               |
| **Later** | `gameAdapter`  | PostgreSQL via REST API           |
| **Later** | `syncAdapter`  | WebSocket + Redis pub/sub         |
| **Later** | `scoreAdapter` | PostgreSQL persistent scores      |

### Code Example: Future Migration

```javascript
// src/adapters/index.js — swap implementations here

// Current (local-only)
export { gameAdapter } from "./localGameAdapter.js";
export { syncAdapter } from "./webRtcAdapter.js";
export { scoreAdapter } from "./localScoreAdapter.js";

// Future (database-backed) — single file change
// export { gameAdapter } from './apiGameAdapter.js';
// export { syncAdapter } from './webSocketAdapter.js';
// export { scoreAdapter } from './apiScoreAdapter.js';
```

---

## Priority Order

1. **Engine extraction** (Week 1) — Makes everything else testable
2. **Local play end-to-end** (Week 1-2) — Deal, play, win, score
3. **Transport abstraction** (Week 2-3) — LAN multiplayer
4. **Match persistence** (Week 3) — Resume, multi-round
5. **Polish** (Week 4) — Reconnect, error states, AI takeover

---

## Testing Strategy

- **Engine:** Unit tests for all `Engine.*` functions (pure logic, easy to test)
- **Sync:** Mock transport for deterministic multiplayer simulation
- **Adapters:** Mock implementations that record calls, verify integration

### Test Harness

Add `test/engine.test.html` — loads engine.js and runs assertions:

```html
<script src="../src/engine.js"></script>
<script>
  // Basic sanity checks
  const deck = Engine.createDeck();
  console.assert(deck.length === 108, "Standard deck has 108 cards");

  const shuffled = Engine.shuffle([...deck]);
  console.assert(shuffled.length === 108, "Shuffle preserves count");

  // Add more tests as engine grows
  console.log("Engine tests passed");
</script>
```

---

## Files to Create/Modify

| File                      | Action | Purpose                             |
| ------------------------- | ------ | ----------------------------------- |
| `src/engine.js`           | Create | Pure game logic                     |
| `src/adapters/*.js`       | Create | Persistence abstractions            |
| `src/sync/*.js`           | Create | Multiplayer layer                   |
| `src/state/gameState.jsx` | Create | React integration                   |
| `src/game.jsx`            | Modify | Use engine + state, not mock data   |
| `src/room.jsx`            | Modify | Add transport selection             |
| `src/data.jsx`            | Keep   | Still seed data, but engine uses it |

### Current Backend Progress

- Express API scaffold now exists under `server/` with contracts for rooms, room state, moves, leaderboard, history, and custom cards.
- PostgreSQL migration scaffold exists under `server/migrations/`.
- Frontend now supports feature-flagged backend data mode via `?backend=1` or `localStorage` flag.

### Directory Restructure Note

Moving to `src/{engine,adapters,sync,state}/` subfolders requires updating `<script src="...">` tags in `Noni's Card House.html`. Do this as a single explicit task in Phase 1 to avoid broken imports.
