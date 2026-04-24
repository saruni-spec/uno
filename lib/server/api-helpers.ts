import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { query } from "./db";

const JWT_SECRET_DEFAULT = "dev-only-change-me";
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  // Forged tokens are trivially possible with a known public secret.
  throw new Error("JWT_SECRET environment variable is required in production.");
} else if (!process.env.JWT_SECRET) {
  console.warn("[auth] JWT_SECRET not set — using insecure default. Set JWT_SECRET before deploying.");
}
export const JWT_SECRET = process.env.JWT_SECRET || JWT_SECRET_DEFAULT;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export function randomCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function toClientRoom(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    hostUserId: row.host_user_id,
    name: row.name,
    icon: row.icon,
    felt: row.felt_theme,
    mode: row.mode,
    status: row.status,
    maxPlayers: row.max_players,
    playerCount: Number(row.player_count || 0),
    host: row.host_name || "Host",
    hostAvatar: row.host_avatar || "🦊",
    activeRules: Number(row.active_rules || 0),
    players: [],
  };
}

export function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

export async function getUserById(userId: unknown) {
  if (!isUuid(userId)) return null;
  const result = await query(
    `
      SELECT id, username, avatar_emoji, avatar_color
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  return result.rowCount ? result.rows[0] : null;
}

export async function requireAuthUser(req: NextRequest) {
  const authHeader = String(req.headers.get("authorization") || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
    if (!payload?.sub) return null;
    return await getUserById(payload.sub);
  } catch {
    return null;
  }
}
