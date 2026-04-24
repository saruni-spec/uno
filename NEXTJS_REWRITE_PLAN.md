# Next.js Rewrite Plan

## 1) Goals And Scope
- Rebuild the app on Next.js while preserving current gameplay behavior.
- Remove global `window.*` architecture in favor of module-based code.
- Keep current Postgres schema and business logic parity.
- Improve security baseline (session auth, strict CORS, env-only config).

## 2) Migration Strategy
- **Strangler pattern**: build Next app in parallel, migrate features incrementally.
- Keep existing backend temporarily to reduce risk.
- Switch one vertical slice at a time (UI + state + API usage).

## 3) Target Stack
- Next.js (App Router) + TypeScript
- React context/reducer for local game state
- Postgres via current SQL layer (phase 1), optional Prisma later
- Auth via secure cookie session (or NextAuth)
- Realtime via WebSocket/SSE (replace heavy polling)

## 4) Phase Plan

### Phase 0: Foundation
- Scaffold Next app with linting/formatting, env setup, route groups.
- Create `lib/engine`, `lib/adapters`, `lib/types`.
- Add CI checks (typecheck, lint, test).

### Phase 1: Engine + Domain Port
- Port `engine.js` to typed module with tests.
- Fix known engine issues during port (wild case, drawMultiple reshuffle, edge deck init).
- Port bot logic as isolated service module.

### Phase 2: Shell + Navigation
- Build app shell/layout/topbar in Next.
- Implement routes: `/lobby`, `/room/[id]`, `/game/[id]`, `/extras`.
- Port design system components from existing UI.

### Phase 3: Data/Backend Integration
- Create typed API client layer.
- Reuse existing Express endpoints first.
- Migrate auth to bearer/cookie sessions in Next-compatible flow.

### Phase 4: Core Screens
- Migrate Lobby and Room setup first.
- Migrate Game table and match lifecycle.
- Migrate leaderboard/history/custom cards.

### Phase 5: Realtime + Multiplayer
- Replace current polling loop with WebSocket/SSE channel.
- Keep fallback polling for resilience.
- Remove broken/legacy SyncAdapter paths.

### Phase 6: Backend Consolidation (optional)
- Move Express routes into Next route handlers if desired.
- Keep DB schema, migrate query layer gradually.

### Phase 7: Hardening + Cutover
- Load/perf checks, replay storage optimization, security audit.
- Feature flag traffic to Next UI.
- Final cutover and legacy cleanup.

## 5) Work Breakdown (Deliverables)
- Next app scaffold with typed modules
- Engine parity test suite green
- Lobby/Room/Game parity milestone demos
- Auth/session migration completed
- Realtime migration completed
- Deployment + Docker updated for Next runtime

## 6) Risk Controls
- Maintain behavior parity tests before replacing screens.
- Keep backend stable while front-end migrates.
- Feature flags for risky changes (realtime/auth).
- Avoid big-bang rewrite; merge in small, reviewable PRs.

## 7) Acceptance Criteria
- All core flows work in Next:
  - create/join room, play full match, stats/history/custom cards
- Multiplayer sync meets latency/consistency target.
- No global namespace dependencies.
- Security baseline met (token/cookie auth + strict origin policy).
- Docker/local dev one-command startup still works.

## 8) Suggested First Sprint (1–2 weeks)
- Scaffold Next app + TypeScript
- Port engine + tests
- Build Lobby page with live room list
- Implement API client and session bootstrap
- Demo: create room and navigate to room setup in Next
