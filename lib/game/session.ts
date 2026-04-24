import type { InitGameConfig } from "../engine";

const keyFor = (roomId: string) => `next:room-config:${roomId}`;

export function saveRoomConfig(roomId: string, config: InitGameConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(roomId), JSON.stringify(config));
}

export function loadRoomConfig(roomId: string): InitGameConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyFor(roomId));
    return raw ? (JSON.parse(raw) as InitGameConfig) : null;
  } catch {
    return null;
  }
}
