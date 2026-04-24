function randomCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function toClientRoom(row) {
  return {
    id: row.id,
    code: row.code,
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

module.exports = {
  randomCode,
  toClientRoom,
};
