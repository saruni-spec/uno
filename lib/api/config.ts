export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

const defaultWsUrl = API_BASE_URL.replace(/\/api\/?$/, "").replace(/^http:/, "ws:").replace(
  /^https:/,
  "wss:",
);

export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || "";

export const BACKEND_ENABLED =
  (process.env.NEXT_PUBLIC_USE_BACKEND_DATA || "true").toLowerCase() !== "false";
