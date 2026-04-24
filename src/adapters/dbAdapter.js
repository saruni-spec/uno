function usingBackend() {
  return Boolean(window.APP_CONFIG?.USE_BACKEND_DATA);
}

function baseUrl() {
  return window.APP_CONFIG?.API_BASE_URL || "http://localhost:4000/api";
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("shout.user") || "null");
  } catch (_e) {
    return null;
  }
}

function writeStoredUser(user) {
  localStorage.setItem("shout.user", JSON.stringify(user));
}

async function request(path, options = {}) {
  const storedUser = readStoredUser();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (storedUser?.id) {
    headers["x-user-id"] = storedUser.id;
  }
  const response = await fetch(`${baseUrl()}${path}`, {
    headers,
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed ${response.status}`);
  }
  return response.json();
}

const dbAdapter = {
  backendEnabled: usingBackend,

  async ensureSession() {
    if (!usingBackend()) return null;
    const existing = readStoredUser();
    const fallbackName =
      localStorage.getItem("shout.username") ||
      window.APP_DATA?.currentUser?.name ||
      "Player";
    const fallbackAvatar = window.APP_DATA?.currentUser?.avatar || "🦊";
    const fallbackColor = window.APP_DATA?.currentUser?.color || "#ff3c7a";
    const data = await request("/auth/session", {
      method: "POST",
      body: JSON.stringify({
        userId: existing?.id || null,
        name: existing?.name || fallbackName,
        avatar: existing?.avatar || fallbackAvatar,
        color: existing?.color || fallbackColor,
      }),
    });
    if (data?.user) {
      writeStoredUser(data.user);
      localStorage.setItem("shout.username", data.user.name);
    }
    return data.user;
  },

  async bootstrapSeed() {
    if (!usingBackend()) return { seeded: false };
    return request("/bootstrap/seed", { method: "POST" });
  },

  async listRooms() {
    if (!usingBackend()) {
      return JSON.parse(localStorage.getItem("shout.rooms") || "[]");
    }
    await this.ensureSession();
    const data = await request("/rooms");
    const rooms = data?.rooms || [];
    if (rooms.length === 0) {
      await this.bootstrapSeed();
      const seeded = await request("/rooms");
      return seeded?.rooms || [];
    }
    return rooms;
  },

  async deleteRoom(roomId) {
    if (!usingBackend()) {
      const rooms = JSON.parse(localStorage.getItem("shout.rooms") || "[]");
      const filtered = rooms.filter((r) => r.id !== roomId);
      localStorage.setItem("shout.rooms", JSON.stringify(filtered));
      return Promise.resolve(true);
    }
    await this.ensureSession();
    return request(`/rooms/${roomId}`, { method: "DELETE" });
  },

  async getRoom(roomId) {
    if (!usingBackend()) {
      const rooms = JSON.parse(localStorage.getItem("shout.rooms") || "[]");
      return rooms.find((r) => r.id === roomId) || null;
    }
    await this.ensureSession();
    const data = await request(`/rooms/${roomId}`);
    return data?.room || null;
  },

  async createRoom(payload) {
    if (!usingBackend()) {
      const local = {
        id: `local-${Date.now()}`,
        name: payload.name,
        icon: payload.icon,
        felt: payload.felt,
        mode: payload.mode,
        status: "waiting",
        players: payload.players || [],
        maxPlayers: payload.maxPlayers || 8,
        activeRules: (payload.rules || []).filter((r) => r.on).length,
      };
      const rooms = JSON.parse(localStorage.getItem("shout.rooms") || "[]");
      localStorage.setItem("shout.rooms", JSON.stringify([local, ...rooms]));
      return local;
    }
    await this.ensureSession();
    const data = await request("/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.room;
  },

  async joinRoom(roomId, payload) {
    if (!usingBackend()) return { roomId, ...payload };
    await this.ensureSession();
    return request(`/rooms/${roomId}/join`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getRoomState(roomId) {
    if (!usingBackend()) return null;
    await this.ensureSession();
    const data = await request(`/rooms/${roomId}/state`);
    return data.gameState || null;
  },

  async submitMove(roomId, payload) {
    if (!usingBackend()) return null;
    await this.ensureSession();
    return request(`/rooms/${roomId}/moves`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getLeaderboard() {
    if (!usingBackend()) {
      return [];
    }
    await this.ensureSession();
    const data = await request("/leaderboard");
    return data.leaderboard || [];
  },

  async getHistory() {
    if (!usingBackend()) {
      return [];
    }
    await this.ensureSession();
    const data = await request("/history");
    return data.history || [];
  },

  async listCustomCards() {
    if (!usingBackend()) {
      return JSON.parse(localStorage.getItem("shout.customCards") || "[]");
    }
    await this.ensureSession();
    const data = await request("/custom-cards");
    return data.customCards || [];
  },

  async createCustomCard(payload) {
    if (!usingBackend()) {
      const card = { id: `cc-${Date.now()}`, ...payload };
      const cards = JSON.parse(
        localStorage.getItem("shout.customCards") || "[]",
      );
      localStorage.setItem(
        "shout.customCards",
        JSON.stringify([card, ...cards]),
      );
      return card;
    }
    await this.ensureSession();
    const data = await request("/custom-cards", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.customCard;
  },

  async saveGameState(_gameId, _state) {
    return Promise.resolve();
  },

  async loadGameState(_gameId) {
    return Promise.resolve(null);
  },

  async logMove(_gameId, _move) {
    return Promise.resolve();
  },

  async saveMatch(_matchState) {
    if (!usingBackend()) return Promise.resolve();
    await this.ensureSession();
    const players = Object.entries(_matchState.cumulativeScores || {}).map(
      ([userId, pointsDelta], idx) => ({
        userId,
        pointsDelta,
        position: idx + 1,
      }),
    );
    return request("/results", {
      method: "POST",
      body: JSON.stringify({
        roomId: _matchState.roomId,
        winnerId: _matchState.winner,
        totalRounds: _matchState.currentRound,
        pointsScored: _matchState.cumulativeScores?.[_matchState.winner] || 0,
        players,
      }),
    });
  },

  async loadMatch(_roomId) {
    return Promise.resolve(null);
  },
};

// Export
if (typeof window !== "undefined") {
  window.dbAdapter = dbAdapter;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = dbAdapter;
}
