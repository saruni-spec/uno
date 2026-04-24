const express = require("express");
const Engine = require("../src/engine.js");
const { query, withTransaction } = require("./db");
const { randomCode, toClientRoom } = require("./utils");

const router = express.Router();

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

async function getUserById(userId) {
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

async function requireAuthUser(req, res, next) {
  try {
    const userId = req.header("x-user-id");
    const user = await getUserById(userId);
    if (!user) {
      return res.status(401).json({ error: "unauthorized", message: "Valid x-user-id is required" });
    }
    req.authUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function getRoomMembership(client, roomId, userId) {
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

async function getRoomMemberUserIds(client, roomId) {
  const result = await client.query(
    `
    SELECT user_id
    FROM room_players
    WHERE room_id = $1
    `,
    [roomId],
  );
  return new Set(result.rows.map((r) => r.user_id));
}

async function getRoomDetails(client, roomId) {
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
    `
    SELECT rule_id, is_enabled
    FROM room_rules
    WHERE room_id = $1
    `,
    [roomId],
  );

  const room = toClientRoom(roomResult.rows[0]);
  room.players = playersResult.rows;
  room.rules = rulesResult.rows.map((r) => ({
    id: r.rule_id,
    on: r.is_enabled,
  }));
  room.multiplayer = true;
  room.networkMode = "online";
  return room;
}

router.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

router.post("/auth/session", async (req, res, next) => {
  const {
    userId,
    name = "Player",
    avatar = "🦊",
    color = "#ff3c7a",
  } = req.body || {};
  try {
    if (userId) {
      const existing = await getUserById(userId);
      if (existing) {
        return res.json({
          user: {
            id: existing.id,
            name: existing.username,
            avatar: existing.avatar_emoji,
            color: existing.avatar_color,
          },
        });
      }
    }

    const created = await query(
      `
      INSERT INTO users (username, avatar_emoji, avatar_color)
      VALUES ($1, $2, $3)
      RETURNING id, username, avatar_emoji, avatar_color
      `,
      [name, avatar, color],
    );
    const row = created.rows[0];
    return res.status(201).json({
      user: { id: row.id, name: row.username, avatar: row.avatar_emoji, color: row.avatar_color },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/bootstrap/seed", async (_req, res, next) => {
  try {
    const existingRooms = await query(`SELECT COUNT(*)::int AS count FROM rooms`);
    if (existingRooms.rows[0].count > 0) {
      return res.json({ seeded: false, reason: "already_seeded" });
    }

    const result = await withTransaction(async (client) => {
      const seedUsers = [
        { name: "You", avatar: "🦊", color: "#ff3c7a" },
        { name: "Priya", avatar: "🦄", color: "#7b5cff" },
        { name: "Kofi", avatar: "🐲", color: "#3ddc84" },
        { name: "Mira", avatar: "🐙", color: "#ff3c7a" },
      ];

      const createdUsers = [];
      for (const u of seedUsers) {
        const created = await client.query(
          `
          INSERT INTO users (username, avatar_emoji, avatar_color)
          VALUES ($1, $2, $3)
          RETURNING id, username, avatar_emoji, avatar_color
          `,
          [u.name, u.avatar, u.color],
        );
        createdUsers.push(created.rows[0]);
      }

      const room = await client.query(
        `
        INSERT INTO rooms (
          code, name, icon, host_user_id, felt_theme, mode, max_players,
          score_target, hand_size, turn_timer_sec, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 8, 500, 7, 30, 'waiting')
        RETURNING id
        `,
        [randomCode(), "Saturday Night Chaos", "🎉", createdUsers[1].id, "neon", "teams"],
      );
      const roomId = room.rows[0].id;

      for (let i = 0; i < createdUsers.length; i += 1) {
        const user = createdUsers[i];
        await client.query(
          `
          INSERT INTO room_players (room_id, user_id, team, is_ready, is_host)
          VALUES ($1, $2, $3, TRUE, $4)
          `,
          [roomId, user.id, i % 2 === 0 ? "A" : "B", user.id === createdUsers[1].id],
        );
      }

      const ruleIds = ["stack", "sevenZero", "challenge", "noMercy", "points", "noSpecialFinish"];
      for (const ruleId of ruleIds) {
        await client.query(
          `
          INSERT INTO room_rules (room_id, rule_id, is_enabled)
          VALUES ($1, $2, TRUE)
          `,
          [roomId, ruleId],
        );
      }

      await client.query(
        `
        INSERT INTO custom_cards (
          name, emoji, color, effect_text, trigger_rule, is_official, created_by_user_id
        )
        VALUES
          ('Swap Hands', '🔀', 'wild', 'Choose a player and swap hands with them.', 'onPlay', TRUE, $1),
          ('Shield', '🛡️', 'blue', 'Blocks the next action card played against you.', 'onPlay', TRUE, $1)
        `,
        [createdUsers[1].id],
      );

      return { roomId, users: createdUsers.length };
    });

    return res.status(201).json({ seeded: true, ...result });
  } catch (error) {
    return next(error);
  }
});

router.get("/rooms", async (_req, res, next) => {
  try {
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
    res.json({ rooms: result.rows.map(toClientRoom) });
  } catch (error) {
    next(error);
  }
});

router.get("/rooms/:roomId", requireAuthUser, async (req, res, next) => {
  const { roomId } = req.params;
  try {
    const payload = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, req.authUser.id);
      if (!membership) {
        return {
          status: 403,
          body: { error: "forbidden", message: "Only room members can view room details" },
        };
      }
      const room = await getRoomDetails(client, roomId);
      if (!room) {
        return { status: 404, body: { error: "room not found" } };
      }
      room.isHost = Boolean(membership.is_host);
      return { status: 200, body: { room } };
    });

    return res.status(payload.status).json(payload.body);
  } catch (error) {
    return next(error);
  }
});

router.post("/rooms", requireAuthUser, async (req, res, next) => {
  const {
    name,
    icon = "🎉",
    felt = "neon",
    mode = "solo",
    maxPlayers = 8,
    scoreTarget = 500,
    handSize = 7,
    turnTimerSec = 30,
    rules = [],
  } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const hostUser = req.authUser;
    const room = await withTransaction(async (client) => {
      const roomResult = await client.query(
        `
        INSERT INTO rooms (
          code, name, icon, host_user_id, felt_theme, mode, max_players,
          score_target, hand_size, turn_timer_sec, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'waiting')
        RETURNING *
        `,
        [
          randomCode(),
          name,
          icon,
          hostUser.id,
          felt,
          mode,
          maxPlayers,
          scoreTarget,
          handSize,
          turnTimerSec,
        ],
      );

      await client.query(
        `
        INSERT INTO room_players (room_id, user_id, team, is_ready, is_host)
        VALUES ($1, $2, 'A', TRUE, TRUE)
        `,
        [roomResult.rows[0].id, hostUser.id],
      );

      for (const rule of rules) {
        await client.query(
          `
          INSERT INTO room_rules (room_id, rule_id, is_enabled)
          VALUES ($1, $2, $3)
          `,
          [roomResult.rows[0].id, rule.id, !!rule.on],
        );
      }

      return {
        ...roomResult.rows[0],
        host_name: hostUser.username,
        host_avatar: hostUser.avatar_emoji,
        player_count: 1,
        active_rules: rules.filter((r) => !!r.on).length,
      };
    });

    res.status(201).json({ room: toClientRoom(room) });
  } catch (error) {
    next(error);
  }
});

router.post("/rooms/:roomId/join", requireAuthUser, async (req, res, next) => {
  const { roomId } = req.params;
  const { team = null } = req.body || {};

  try {
    const payload = await withTransaction(async (client) => {
      const roomResult = await client.query(`SELECT * FROM rooms WHERE id = $1`, [roomId]);
      if (!roomResult.rowCount) return null;

      await client.query(
        `
        INSERT INTO room_players (room_id, user_id, team, is_ready, is_host)
        VALUES ($1, $2, $3, FALSE, FALSE)
        ON CONFLICT DO NOTHING
        `,
        [roomId, req.authUser.id, team],
      );

      const room = await getRoomDetails(client, roomId);
      return { room, user: req.authUser };
    });

    if (!payload) {
      return res.status(404).json({ error: "room not found" });
    }

    return res.status(201).json(payload);
  } catch (error) {
    return next(error);
  }
});

router.delete("/rooms/:roomId", requireAuthUser, async (req, res, next) => {
  const { roomId } = req.params;
  try {
    const payload = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, req.authUser.id);
      if (!membership || !membership.is_host) {
        return {
          status: 403,
          body: { error: "forbidden", message: "Only room host can delete this room" },
        };
      }
      const deleted = await client.query(
        `
        DELETE FROM rooms
        WHERE id = $1
        RETURNING id
        `,
        [roomId],
      );
      if (!deleted.rowCount) {
        return { status: 404, body: { error: "room not found" } };
      }
      return { status: 200, body: { ok: true, id: deleted.rows[0].id } };
    });
    return res.status(payload.status).json(payload.body);
  } catch (error) {
    return next(error);
  }
});

router.get("/rooms/:roomId/state", async (req, res, next) => {
  const { roomId } = req.params;
  try {
    const result = await query(
      `
      SELECT id, room_id, state_json, status, updated_at
      FROM games
      WHERE room_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [roomId],
    );
    if (!result.rowCount) {
      return res.json({ gameState: null });
    }
    return res.json({ gameState: result.rows[0].state_json });
  } catch (error) {
    return next(error);
  }
});

router.post("/rooms/:roomId/moves", requireAuthUser, async (req, res, next) => {
  const { roomId } = req.params;
  const { type, playerId, cardId, chosenColor, roomConfig } = req.body || {};

  try {
    const output = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, req.authUser.id);
      if (!membership) {
        return {
          status: 403,
          body: { error: "forbidden", message: "Only room members can submit moves" },
        };
      }

      if (type !== "init" && playerId && isUuid(playerId) && playerId !== req.authUser.id) {
        return {
          status: 403,
          body: { error: "forbidden", message: "Cannot submit moves for another player" },
        };
      }

      const gameResult = await client.query(
        `
        SELECT id, state_json
        FROM games
        WHERE room_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
        `,
        [roomId],
      );

      let gameState = gameResult.rowCount ? gameResult.rows[0].state_json : null;
      if (!gameState && (type === "init" || roomConfig)) {
        gameState = Engine.initGame(roomConfig);
      }
      if (!gameState) {
        return { status: 404, body: { error: "game not initialized" } };
      }

      let moveResult = { success: true, gameState };
      if (type === "play") {
        moveResult = Engine.playCard(gameState, playerId, cardId, chosenColor);
      } else if (type === "draw") {
        moveResult = Engine.drawCard(gameState, playerId);
      } else if (type === "init") {
        moveResult = { success: true, gameState };
      }

      if (!moveResult.success) {
        return { status: 400, body: moveResult };
      }

      const nextState = moveResult.gameState;
      if (gameResult.rowCount) {
        await client.query(
          `
          UPDATE games
          SET state_json = $1, status = $2, updated_at = NOW()
          WHERE id = $3
          `,
          [nextState, nextState.phase === "finished" ? "finished" : "active", gameResult.rows[0].id],
        );
      } else {
        await client.query(
          `
          INSERT INTO games (room_id, state_json, status)
          VALUES ($1, $2, $3)
          `,
          [roomId, nextState, nextState.phase === "finished" ? "finished" : "active"],
        );
      }

      await client.query(
        `
        INSERT INTO game_moves (room_id, player_id, move_type, payload)
        VALUES ($1, $2, $3, $4)
        `,
        [roomId, playerId || null, type, { cardId, chosenColor }],
      );

      return { status: 200, body: moveResult };
    });

    return res.status(output.status).json(output.body);
  } catch (error) {
    return next(error);
  }
});

router.get("/leaderboard", async (_req, res, next) => {
  try {
    const result = await query(
      `
      SELECT
        u.username AS name,
        u.avatar_emoji AS av,
        u.avatar_color AS bg,
        COUNT(gr.id)::int FILTER (WHERE gr.winner_user_id = u.id) AS wins,
        COALESCE(SUM(pr.points_delta), 0)::int AS points
      FROM users u
      LEFT JOIN player_results pr ON pr.user_id = u.id
      LEFT JOIN game_results gr ON gr.id = pr.game_result_id
      GROUP BY u.id
      ORDER BY points DESC, wins DESC
      LIMIT 20
      `,
    );
    res.json({ leaderboard: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (_req, res, next) => {
  try {
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
    res.json({ history: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/custom-cards", async (_req, res, next) => {
  try {
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
    res.json({ customCards: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/custom-cards", requireAuthUser, async (req, res, next) => {
  const { name, emoji = "✨", color = "wild", effect, trigger = "onPlay" } = req.body || {};
  if (!name || !effect) {
    return res.status(400).json({ error: "name and effect are required" });
  }

  try {
    const result = await query(
      `
      INSERT INTO custom_cards (name, emoji, color, effect_text, trigger_rule, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, emoji, color, effect_text AS effect, trigger_rule AS trigger, created_by_user_id
      `,
      [name, emoji, color, effect, trigger, req.authUser.id],
    );
    return res.status(201).json({ customCard: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post("/results", requireAuthUser, async (req, res, next) => {
  const { roomId, winnerId, totalRounds = 1, pointsScored = 0, players = [] } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "roomId is required" });

  try {
    const result = await withTransaction(async (client) => {
      const membership = await getRoomMembership(client, roomId, req.authUser.id);
      if (!membership) {
        return {
          status: 403,
          body: { error: "forbidden", message: "Only room members can write match history" },
        };
      }
      if (!membership.is_host) {
        return {
          status: 403,
          body: { error: "forbidden", message: "Only room host can write match history" },
        };
      }

      const roomUserIds = await getRoomMemberUserIds(client, roomId);
      if (winnerId && !roomUserIds.has(winnerId)) {
        return {
          status: 400,
          body: { error: "invalid_input", message: "winnerId must belong to the room" },
        };
      }
      for (const p of players) {
        if (p.userId && !roomUserIds.has(p.userId)) {
          return {
            status: 400,
            body: {
              error: "invalid_input",
              message: "player result contains user outside room",
            },
          };
        }
      }

      const gameResult = await client.query(
        `
        INSERT INTO game_results (room_id, winner_user_id, total_rounds, points_scored, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [roomId, winnerId || null, totalRounds, pointsScored, req.authUser.id],
      );
      const gameResultId = gameResult.rows[0].id;

      for (const player of players) {
        await client.query(
          `
          INSERT INTO player_results (game_result_id, user_id, points_delta, position)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (game_result_id, user_id) DO NOTHING
          `,
          [gameResultId, player.userId, player.pointsDelta || 0, player.position || null],
        );
      }
      return { status: 201, body: { id: gameResultId } };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
});

router.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "internal_error",
    message: error.message,
  });
});

module.exports = router;
