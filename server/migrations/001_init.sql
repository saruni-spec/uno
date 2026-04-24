CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) NOT NULL,
  avatar_emoji VARCHAR(8) NOT NULL DEFAULT '🦊',
  avatar_color VARCHAR(7) NOT NULL DEFAULT '#ff3c7a',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL,
  name VARCHAR(64) NOT NULL,
  icon VARCHAR(8) NOT NULL DEFAULT '🎉',
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  felt_theme VARCHAR(32) NOT NULL DEFAULT 'neon',
  mode VARCHAR(16) NOT NULL DEFAULT 'solo',
  max_players INTEGER NOT NULL DEFAULT 8,
  score_target INTEGER NOT NULL DEFAULT 500,
  hand_size INTEGER NOT NULL DEFAULT 7,
  turn_timer_sec INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(16) NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_players (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team VARCHAR(1),
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_rules (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  rule_id VARCHAR(32) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (room_id, rule_id)
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  state_json JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_moves (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  move_type VARCHAR(32) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  emoji VARCHAR(8) NOT NULL DEFAULT '✨',
  color VARCHAR(16) NOT NULL DEFAULT 'wild',
  effect_text TEXT NOT NULL,
  trigger_rule VARCHAR(64),
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  winner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  duration_sec INTEGER,
  total_rounds INTEGER DEFAULT 1,
  points_scored INTEGER DEFAULT 0,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_results (
  game_result_id UUID NOT NULL REFERENCES game_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_delta INTEGER NOT NULL DEFAULT 0,
  position INTEGER,
  PRIMARY KEY (game_result_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_moves_room ON game_moves(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_results_played ON game_results(played_at DESC);
