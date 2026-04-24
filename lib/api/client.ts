import { API_BASE_URL, WS_BASE_URL } from "./config";
import type {
  AuthSessionResponse,
  CustomCard,
  CustomCardResponse,
  CustomCardsResponse,
  HistoryEntry,
  HistoryResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  RoomResponse,
  RoomSummary,
  RoomsResponse,
  SessionUser,
} from "./types";

const USER_KEY = "shout.user";

export function readStoredUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function writeStoredUser(user: SessionUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user.name) localStorage.setItem("shout.username", user.name);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const storedUser = readStoredUser();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (storedUser?.token) headers.authorization = `Bearer ${storedUser.token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      (typeof body.message === "string" && body.message) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function ensureSession(): Promise<SessionUser> {
  const existing = readStoredUser();
  const payload = {
    userId: existing?.id || null,
    token: existing?.token || null,
    name: existing?.name || "Player",
    avatar: existing?.avatar || "🦊",
    color: existing?.color || "#ff3c7a",
  };
  const data = await request<AuthSessionResponse>("/auth/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  writeStoredUser(data.user);
  return data.user;
}

export async function listRooms(): Promise<RoomsResponse["rooms"]> {
  const data = await request<RoomsResponse>("/rooms");
  return data.rooms || [];
}

export async function createRoom(payload: Record<string, unknown>): Promise<RoomSummary> {
  const data = await request<RoomResponse>("/rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.room;
}

export async function joinRoom(roomId: string, payload: Record<string, unknown>) {
  return request<{ room: RoomSummary }>(`/rooms/${roomId}/join`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRoomState(roomId: string) {
  const data = await request<{ gameState: unknown | null }>(`/rooms/${roomId}/state`);
  return data.gameState;
}

export async function submitMove(roomId: string, payload: Record<string, unknown>) {
  return request<{ success: boolean; gameState: unknown; isWinner?: boolean }>(
    `/rooms/${roomId}/moves`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function subscribeRoomState(
  roomId: string,
  onState: (state: unknown) => void,
  onStatus?: (status: "connecting" | "connected" | "closed" | "error") => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  if (!WS_BASE_URL) {
    let cancelled = false;
    onStatus?.("connected");
    const poll = async () => {
      try {
        const next = await getRoomState(roomId);
        if (!cancelled && next) onState(next);
      } catch {
        if (!cancelled) onStatus?.("error");
      }
    };
    const id = window.setInterval(poll, 1500);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
      onStatus?.("closed");
    };
  }

  const user = readStoredUser();
  const token = user?.token;
  if (!token) return () => {};
  onStatus?.("connecting");
  const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`);
  ws.onopen = () => {
    onStatus?.("connected");
    ws.send(JSON.stringify({ type: "subscribe", roomId }));
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(String(event.data || "{}"));
      if (msg.type === "room_state" && msg.roomId === roomId) onState(msg.gameState);
    } catch {
      onStatus?.("error");
    }
  };
  ws.onerror = () => onStatus?.("error");
  ws.onclose = () => onStatus?.("closed");
  return () => ws.close();
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const data = await request<LeaderboardResponse>("/leaderboard");
  return data.leaderboard || [];
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const data = await request<HistoryResponse>("/history");
  return data.history || [];
}

export async function listCustomCards(): Promise<CustomCard[]> {
  const data = await request<CustomCardsResponse>("/custom-cards");
  return data.customCards || [];
}

export async function createCustomCard(payload: {
  name: string;
  emoji: string;
  color: string;
  effect: string;
  trigger: string;
}): Promise<CustomCard> {
  const data = await request<CustomCardResponse>("/custom-cards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.customCard;
}
