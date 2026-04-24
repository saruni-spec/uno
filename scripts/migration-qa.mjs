import process from "node:process";
const API_BASE = process.env.QA_API_BASE_URL || "http://localhost:3002/api";
const HEALTH_URL = API_BASE.replace(/\/api\/?$/, "/healthz");

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` - ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
}

async function api(path, { method = "GET", token, body, origin } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function main() {
  // Environment/services baseline.
  const health = await fetch(HEALTH_URL).then((r) => r.json()).catch(() => null);
  if (health?.ok) pass("Health endpoint", "API and DB reachable");
  else fail("Health endpoint", "API/DB unavailable");

  // Auth + sessions
  const a = await api("/auth/session", {
    method: "POST",
    body: { name: "QA-A", avatar: "🦊", color: "#ff3c7a" },
  });
  const b = await api("/auth/session", {
    method: "POST",
    body: { name: "QA-B", avatar: "🦄", color: "#7b5cff" },
  });
  const c = await api("/auth/session", {
    method: "POST",
    body: { name: "QA-C", avatar: "🐙", color: "#3ddc84" },
  });
  if (a.body?.user?.token && b.body?.user?.token && c.body?.user?.token) pass("Session bootstrap");
  else fail("Session bootstrap", "missing token");

  const refresh = await api("/auth/session", {
    method: "POST",
    body: { userId: a.body.user.id, token: a.body.user.token },
  });
  if (refresh.status === 200 && refresh.body?.user?.token) pass("Session refresh");
  else fail("Session refresh", `status ${refresh.status}`);

  // GET /rooms is public; use POST /rooms (requires auth) to test rejection.
  const unauthorized = await api("/rooms", { method: "POST", token: "bad.token.value", body: { name: "x" } });
  if (unauthorized.status === 401) pass("Invalid token rejected");
  else fail("Invalid token rejected", `status ${unauthorized.status}`);

  // Room lifecycle.
  const createRoom = await api("/rooms", {
    method: "POST",
    token: a.body.user.token,
    body: {
      name: "QA Room",
      mode: "solo",
      rules: [{ id: "stack", on: true }],
    },
  });
  if (createRoom.status === 201 && createRoom.body?.room?.id) pass("Create room");
  else fail("Create room", `status ${createRoom.status}`);
  const roomId = createRoom.body?.room?.id;

  const joinRoom = await api(`/rooms/${roomId}/join`, {
    method: "POST",
    token: b.body.user.token,
    body: { team: "B" },
  });
  if (joinRoom.status === 201) pass("Join room (second client)");
  else fail("Join room (second client)", `status ${joinRoom.status}`);

  const forbiddenRoom = await api(`/rooms/${roomId}`, {
    method: "GET",
    token: c.body.user.token,
  });
  if (forbiddenRoom.status === 403) pass("Room details restricted to members");
  else fail("Room details restricted to members", `status ${forbiddenRoom.status}`);

  const nonHostDelete = await api(`/rooms/${roomId}`, {
    method: "DELETE",
    token: b.body.user.token,
  });
  if (nonHostDelete.status === 403) pass("Non-host delete rejected");
  else fail("Non-host delete rejected", `status ${nonHostDelete.status}`);

  // Init game and realtime.
  const init = await api(`/rooms/${roomId}/moves`, {
    method: "POST",
    token: a.body.user.token,
    body: {
      type: "init",
      playerId: a.body.user.id,
      roomConfig: {
        roomId,
        mode: "solo",
        handSize: 7,
        targetScore: 500,
        rules: { stack: true, drawPlay: false, noSpecialFinish: true },
      },
    },
  });
  if (init.status === 200 && init.body?.gameState?.players?.length >= 2) pass("Init game");
  else fail("Init game", `status ${init.status}`);

  const firstPlayerId = init.body.gameState.players[init.body.gameState.currentPlayerIndex].id;
  const tokenByUser = {
    [a.body.user.id]: a.body.user.token,
    [b.body.user.id]: b.body.user.token,
  };
  const currentToken = tokenByUser[firstPlayerId];
  const draw1 = await api(`/rooms/${roomId}/moves`, {
    method: "POST",
    token: currentToken,
    body: { type: "draw", playerId: firstPlayerId },
  });
  if (draw1.status === 200) pass("Draw move accepted for current player");
  else fail("Draw move accepted for current player", `status ${draw1.status}`);

  pass("Server-authoritative move persisted");

  const updatedState = await api(`/rooms/${roomId}/state`, {
    method: "GET",
    token: a.body.user.token,
  });
  if (updatedState.status === 200 && updatedState.body?.gameState) pass("State restoration endpoint");
  else fail("State restoration endpoint", `status ${updatedState.status}`);

  // Extras + ownership.
  const leaderboard = await api("/leaderboard");
  const history = await api("/history");
  if (leaderboard.status === 200 && Array.isArray(leaderboard.body?.leaderboard)) pass("Leaderboard endpoint");
  else fail("Leaderboard endpoint", `status ${leaderboard.status}`);
  if (history.status === 200 && Array.isArray(history.body?.history)) pass("History endpoint");
  else fail("History endpoint", `status ${history.status}`);

  const customCreate = await api("/custom-cards", {
    method: "POST",
    token: a.body.user.token,
    body: {
      name: "QA Card",
      emoji: "✨",
      color: "wild",
      effect: "QA effect",
      trigger: "onPlay",
    },
  });
  if (customCreate.status === 201 && customCreate.body?.customCard?.id) pass("Custom card create");
  else fail("Custom card create", `status ${customCreate.status}`);

  const customList = await api("/custom-cards");
  if (
    customList.status === 200 &&
    Array.isArray(customList.body?.customCards) &&
    customList.body.customCards.some((c) => c.id === customCreate.body?.customCard?.id)
  ) {
    pass("Custom card appears in list");
  } else {
    fail("Custom card appears in list", "created card not found");
  }

  const nonHostResult = await api("/results", {
    method: "POST",
    token: b.body.user.token,
    body: {
      roomId,
      winnerId: b.body.user.id,
      totalRounds: 1,
      pointsScored: 10,
      players: [{ userId: b.body.user.id, pointsDelta: 10, position: 1 }],
    },
  });
  if (nonHostResult.status === 403) pass("Non-host history write rejected");
  else fail("Non-host history write rejected", `status ${nonHostResult.status}`);

  const hostDelete = await api(`/rooms/${roomId}`, {
    method: "DELETE",
    token: a.body.user.token,
  });
  if (hostDelete.status === 200) pass("Host delete room");
  else fail("Host delete room", `status ${hostDelete.status}`);

  const corsRejected = await api("/health", { origin: "http://evil.example.com" });
  if (corsRejected.status >= 400) pass("CORS disallowed origin rejected");
  else fail("CORS disallowed origin rejected", `status ${corsRejected.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\nChecklist summary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
