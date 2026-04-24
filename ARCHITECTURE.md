# Noni's Card House — Architecture Plan

## Overview

A client-side React prototype for a multiplayer shedding-card game. Built as a single-page application with no build step — React + Babel are loaded via CDN, JSX components are browser-compiled.

---

## Directory Structure

```
/
├── Noni's Card House.html   # Entry point: loads fonts, CDN libs, and all JSX modules
├── README.md              # Feature documentation and usage guide
├── ARCHITECTURE.md        # This document
└── src/
    ├── styles.css         # All styling: design tokens, components, animations
    ├── data.jsx           # Static seed data: rooms, players, rules, leaderboard
    ├── components.jsx     # Reusable UI primitives
    ├── app.jsx            # App shell: routing, layout, tweaks panel
    ├── lobby.jsx          # Lobby screen: room discovery, hero, create room
    ├── room.jsx           # Room setup: personalization, teams, rules, invite
    ├── game.jsx           # Game table: hand, opponents, deck/discard, chat
    └── extras.jsx         # Card creator + stats/leaderboard/history
```

---

## Module Architecture

### 1. Entry Point (`Noni's Card House.html`)

**Responsibilities:**

- Load Google Fonts (Lilita One, Fredoka, JetBrains Mono)
- Load React 18 + ReactDOM via CDN
- Load Babel standalone for JSX compilation
- Mount the root React tree

**Dependencies:**

- React 18.x (UMD)
- ReactDOM 18.x (UMD)
- Babel standalone 7.x

**Load Order:**

1. CSS (`src/styles.css`)
2. React + ReactDOM
3. Babel
4. Data layer (`src/data.jsx`)
5. Components (`src/components.jsx`)
6. Screen modules (`lobby.jsx` → `room.jsx` → `game.jsx` → `extras.jsx`)
7. App shell (`src/app.jsx`)

---

### 2. Data Layer (`src/data.jsx`)

**Pattern:** Global static seed data attached to `window.APP_DATA`

**Data Categories:**

- `currentUser`: Player profile (id, name, avatar, color)
- `avatars`: Pool of 28 emoji avatars
- `avatarBg`: 12 background color options
- `felts`: 6 table background designs
- `cardBacks`: 6 card back patterns
- `roomIcons`: 16 room emoji icons
- `houseRules`: 10 toggleable rules with defaults
- `rooms`: 4 sample room objects for lobby
- `gameState`: Mock game state for prototype
- `leaderboard`: 8 sample player stats
- `history`: 6 recent game records
- `customCards`: 4 sample user-created cards

**Future Evolution:**

- Replace with API calls to backend
- Add localStorage persistence layer
- Migrate to state management (Zustand/Redux) when multiplayer sync arrives

---

### 3. Component Library (`src/components.jsx`)

**Pattern:** Functional components exported to `window` for cross-module access

| Component  | Props                                                                                | Description                                     |
| ---------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `Card`     | `color`, `value`, `sym`, `size`, `back`, `onClick`, `playable`, `className`, `style` | Main card primitive with face/back states       |
| `MiniCard` | `color`, `value`, `angle`, `x`, `y`, `size`                                          | Positionable card variant for fanned displays   |
| `Avatar`   | `av`, `bg`, `size`                                                                   | Circular avatar with emoji + colored background |
| `Switch`   | `on`, `onChange`                                                                     | Toggle switch control                           |
| `Sticker`  | `className`, `children`, `style`                                                     | Inline badge/chip element                       |
| `Confetti` | `onDone`                                                                             | Animated confetti burst effect                  |

**Design Tokens (via CSS classes):**

- Card sizes: `xs`, `sm`, `md`, `lg`
- Card colors: `red`, `yellow`, `green`, `blue`, `wild`
- Card states: `playable`, `unplayable`, `back`

---

### 4. App Shell (`src/app.jsx`)

**Responsibilities:**

- Screen routing with `localStorage` persistence
- Global layout (topbar, background)
- Tweak mode panel for rapid iteration
- CSS variable injection for feature flags

**State:**

```javascript
{
  screen: 'lobby' | 'room' | 'game' | 'cards' | 'stats',
  activeRoom: Room | null,
  tweaksOpen: boolean,
  tweaks: { cardStyle, handCurve, bigShout, chaosMode }
}
```

**Routing Logic:**

- Simple conditional rendering based on `screen` state
- `localStorage.getItem('shout.screen')` for persistence
- Navigation callbacks passed to screen components

**Tweak System:**

- `EDITMODE` JSON block embedded in source for default values
- PostMessage protocol for external editor integration
- CSS variable injection (`--chaos`) for global feature flags

**Topbar Behavior:**

- Topbar with logo, navigation, and profile is hidden on the `game` screen (`hideTopbar = screen === 'game'`)

---

### 5. Screen Modules

#### Lobby (`src/lobby.jsx`)

**Responsibilities:**

- Hero section with logo + CTA
- Live/waiting room cards with felt previews
- Player count and status indicators
- "Create room" tile

**Props:**

```javascript
{
  onEnterRoom: (room) => void,
  onCreateRoom: () => void,
  onNav: (screen) => void
}
```

#### Room Setup (`src/room.jsx`)

**Responsibilities:**

- Room name + icon picker (16 options)
- Table felt selector (6 designs)
- Card back selector (6 patterns)
- Player list with team assignment (A/B/C/D badges)
- Play mode toggle: Solo / Teams / Shared-hand
- House rules panel (all 10 rules as switches)
- Match settings (score target, hand size, turn timer)
- Invite modal (room code, QR, link, wifi, internet)

**State Management:**

- Local component state for form inputs
- Room object passed as prop or created fresh

#### Game Table (`src/game.jsx`)

**Responsibilities:**

- Opponents ring with turn indicator, card counts, team badges
- Center play area: draw pile + direction indicator + discard pile
- Player hand with playable/unplayable state
- Wild color picker modal
- Score strip (team totals, turn timer)
- Chat side panel with emoji reactions
- SHOUT button (appears when ≤2 cards)

**Local Game Logic:**

- `canPlay()` validation — enforces color/number matching, wild card rules
- Direction flip on reverse cards
- Random card draw from deck
- Working wild-color picker that changes the top card color

**Data Source:**

- Reads from `window.APP_DATA.gameState` (enhanced with local state for interactivity)

#### Extras (`src/extras.jsx`)

**Responsibilities:**

- Custom card creator with live preview
- Icon picker, color picker (incl. wild)
- Effect description, trigger rules
- Saved deck display
- Stats & history views

**Sub-screens:**

- Card Creator
- Leaderboard (all-time / monthly / weekly filters)
- Game History / Replay

---

### 6. Styling (`src/styles.css`)

**Architecture:**

- CSS custom properties (design tokens) at `:root`
- Utility-first patterns for layout
- Component-specific classes for complex UI
- Animation keyframes for motion

**Design Tokens:**

```css
/* Base Colors */
--bg-0: #120a2a;
--bg-1: #1a1040;
--bg-2: #241454;
--ink: #fff6e6;
--ink-dim: #bfb4dc;

/* Card Colors */
--card-red: #ff4d6d;
--card-yellow: #ffc93c;
--card-green: #3ddc84;
--card-blue: #4a8cff;
--card-wild: #7b5cff;

/* Accents */
--accent: #ff3c7a;
--accent-2: #ffd23f;
--accent-3: #3ddcc8;
--accent-4: #7b5cff;
```

**Feature Flags (via CSS):**

- `.chaos` class toggled on `document.body` via `app.jsx` (stub — no visible styles currently defined in `styles.css`)
- `--chaos` CSS variable set to `1` or `0` for future conditional animations

---

## Data Flow

### Current (Prototype)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  data.jsx   │────→│ Components  │←────│  Screen.jsx │
│(static seed)│     │(primitives) │     │(screen UI)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                                         ┌──────┴──────┐
                                         │   app.jsx   │
                                         │(router/tweaks)│
                                         └─────────────┘
```

### Future (Multiplayer)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API /     │←───→│ State Store │←───→│  Screen.jsx │
│ WebSocket   │     │(Zustand/    │     │  Components │
│   Server    │     │  React Query)│     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                                               ↑
                                         ┌─────┴─────┐
                                         │  app.jsx  │
                                         └───────────┘
```

---

## State Management Strategy

### Current

- **Local component state** via `React.useState`
- **Persistence** via `localStorage` (screen only)
- **Global data** via `window.APP_DATA`

### Migration Path

1. **Phase 1:** Add `localStorage` persistence for user preferences, custom cards, recent rooms
2. **Phase 2:** Introduce Zustand for client-side game state when adding real game engine
3. **Phase 3:** Add React Query for server state sync when multiplayer arrives

---

## Key Technical Decisions

| Decision                     | Rationale                                                                   |
| ---------------------------- | --------------------------------------------------------------------------- |
| **No build step**            | Rapid iteration, no tooling overhead for prototype                          |
| **CDN React**                | Single HTML file deployment, easy sharing                                   |
| **Babel standalone**         | JSX compilation in browser, no webpack/etc                                  |
| **CSS not CSS-in-JS**        | Performance, simpler debugging, design tokens in one file                   |
| **Global window exports**    | Cross-module component sharing without bundler                              |
| **localStorage persistence** | Zero-backend required for screen state (key: `shout.screen` — legacy brand) |
| **Static seed data**         | Demonstrates all UI states immediately                                      |

---

## Extension Points

### Adding a New Screen

1. Create `src/newscreen.jsx`
2. Export component to `window`
3. Add route in `app.jsx` nav array
4. Add conditional render in App component
5. Add screen button in Tweaks panel

### Adding a New Component

1. Add to `src/components.jsx`
2. Export to `window` for cross-module use
3. Add styles to `src/styles.css`

### Adding a New House Rule (Preset)

1. Add entry to `window.APP_DATA.houseRules` in `src/data.jsx`
2. Rule will auto-appear in Room setup UI

> **Note:** Source of truth for the rule list is `src/data.jsx`. The doc table may drift from actual rules — always reference the code.

### Adding Free-Text Custom Rules

No code edit required — the Room setup panel supports runtime free-text custom rules that appear as removable chips.

### Future: Adding Real Multiplayer

1. Replace `window.APP_DATA` with API client
2. Add WebSocket/WebRTC transport layer
3. Replace mock game state with server-synced state
4. Add connection status UI

---

## Performance Considerations

- **No virtual list** — assume max 10 players, 108 cards
- **CSS animations** preferred over JS for 60fps
- **Memoization** not currently used (re-render all on state change acceptable for prototype)
- **Image assets** — none, all CSS/SVG for instant load

---

## Browser Compatibility

- **Target:** Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- **Requirements:**
  - ES6+ (classes, arrow functions, destructuring)
  - CSS custom properties
  - CSS Grid & Flexbox
  - React 18 concurrent features

---

## Security Notes

- `localStorage` — no sensitive data stored
- `postMessage` — tweak protocol uses `'*'` origin (acceptable for local prototype only)
- XSS — All content is static; sanitize before adding user-generated room names/chat

---

## Database Architecture

### Overview

**Recommended Stack:** PostgreSQL (primary persistence) + Redis (real-time game state / pub-sub)

**Alternative (MVP):** Supabase (PostgreSQL + built-in realtime subscriptions)

---

### PostgreSQL Schema

#### Core Tables

```sql
-- Users & Profiles
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  avatar_emoji VARCHAR(8) DEFAULT '🦊',
  avatar_color VARCHAR(7) DEFAULT '#ff3c7a',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);

-- User Statistics (denormalized for fast leaderboard reads)
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wins INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  games_finished INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_stats_points ON user_stats(points DESC);
CREATE INDEX idx_user_stats_wins ON user_stats(wins DESC);

-- Rooms (active lobbies/games)
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL, -- Short room code for invites (e.g., "A1B2C3D4")
  name VARCHAR(64) NOT NULL,
  icon VARCHAR(8) DEFAULT '🎉',
  host_user_id UUID NOT NULL REFERENCES users(id),
  felt_theme VARCHAR(32) DEFAULT 'classic', -- classic, neon, candy, midnight, jungle, sunset
  card_back VARCHAR(32) DEFAULT 'classic',
  max_players INTEGER DEFAULT 8 CHECK (max_players BETWEEN 2 AND 10),
  mode VARCHAR(16) DEFAULT 'solo' CHECK (mode IN ('solo', 'teams', 'shared-hand')),
  status VARCHAR(16) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'expired')),
  score_target INTEGER DEFAULT 500,
  hand_size INTEGER DEFAULT 7,
  turn_timer_sec INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_status ON rooms(status) WHERE status IN ('waiting', 'playing');
CREATE INDEX idx_rooms_expires ON rooms(expires_at) WHERE status = 'waiting';

-- Room Players (many-to-many with team assignment)
CREATE TABLE room_players (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team VARCHAR(1) CHECK (team IN ('A', 'B', 'C', 'D')),
  seat_index INTEGER CHECK (seat_index BETWEEN 0 AND 9),
  is_ready BOOLEAN DEFAULT FALSE,
  is_host BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_room_players_room ON room_players(room_id);
CREATE INDEX idx_room_players_user ON room_players(user_id);

-- House Rules (per-room configuration)
CREATE TABLE room_rules (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  rule_id VARCHAR(32) NOT NULL, -- matches rule IDs in client
  is_enabled BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (room_id, rule_id)
);

-- Active Games
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  deck_cards JSONB NOT NULL, -- encrypted/hashed representation
  discard_pile JSONB NOT NULL DEFAULT '[]',
  current_player_index INTEGER DEFAULT 0,
  direction VARCHAR(3) DEFAULT 'cw' CHECK (direction IN ('cw', 'ccw')),
  turn_started_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished')),
  winner_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_games_room ON games(room_id);
CREATE INDEX idx_games_status ON games(status) WHERE status = 'active';

-- Player Hands (sensitive - encrypt at application layer)
CREATE TABLE game_hands (
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  cards_encrypted TEXT NOT NULL, -- client-encrypted card data
  card_count INTEGER DEFAULT 7, -- denormalized for opponent visibility
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX idx_game_hands_game ON game_hands(game_id);

-- Custom Cards (user-generated content)
CREATE TABLE custom_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(64) NOT NULL,
  emoji VARCHAR(8) DEFAULT '✨',
  color VARCHAR(16) CHECK (color IN ('red', 'yellow', 'green', 'blue', 'wild')),
  effect_text TEXT NOT NULL,
  trigger_rule VARCHAR(64),
  is_official BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT TRUE, -- moderation flag
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_cards_creator ON custom_cards(created_by_user_id);
CREATE INDEX idx_custom_cards_official ON custom_cards(is_official) WHERE is_official = TRUE;

-- Chat Messages (archived)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(16) DEFAULT 'text' CHECK (message_type IN ('text', 'emoji', 'system')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_room ON chat_messages(room_id, created_at DESC);

-- Game Results (history/leaderboard source)
CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  winner_user_id UUID REFERENCES users(id),
  duration_sec INTEGER,
  total_rounds INTEGER DEFAULT 1,
  points_scored INTEGER,
  rules_used JSONB, -- snapshot of active rules
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_results_winner ON game_results(winner_user_id);
CREATE INDEX idx_results_played ON game_results(played_at DESC);

-- Individual Player Results
CREATE TABLE player_results (
  game_result_id UUID REFERENCES game_results(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  team VARCHAR(1),
  final_card_count INTEGER,
  position INTEGER CHECK (position BETWEEN 1 AND 10),
  points_delta INTEGER DEFAULT 0,
  PRIMARY KEY (game_result_id, user_id)
);
```

---

### Indexes & Constraints Summary

| Table           | Index/Constraint        | Purpose                  |
| --------------- | ----------------------- | ------------------------ |
| `users`         | `UNIQUE(username)`      | Fast login lookup        |
| `rooms`         | `UNIQUE(code)`          | Room invite resolution   |
| `rooms`         | `status + expires_at`   | Cleanup cron job filter  |
| `room_players`  | `(room_id, user_id)` PK | Prevent duplicate joins  |
| `games`         | `UNIQUE(room_id)`       | One active game per room |
| `user_stats`    | `(points DESC)`         | Leaderboard pagination   |
| `chat_messages` | `(room_id, created_at)` | Message history fetch    |

---

### Redis Key Patterns

#### Game State (Hot Path)

```
# Active game state - TTL 24 hours
room:{roomId}:game:state -> Hash {
  gameId, currentPlayerIndex, direction,
  deckCount, topCard, status, turnStartedAt
}

# Player hands (encrypted) - TTL 24 hours
room:{roomId}:player:{userId}:hand -> String (encrypted JSON)

# Player metadata (for opponent view)
room:{roomId}:player:{userId}:meta -> Hash {
  cardCount, team, username, avatar, isConnected
}

# Pub/Sub channels
room:{roomId}:events -> Channel (game moves, joins, leaves)
room:{roomId}:chat -> Channel (chat messages)
```

#### Connection & Presence

```
# User session mapping
user:{userId}:session -> String (websocket connection ID)
user:{userId}:rooms -> Set (room IDs user is in)

# Room presence
room:{roomId}:presence -> Set (user IDs currently connected)
room:{roomId}:spectators -> Set (viewer user IDs)
```

#### Rate Limiting & Counters

```
# Move rate limiting
rate:move:{userId}:{hour} -> Counter (max 60 moves/hour)

# Chat rate limiting
rate:chat:{userId}:{minute} -> Counter (max 20 messages/minute)

# Room creation limiting
rate:room:{userId}:{hour} -> Counter (max 10 rooms/hour)
```

#### Caching

```
# Leaderboard cache - TTL 5 minutes
leaderboard:{filter}:{page} -> String (JSON array)

# User profile cache - TTL 1 hour
profile:{userId} -> String (JSON)

# Room list cache - TTL 30 seconds
rooms:public:{sort} -> String (JSON array)
```

---

### Data Flow Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Client    │←──────────────────→│   Server    │
│  (Browser)  │    (Socket.io)    │   (Node)    │
└─────────────┘                     └──────┬──────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
              ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
              │   Redis   │       │  PostgreSQL│       │   Redis   │
              │  Pub/Sub  │       │  (Primary) │       │   Cache   │
              │  (Events) │       │ (Persistence)│    │  (Leaderboard)│
              └───────────┘       └───────────┘       └───────────┘
```

**Write Flow:**

1. Client sends move → Server
2. Server validates against `room:{id}:game:state` (Redis)
3. Server updates game state in Redis
4. Server persists move to PostgreSQL (async queue)
5. Server publishes event to `room:{id}:events` (Redis)
6. All clients receive event via WebSocket

**Read Flow:**

1. Client requests leaderboard
2. Server checks `leaderboard:alltime:1` (Redis)
3. Cache hit → return immediately
4. Cache miss → query PostgreSQL, populate cache, return

---

### Supabase Alternative (Simplified)

If using Supabase instead of self-hosted:

**Pros:**

- Built-in authentication
- Row Level Security (RLS) policies
- Realtime subscriptions over WebSocket
- Free tier generous for prototyping

**RLS Policy Example:**

```sql
-- Users can only read their own hands
CREATE POLICY "Users can read own hand only" ON game_hands
  FOR SELECT USING (user_id = auth.uid());

-- Room members can see opponent card counts (but not cards)
CREATE POLICY "Room members see opponent counts" ON game_hands
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_players rp
      JOIN games g ON g.id = game_hands.game_id
      WHERE rp.room_id = g.room_id
      AND rp.user_id = auth.uid()
    )
  );
```

---

### Migration Path from Prototype

| Phase | Action                                     | Tables Affected                  |
| ----- | ------------------------------------------ | -------------------------------- |
| **1** | Deploy schema, add API endpoints           | All tables                       |
| **2** | Replace `window.APP_DATA` with fetch calls | `users`, `rooms`                 |
| **3** | Add Redis for active game state            | `games`, `game_hands`            |
| **4** | Add WebSocket layer                        | All real-time features           |
| **5** | Add PostgreSQL persistence                 | `game_results`, `player_results` |
| **6** | Migrate to Supabase (optional)             | N/A (drop-in replacement)        |

---

### Security Considerations

| Concern                | Mitigation                                     |
| ---------------------- | ---------------------------------------------- |
| **Hand visibility**    | Encrypt in Redis, only decrypt for owning user |
| **Move validation**    | Server authoritative - validate all plays      |
| **Room code guessing** | 8-char alphanumeric = 2.8 trillion combos      |
| **Rate limiting**      | Redis counters prevent spam                    |
| **SQL injection**      | Parameterized queries, no raw SQL              |
| **XSS in chat**        | Sanitize on client + server                    |
