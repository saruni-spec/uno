export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

// Auto-derive a WebSocket URL from the API base URL. This is used as the
// fallback when NEXT_PUBLIC_WS_BASE_URL is not explicitly set. Note: no
// WebSocket server is currently implemented in this codebase — setting
// NEXT_PUBLIC_WS_BASE_URL will use long-polling via subscribeRoomState as
// the realtime transport instead.
const derivedWsUrl = API_BASE_URL
  .replace(/\/api\/?$/, "")
  .replace(/^http:/, "ws:")
  .replace(/^https:/, "wss:");

export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL ?? derivedWsUrl;

export const BACKEND_ENABLED =
  (process.env.NEXT_PUBLIC_USE_BACKEND_DATA || "true").toLowerCase() !== "false";
