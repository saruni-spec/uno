# Migration Go-Live QA Checklist

Use this checklist to verify the Next.js migration is production-ready.

## 1) Environment and Services

- [ ] `npm install`
- [ ] API env configured (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`)
- [ ] Next env configured (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WS_BASE_URL`, `NEXT_PUBLIC_USE_BACKEND_DATA=true`)
- [ ] DB migrations applied (`npm run db:migrate`)
- [ ] API starts cleanly (`npm run dev:api`)
- [ ] Next app starts cleanly (`npm run dev:next`)

## 2) Static Quality Gates

- [ ] Type-check passes: `npx tsc --noEmit`
- [ ] Engine tests pass: `npm run test:engine`

## 3) Auth and Session

- [ ] First visit creates session successfully
- [ ] Reload preserves valid session token refresh
- [ ] Invalid/expired token returns 401 and session can recover

## 4) Room Lifecycle

- [ ] Create room from `/room/new`
- [ ] Join room from second browser/session
- [ ] Room details are restricted to members
- [ ] Non-host room delete is rejected
- [ ] Host can delete room

## 5) State Sync and Authority

- [ ] Start game in Browser A, Browser B in same room receives state via backend sync
- [ ] Play card in Browser A updates Browser B without manual refresh
- [ ] Draw move in Browser B updates Browser A without manual refresh
- [ ] Refresh mid-hand restores from server state
- [ ] If live subscription is unavailable, gameplay still works via polling

## 6) Rules and Core Gameplay

- [ ] Draw penalty behavior is correct (`+2`, `+4`, stacking rules)
- [ ] Draw-until-playable toggle is respected
- [ ] No-special-finish rule blocks winning on action/wild
- [ ] Scores update at hand end
- [ ] Next hand starts and preserves match context

## 7) Extras and Data Surfaces

- [ ] Leaderboard loads from backend
- [ ] History loads from backend
- [ ] Custom card creation succeeds for authenticated user
- [ ] Custom cards list shows newly created card

## 8) Security Regression Checks

- [ ] CORS rejects disallowed origins
- [ ] Protected routes require bearer token
- [ ] Room membership checks enforced on room state and moves
- [ ] Ownership checks enforced on custom cards/history writes

## 9) Final Sign-off

- [ ] Run two-browser smoke test end-to-end (create room -> play moves -> finish hand)
- [ ] Validate Docker compose startup and connectivity
- [ ] Snapshot known limitations and open follow-ups before release
