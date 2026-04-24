import type { GameState } from "../engine";

export type ActiveMatch = {
  roomId: string;
  updatedAt: number;
  round: number;
  status: "active" | "finished";
  gameState: GameState;
};

const keyFor = (roomId: string) => `next:match:${roomId}`;

export function saveActiveMatch(roomId: string, gameState: GameState): void {
  if (typeof window === "undefined") return;
  const payload: ActiveMatch = {
    roomId,
    updatedAt: Date.now(),
    round: gameState.round || 1,
    status: gameState.phase === "finished" ? "finished" : "active",
    gameState,
  };
  localStorage.setItem(keyFor(roomId), JSON.stringify(payload));
}

export function loadActiveMatch(roomId: string): ActiveMatch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyFor(roomId));
    return raw ? (JSON.parse(raw) as ActiveMatch) : null;
  } catch {
    return null;
  }
}

export function listActiveMatches(): ActiveMatch[] {
  if (typeof window === "undefined") return [];
  const matches: ActiveMatch[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("next:match:")) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key) || "null") as ActiveMatch | null;
      if (entry?.status === "active") matches.push(entry);
    } catch {
      // Ignore malformed entries.
    }
  }
  return matches.sort((a, b) => b.updatedAt - a.updatedAt);
}
