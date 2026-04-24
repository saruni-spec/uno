// Lobby screen — rooms list + create + resume match

// Resume match card component
function ResumeMatchCard({ match, onResume, onDelete }) {
  const formatTime = (iso) => {
    if (!iso) return "Unknown";
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 24 }}>🎮</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {match.roomName || "Active Game"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>
            {match.playerCount || 2} players • Round {match.currentRound || 1}
          </div>
        </div>
        <button
          className="btn ghost sm"
          onClick={onDelete}
          title="Remove game"
          style={{ padding: "4px 8px" }}
        >
          🗑️
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 12 }}>
        Last played: {formatTime(match.lastUpdated)}
      </div>
      <button
        className="btn primary"
        style={{ width: "100%" }}
        onClick={onResume}
      >
        Resume Game
      </button>
    </div>
  );
}

function Lobby({ onEnterRoom, onCreateRoom, onNav }) {
  const [rooms, setRooms] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [activeMatches, setActiveMatches] = React.useState([]);

  // Load rooms from backend
  React.useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      setIsLoading(true);
      setError("");
      try {
        const next = await dbAdapter.listRooms();
        if (!cancelled) setRooms(next || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load rooms");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadRooms();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load active matches from localStorage
  React.useEffect(() => {
    if (typeof MatchState !== "undefined") {
      const matches = MatchState.listActive();
      setActiveMatches(matches);
    }
  }, []);

  const handleResumeMatch = (match) => {
    // Store the match room config in a global for the app to pick up
    window.__RESUMED_MATCH_CONFIG = {
      roomId: match.roomId,
      players:
        match.players?.map((pid, i) => ({
          id: pid,
          name: pid === "me" ? "You" : `Player ${i + 1}`,
          avatar: {
            emoji: i === 0 ? "🦊" : ["🦄", "🐲", "🐙", "🐼", "🐨"][i % 5],
            color: ["#ff3c7a", "#7b5cff", "#3ddc84", "#ffc93c", "#9b59b6"][
              i % 5
            ],
          },
          team: match.mode === "teams" ? (i % 2 === 0 ? "A" : "B") : undefined,
        })) || [],
      rules: match.rules || { stack: true },
      mode: match.mode || "solo",
      targetScore: match.targetScore || 500,
      _isResume: true, // Flag to indicate this is a resumed match
    };
    onNav("game");
  };

  return (
    <div className="page">
      <div className="lobby-hero">
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <span className="chip live">
              {rooms.filter((r) => r.status === "playing").length} live games
            </span>
            <span className="chip">{rooms.length} rooms</span>
          </div>
          <h1 className="hero-title">
            <span className="shout">Noni's</span>
            <br />
            <span className="bang">Card House</span>
          </h1>
          <p className="hero-sub">
            The chunky card game for chaotic friends. House rules, teams, custom
            cards — play your way, pass-and-play or across the internet.
          </p>
          <div className="hero-cta">
            <button className="btn primary" onClick={onCreateRoom}>
              <span style={{ fontSize: 18 }}>🎉</span> Create a room
            </button>
            <button className="btn ghost">
              <span style={{ fontSize: 18 }}>🔗</span> Join by code
            </button>
            <button className="btn yellow" onClick={() => onNav("game")}>
              <span style={{ fontSize: 18 }}>▶</span> Quick play
            </button>
          </div>
        </div>
        <div className="hero-deck">
          <Sticker
            className="yel"
            style={{ top: 0, left: 20, transform: "rotate(-8deg)" }}
          >
            House Rules ✓
          </Sticker>
          <Sticker
            className="pink"
            style={{ top: 60, right: 0, transform: "rotate(6deg)" }}
          >
            Teams ✓
          </Sticker>
          <Sticker
            className="green"
            style={{ bottom: 40, left: 0, transform: "rotate(-4deg)" }}
          >
            Custom Cards ✓
          </Sticker>
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 60,
              transform: "rotate(-18deg)",
            }}
          >
            <Card color="red" value="7" size="lg" />
          </div>
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 180,
              transform: "rotate(-4deg)",
            }}
          >
            <Card color="yellow" value="skip" size="lg" />
          </div>
          <div
            style={{
              position: "absolute",
              top: 50,
              left: 300,
              transform: "rotate(12deg)",
            }}
          >
            <Card color="wild" value="wild4" size="lg" />
          </div>
          <div
            style={{
              position: "absolute",
              top: 180,
              left: 120,
              transform: "rotate(-8deg)",
            }}
          >
            <Card color="blue" value="3" size="lg" />
          </div>
          <div
            style={{
              position: "absolute",
              top: 180,
              left: 250,
              transform: "rotate(4deg)",
            }}
          >
            <Card color="green" value="reverse" size="lg" />
          </div>
        </div>
      </div>

      {/* Continue Playing Section - Shows active local matches */}
      {activeMatches.length > 0 && (
        <>
          <div className="section-h">
            <h2>🎮 Continue Playing</h2>
            <span className="chip live">{activeMatches.length} active</span>
          </div>
          <div className="room-grid">
            {activeMatches.map((match) => (
              <ResumeMatchCard
                key={match.roomId}
                match={match}
                onResume={() => handleResumeMatch(match)}
                onDelete={() => {
                  if (confirm("Remove this game from your list?")) {
                    MatchState.clear(match.roomId);
                    setActiveMatches((prev) =>
                      prev.filter((m) => m.roomId !== match.roomId),
                    );
                  }
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="section-h">
        <h2>🏠 Your rooms</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="chip">All</span>
          <span className="chip">Waiting</span>
          <span className="chip live">Playing</span>
        </div>
      </div>

      <div className="room-grid">
        <div className="create-room" onClick={onCreateRoom}>
          <div style={{ textAlign: "center" }}>
            <div className="plus">+</div>
            <div style={{ fontWeight: 600 }}>New Room</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
              Invite friends · Any device
            </div>
          </div>
        </div>
        {isLoading && <div className="panel">Loading rooms...</div>}
        {!isLoading && error && (
          <div className="panel">Could not load rooms: {error}</div>
        )}
        {!isLoading && !error && rooms.length === 0 && (
          <div className="panel">
            No active rooms yet. Create the first one.
          </div>
        )}
        {!isLoading &&
          !error &&
          rooms.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              onClick={() => onEnterRoom(r)}
              onDelete={() => {
                if (confirm("Delete this room?")) {
                  dbAdapter.deleteRoom(r.id);
                  setRooms((prev) => prev.filter((room) => room.id !== r.id));
                }
              }}
            />
          ))}
      </div>
    </div>
  );
}

function RoomCard({ room, onClick, onDelete }) {
  const felt =
    window.APP_DATA.felts.find((f) => f.id === room.felt) ||
    window.APP_DATA.felts[0];
  const players = room.players || [];
  return (
    <div className="room-card" onClick={onClick}>
      <div className={`felt-preview ${felt.cls}`} />
      <div className="rc-inner">
        <div className="rc-head">
          <div
            className="rc-icon"
            style={{ background: players[0]?.bg || "#7b5cff" }}
          >
            {room.icon}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="rc-name">{room.name}</div>
            <div className="rc-host">
              <span>{room.hostAvatar}</span> Hosted by {room.host}
            </div>
          </div>
          {onDelete && (
            <button
              className="btn ghost sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete room"
              style={{ padding: "4px 8px", fontSize: "14px" }}
            >
              🗑️
            </button>
          )}
        </div>

        <div className="rc-meta">
          <span className="chip">
            {room.mode === "teams" ? "👥 Teams" : "🧍 Solo"}
          </span>
          <span className="chip">📜 {room.activeRules} rules</span>
          {room.status === "playing" ? (
            <span className="chip live">LIVE</span>
          ) : (
            <span className="chip ok">Waiting</span>
          )}
        </div>

        <div className="rc-foot">
          <div className="avstack">
            {players.slice(0, 4).map((p, i) => (
              <div key={i} className="a" style={{ background: p.bg }}>
                {p.av}
              </div>
            ))}
            {players.length > 4 && (
              <div className="a" style={{ background: "#444" }}>
                +{players.length - 4}
              </div>
            )}
          </div>
          <span
            className="mono"
            style={{ fontSize: 12, color: "var(--ink-dim)" }}
          >
            {players.length || room.playerCount || 0}/{room.maxPlayers}
          </span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Lobby });
