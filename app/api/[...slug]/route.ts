import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "../../../lib/server/db";
import {
  getUserById,
  isUuid,
  JWT_EXPIRES_IN,
  JWT_SECRET,
  randomCode,
  requireAuthUser,
  toClientRoom,
} from "../../../lib/server/api-helpers";
import Engine from "../../../src/engine.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getRoomMembership(client: any, roomId: string, userId: string) {
  const result = await client.query(
    `
      SELECT rp.user_id, rp.is_host
      FROM room_players rp
      WHERE rp.room_id = $1 AND rp.user_id = $2
      LIMIT 1
    `,
    [roomId, userId],
  );
  return result.rowCount ? result.rows[0] : null;
}

async function getRoomMemberUserIds(client: any, roomId: string) {
  const result = await client.query(`SELECT user_id FROM room_players WHERE room_id = $1`, [roomId]);
  return new Set(result.rows.map((r: any) => r.user_id));
}

async function getRoomDetails(client: any, roomId: string) {
  const roomResult = await client.query(
    `
      SELECT
        r.*,
        u.username AS host_name,
        u.avatar_emoji AS host_avatar,
        COUNT(rp.user_id)::int AS player_count,
        COALESCE(SUM(CASE WHEN rr.is_enabled THEN 1 ELSE 0 END), 0)::int AS active_rules
      FROM rooms r
      LEFT JOIN users u ON u.id = r.host_user_id
      LEFT JOIN room_players rp ON rp.room_id = r.id
      LEFT JOIN room_rules rr ON rr.room_id = r.id
      WHERE r.id = $1
      GROUP BY r.id, u.username, u.avatar_emoji
      LIMIT 1
    `,
    [roomId],
  );
  if (!roomResult.rowCount) return null;
  const playersResult = await client.query(
    `
      SELECT
        rp.user_id AS id,
        rp.team,
        rp.is_host,
        rp.is_ready,
        u.username AS name,
        u.avatar_emoji AS av,
        u.avatar_color AS bg
      FROM room_players rp
      JOIN users u ON u.id = rp.user_id
      WHERE rp.room_id = $1
      ORDER BY rp.joined_at ASC
    `,
    [roomId],
  );
  const rulesResult = await client.query(
    `SELECT rule_id, is_enabled FROM room_rules WHERE room_id = $1`,
    [roomId],
  );
  const room: any = toClientRoom(roomResult.rows[0]);
  room.players = playersResult.rows;
  room.rules = rulesResult.rows.map((r: any) => ({ id: r.rule_id, on: r.is_enabled }));
  room.multiplayer = true;
  room.networkMode = "online";
  return room;
}

async function getRoomPlayersForEngine(client: any, roomId: string) {
  const result = await client.query(
    `
      SELECT rp.user_id AS id, rp.team, u.username AS name
      FROM room_players rp
      JOIN users u ON u.id = rp.user_id
      WHERE rp.room_id = $1
      ORDER BY rp.joined_at ASC
    `,
    [roomId],
  );
  return result.rows.map((p: any) => ({ id: p.id, name: p.name, team: p.team || null }));
}

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function forbidden(message: string) {
  return json(403, { error: "forbidden", message });
}

function invalidUuid(field: string) {
  return json(400, { error: "invalid_input", message: `${field} must be a valid uuid` });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const slug = (await params).slug || [];
  if (slug.length === 1 && slug[0] === "health") return json(200, { ok: true });
  if (slug.length === 1 && slug[0] === "healthz") {
    try {
      await query("SELECT 1");
      return json(200, { ok: true, db: "up", ts: Date.now() });
    } catch (error: any) {
      return json(503, { ok: false, db: "down", message: error?.message || "db error" });
    }
  }
  if (slug.length === 1 && slug[0] === "rooms") {
    const result = await query(
      `
        SELECT
          r.*,
          u.username AS host_name,
          u.avatar_emoji AS host_avatar,
          COUNT(rp.user_id)::int AS player_count,
          COALESCE(SUM(CASE WHEN rr.is_enabled THEN 1 ELSE 0 END), 0)::int AS active_rules
        FROM rooms r
        LEFT JOIN users u ON u.id = r.host_user_id
        LEFT JOIN room_players rp ON rp.room_id = r.id
        LEFT JOIN room_rules rr ON rr.room_id = r.id
        WHERE r.status IN ('waiting', 'playing')
        GROUP BY r.id, u.username, u.avatar_emoji
        ORDER BY r.updated_at DESC
        LIMIT 50
      `,
    );
    return json(200, { rooms: (result.rows as any[]).map(toClientRoom) });
  }
  if (slug.length === 2 && slug[0] === "rooms") {
    const user: any = await requireAuthUser(req);
    if (!user) return json(401, { error: "unauthorized", message: "Bearer token is required" });
    const roomId = slug[1];
    if (!isUuid(roomId)) return invalidUuid("roomId");
    const payload = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, user.id);
      if (!membership) return { status: 403, body: { error: "forbidden", message: "Only room members can view room details" } };
      const room = (await getRoomDetails(client, roomId)) as any;
      if (!room) return { status: 404, body: { error: "room not found" } };
      room.isHost = Boolean(membership.is_host);
      return { status: 200, body: { room } };
    });
    return json(payload.status, payload.body);
  }
  if (slug.length === 3 && slug[0] === "rooms" && slug[2] === "state") {
    const user: any = await requireAuthUser(req);
    if (!user) return json(401, { error: "unauthorized", message: "Bearer token is required" });
    const roomId = slug[1];
    if (!isUuid(roomId)) return invalidUuid("roomId");
    const payload = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, user.id);
      if (!membership) return { status: 403, body: { error: "forbidden", message: "Only room members can view game state" } };
      const result = await client.query(
        `SELECT state_json FROM games WHERE room_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [roomId],
      );
      if (!result.rowCount) return { status: 200, body: { gameState: null } };
      return { status: 200, body: { gameState: result.rows[0].state_json } };
    });
    return json(payload.status, payload.body);
  }
  if (slug.length === 1 && slug[0] === "leaderboard") {
    const result = await query(
      `
        SELECT
          u.username AS name,
          u.avatar_emoji AS av,
          u.avatar_color AS bg,
          COUNT(gr.id) FILTER (WHERE gr.winner_user_id = u.id)::int AS wins,
          COALESCE(SUM(pr.points_delta), 0)::int AS points
        FROM users u
        LEFT JOIN player_results pr ON pr.user_id = u.id
        LEFT JOIN game_results gr ON gr.id = pr.game_result_id
        GROUP BY u.id
        ORDER BY points DESC, wins DESC
        LIMIT 20
      `,
    );
    return json(200, { leaderboard: result.rows });
  }
  if (slug.length === 1 && slug[0] === "history") {
    const result = await query(
      `
        SELECT
          gr.id,
          r.name AS room,
          r.icon,
          gr.played_at,
          gr.duration_sec,
          gr.total_rounds AS rounds,
          gr.points_scored AS pts,
          uw.username AS winner,
          uw.avatar_emoji AS winner_av
        FROM game_results gr
        LEFT JOIN rooms r ON r.id = gr.room_id
        LEFT JOIN users uw ON uw.id = gr.winner_user_id
        ORDER BY gr.played_at DESC
        LIMIT 25
      `,
    );
    return json(200, { history: result.rows });
  }
  if (slug.length === 1 && slug[0] === "custom-cards") {
    const result = await query(
      `
        SELECT
          id,
          name,
          emoji,
          color,
          effect_text AS effect,
          trigger_rule AS trigger,
          is_official
        FROM custom_cards
        WHERE is_approved = TRUE
        ORDER BY created_at DESC
        LIMIT 100
      `,
    );
    return json(200, { customCards: result.rows });
  }
  return json(404, { error: "not_found" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const slug = (await params).slug || [];
  const body = await req.json().catch(() => ({}));

  if (slug.length === 2 && slug[0] === "auth" && slug[1] === "session") {
    const { userId, token, name = "Player", avatar = "🦊", color = "#ff3c7a" } = body || {};
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
        const tokenUser = await getUserById(payload?.sub);
        if (tokenUser) {
          const refreshedToken = jwt.sign(
            { sub: tokenUser.id, name: tokenUser.username },
            JWT_SECRET as jwt.Secret,
            { expiresIn: JWT_EXPIRES_IN as any },
          );
          return json(200, {
            user: {
              id: tokenUser.id,
              name: tokenUser.username,
              avatar: tokenUser.avatar_emoji,
              color: tokenUser.avatar_color,
              token: refreshedToken,
            },
          });
        }
      } catch {
        // fall through
      }
    }
    if (userId) {
      const existing = await getUserById(userId);
      if (existing) {
        const sessionToken = jwt.sign(
          { sub: existing.id, name: existing.username },
          JWT_SECRET as jwt.Secret,
          { expiresIn: JWT_EXPIRES_IN as any },
        );
        return json(200, {
          user: {
            id: existing.id,
            name: existing.username,
            avatar: existing.avatar_emoji,
            color: existing.avatar_color,
            token: sessionToken,
          },
        });
      }
    }
    const created = await query(
      `INSERT INTO users (username, avatar_emoji, avatar_color) VALUES ($1,$2,$3)
       RETURNING id, username, avatar_emoji, avatar_color`,
      [name, avatar, color],
    );
    const row: any = created.rows[0];
    const sessionToken = jwt.sign(
      { sub: row.id, name: row.username },
      JWT_SECRET as jwt.Secret,
      { expiresIn: JWT_EXPIRES_IN as any },
    );
    return json(201, {
      user: {
        id: row.id,
        name: row.username,
        avatar: row.avatar_emoji,
        color: row.avatar_color,
        token: sessionToken,
      },
    });
  }

  if (slug.length === 1 && slug[0] === "rooms") {
    const user: any = await requireAuthUser(req);
    if (!user) return json(401, { error: "unauthorized", message: "Bearer token is required" });
    const { name, icon = "🎉", felt = "neon", mode = "solo", maxPlayers = 8, scoreTarget = 500, handSize = 7, turnTimerSec = 30, rules = [] } = body || {};
    if (!name) return json(400, { error: "name is required" });
    const room = await withTransaction(async (client) => {
      const roomResult = await client.query(
        `
          INSERT INTO rooms (
            code, name, icon, host_user_id, felt_theme, mode, max_players,
            score_target, hand_size, turn_timer_sec, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'waiting') RETURNING *
        `,
        [randomCode(), name, icon, user.id, felt, mode, maxPlayers, scoreTarget, handSize, turnTimerSec],
      );
      await client.query(
        `INSERT INTO room_players (room_id, user_id, team, is_ready, is_host) VALUES ($1,$2,'A',TRUE,TRUE)`,
        [roomResult.rows[0].id, user.id],
      );
      for (const rule of rules) {
        await client.query(`INSERT INTO room_rules (room_id, rule_id, is_enabled) VALUES ($1,$2,$3)`, [
          roomResult.rows[0].id,
          rule.id,
          !!rule.on,
        ]);
      }
      return {
        ...roomResult.rows[0],
        host_name: user.username,
        host_avatar: user.avatar_emoji,
        player_count: 1,
        active_rules: rules.filter((r: any) => !!r.on).length,
      };
    });
    return json(201, { room: toClientRoom(room) });
  }

  if (slug.length === 3 && slug[0] === "rooms" && slug[2] === "join") {
    const user: any = await requireAuthUser(req);
    if (!user) return json(401, { error: "unauthorized", message: "Bearer token is required" });
    const roomId = slug[1];
    if (!isUuid(roomId)) return invalidUuid("roomId");
    const { team = null } = body || {};
    const payload = await withTransaction(async (client) => {
      const roomResult = await client.query(`SELECT * FROM rooms WHERE id = $1`, [roomId]);
      if (!roomResult.rowCount) return null;
      await client.query(
        `INSERT INTO room_players (room_id, user_id, team, is_ready, is_host)
         VALUES ($1,$2,$3,FALSE,FALSE) ON CONFLICT DO NOTHING`,
        [roomId, user.id, team],
      );
      const room = await getRoomDetails(client, roomId);
      return { room, user };
    });
    if (!payload) return json(404, { error: "room not found" });
    return json(201, payload);
  }

  if (slug.length === 3 && slug[0] === "rooms" && slug[2] === "moves") {
    const user: any = await requireAuthUser(req);
    if (!user) return json(401, { error: "unauthorized", message: "Bearer token is required" });
    const roomId = slug[1];
    if (!isUuid(roomId)) return invalidUuid("roomId");
    const { type, playerId, cardId, chosenColor, roomConfig } = body || {};
    const normalizedPlayerId =
      !playerId || playerId === "me" ? user.id : typeof playerId === "string" ? playerId : user.id;
    const actorPlayerId = isUuid(normalizedPlayerId) ? normalizedPlayerId : user.id;
    const output = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, user.id);
      if (!membership) return { status: 403, body: { error: "forbidden", message: "Only room members can submit moves" } };
      if ((type === "play" || type === "draw") && actorPlayerId !== user.id) {
        return { status: 403, body: { error: "forbidden", message: "Cannot submit moves for another player" } };
      }
      const gameResult = await client.query(
        `SELECT id, state_json FROM games WHERE room_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [roomId],
      );
      let gameState = gameResult.rowCount ? gameResult.rows[0].state_json : null;
      if (!gameState) {
        const players = await getRoomPlayersForEngine(client, roomId);
        if (!players.length) {
          return { status: 404, body: { error: "room not found" } };
        }
        const roomResult = await client.query(
          `SELECT mode, hand_size, score_target FROM rooms WHERE id = $1 LIMIT 1`,
          [roomId],
        );
        if (!roomResult.rowCount) {
          return { status: 404, body: { error: "room not found" } };
        }
        const rulesResult = await client.query(
          `SELECT rule_id, is_enabled FROM room_rules WHERE room_id = $1`,
          [roomId],
        );
        const rulesFromDb = rulesResult.rows.reduce((acc: Record<string, boolean>, row: any) => {
          acc[row.rule_id] = Boolean(row.is_enabled);
          return acc;
        }, {});
        const roomRow = roomResult.rows[0];
        const safeConfig = {
          roomId,
          mode: roomConfig?.mode || roomRow.mode || "solo",
          handSize: Number(roomConfig?.handSize || roomRow.hand_size || 7),
          targetScore: Number(roomConfig?.targetScore || roomRow.score_target || 500),
          rules: roomConfig?.rules || rulesFromDb,
          players,
        };
        gameState = Engine.initGame(safeConfig);
      }
      if (!gameState) return { status: 404, body: { error: "game not initialized" } };
      const currentPlayer = gameState.players?.[gameState.currentPlayerIndex];
      if ((type === "play" || type === "draw") && currentPlayer?.id !== user.id) {
        return { status: 403, body: { error: "forbidden", message: "Not your turn for this room state" } };
      }
      let moveResult: any = { success: true, gameState };
      if (type === "play") moveResult = Engine.playCard(gameState, actorPlayerId, cardId, chosenColor);
      else if (type === "draw") moveResult = Engine.drawCard(gameState, actorPlayerId);
      if (!moveResult.success) return { status: 400, body: moveResult };
      const nextState = moveResult.gameState;
      if (gameResult.rowCount) {
        await client.query(
          `UPDATE games SET state_json = $1, status = $2, updated_at = NOW() WHERE id = $3`,
          [nextState, nextState.phase === "finished" ? "finished" : "active", gameResult.rows[0].id],
        );
      } else {
        await client.query(`INSERT INTO games (room_id, state_json, status) VALUES ($1,$2,$3)`, [
          roomId,
          nextState,
          nextState.phase === "finished" ? "finished" : "active",
        ]);
      }
      await client.query(
        `INSERT INTO game_moves (room_id, player_id, move_type, payload) VALUES ($1,$2,$3,$4)`,
        [roomId, isUuid(actorPlayerId) ? actorPlayerId : null, type, { cardId, chosenColor }],
      );
      return { status: 200, body: moveResult };
    });
    return json(output.status, output.body);
  }

  if (slug.length === 1 && slug[0] === "custom-cards") {
    const user: any = await requireAuthUser(req);
    if (!user) return json(401, { error: "unauthorized", message: "Bearer token is required" });
    const { name, emoji = "✨", color = "wild", effect, trigger = "onPlay" } = body || {};
    if (!name || !effect) return json(400, { error: "name and effect are required" });
    const result = await query(
      `
        INSERT INTO custom_cards (name, emoji, color, effect_text, trigger_rule, created_by_user_id)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, name, emoji, color, effect_text AS effect, trigger_rule AS trigger, created_by_user_id
      `,
      [name, emoji, color, effect, trigger, user.id],
    );
    return json(201, { customCard: result.rows[0] });
  }

  if (slug.length === 1 && slug[0] === "results") {
    const user: any = await requireAuthUser(req);
    if (!user) return json(401, { error: "unauthorized", message: "Bearer token is required" });
    const { roomId, winnerId, totalRounds = 1, pointsScored = 0, players = [] } = body || {};
    if (!roomId) return json(400, { error: "roomId is required" });
    if (!isUuid(roomId)) return invalidUuid("roomId");
    if (winnerId && !isUuid(winnerId)) return invalidUuid("winnerId");
    const result = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, user.id);
      if (!membership) return { status: 403, body: { error: "forbidden", message: "Only room members can write match history" } };
      if (!membership.is_host) return { status: 403, body: { error: "forbidden", message: "Only room host can write match history" } };
      const roomUserIds = await getRoomMemberUserIds(client, roomId);
      if (winnerId && !roomUserIds.has(winnerId)) return { status: 400, body: { error: "invalid_input", message: "winnerId must belong to the room" } };
      const gameResult = await client.query(
        `INSERT INTO game_results (room_id, winner_user_id, total_rounds, points_scored, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [roomId, winnerId || null, totalRounds, pointsScored, user.id],
      );
      const gameResultId = gameResult.rows[0].id;
      for (const p of players) {
        if (!p?.userId || !isUuid(p.userId)) continue;
        if (p.userId && !roomUserIds.has(p.userId)) continue;
        await client.query(
          `INSERT INTO player_results (game_result_id, user_id, points_delta, position)
           VALUES ($1,$2,$3,$4) ON CONFLICT (game_result_id, user_id) DO NOTHING`,
          [gameResultId, p.userId, p.pointsDelta || 0, p.position || null],
        );
      }
      return { status: 201, body: { id: gameResultId } };
    });
    return json(result.status, result.body);
  }

  return json(404, { error: "not_found" });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const slug = (await params).slug || [];
  if (slug.length === 2 && slug[0] === "rooms") {
    const user: any = await requireAuthUser(req);
    if (!user) return json(401, { error: "unauthorized", message: "Bearer token is required" });
    const roomId = slug[1];
    if (!isUuid(roomId)) return invalidUuid("roomId");
    const payload = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, user.id);
      if (!membership || !membership.is_host) return { status: 403, body: { error: "forbidden", message: "Only room host can delete this room" } };
      const deleted = await client.query(`DELETE FROM rooms WHERE id = $1 RETURNING id`, [roomId]);
      if (!deleted.rowCount) return { status: 404, body: { error: "room not found" } };
      return { status: 200, body: { ok: true, id: deleted.rows[0].id } };
    });
    return json(payload.status, payload.body);
  }
  return forbidden("Unsupported delete endpoint");
}
