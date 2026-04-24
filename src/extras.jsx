// Custom card creator + stats/leaderboard + history screens

function CardCreator({ onBack }) {
  const [cards, setCards] = React.useState([]);
  const [cardsLoading, setCardsLoading] = React.useState(true);
  const [saveError, setSaveError] = React.useState("");
  const [state, setState] = React.useState({
    name: "Mulligan",
    emoji: "♻️",
    color: "green",
    effect: "Swap up to 3 cards with the deck.",
    trigger: "onPlay",
    wildLike: false,
  });

  const colors = [
    { id: "red", label: "Red", swatch: "#ff4d6d" },
    { id: "yellow", label: "Yellow", swatch: "#ffc93c" },
    { id: "green", label: "Green", swatch: "#3ddc84" },
    { id: "blue", label: "Blue", swatch: "#4a8cff" },
    {
      id: "wild",
      label: "Wild",
      swatch:
        "conic-gradient(from 0deg, #ff4d6d 0 25%, #ffc93c 25% 50%, #3ddc84 50% 75%, #4a8cff 75% 100%)",
    },
  ];

  const emojis = [
    "♻️",
    "🛡️",
    "🔀",
    "✌️",
    "💣",
    "⚡",
    "🌀",
    "❄️",
    "🔥",
    "🎁",
    "🪄",
    "🎯",
    "👀",
    "🎭",
    "🪙",
    "🌙",
    "☀️",
    "🍀",
  ];

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setCardsLoading(true);
      try {
        const next = await dbAdapter.listCustomCards();
        if (!cancelled) setCards(next);
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveCard = async () => {
    setSaveError("");
    try {
      const saved = await dbAdapter.createCustomCard({
        name: state.name,
        emoji: state.emoji,
        color: state.color,
        effect: state.effect,
        trigger: state.trigger,
      });
      setCards((prev) => [saved, ...prev]);
    } catch (e) {
      setSaveError(e.message || "Could not save custom card");
    }
  };

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <button className="btn ghost sm" onClick={onBack}>
          ← Back
        </button>
        <h2
          className="display"
          style={{ margin: 0, fontSize: 28, textShadow: "2px 2px 0 #0a0418" }}
        >
          🎨 Custom card creator
        </h2>
        <span className="chip">Blank cards rule · ON</span>
      </div>

      <div className="cc-grid">
        <div className="cc-preview">
          <div style={{ position: "relative" }}>
            <Sticker className="yel" style={{ top: -20, left: -30 }}>
              {state.name}
            </Sticker>
            <div className="card lg" style={{ width: 200, height: 290 }}>
              <div
                className="card-face"
                style={{
                  background:
                    state.color === "wild"
                      ? "conic-gradient(from 0deg, #ff4d6d 0 25%, #ffc93c 25% 50%, #3ddc84 50% 75%, #4a8cff 75% 100%)"
                      : state.color === "red"
                        ? "linear-gradient(160deg, #ff6b88, #ff4d6d)"
                        : state.color === "yellow"
                          ? "linear-gradient(160deg, #ffdb70, #ffc93c)"
                          : state.color === "green"
                            ? "linear-gradient(160deg, #6ee8a8, #3ddc84)"
                            : "linear-gradient(160deg, #77a9ff, #4a8cff)",
                }}
              >
                <div className="corner tl" style={{ fontSize: 26 }}>
                  {state.emoji}
                </div>
                <div
                  style={{
                    fontSize: 90,
                    transform: "rotate(-6deg)",
                    filter: "drop-shadow(-3px 3px 0 rgba(0,0,0,.3))",
                  }}
                >
                  {state.emoji}
                </div>
                <div className="corner br" style={{ fontSize: 26 }}>
                  {state.emoji}
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 18,
                padding: 12,
                background: "rgba(0,0,0,.4)",
                border: "2px solid rgba(255,255,255,.1)",
                borderRadius: 12,
                fontSize: 13,
                maxWidth: 240,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {state.name}
              </div>
              <div style={{ color: "var(--ink-dim)" }}>{state.effect}</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Design it</h3>
          <div className="field">
            <label>Card name</label>
            <input
              aria-label="Card name"
              type="text"
              value={state.name}
              onChange={(e) =>
                setState((s) => ({ ...s, name: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label>Icon</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {emojis.map((e) => (
                <div
                  key={e}
                  onClick={() => setState((s) => ({ ...s, emoji: e }))}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 20,
                    cursor: "pointer",
                    background:
                      state.emoji === e
                        ? "rgba(255,210,63,.2)"
                        : "rgba(0,0,0,.2)",
                    border: `2px solid ${state.emoji === e ? "var(--accent-2)" : "transparent"}`,
                  }}
                >
                  {e}
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Color</label>
            <div style={{ display: "flex", gap: 8 }}>
              {colors.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setState((s) => ({ ...s, color: c.id }))}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 12,
                    cursor: "pointer",
                    background: c.swatch,
                    border: `3px solid ${state.color === c.id ? "var(--accent-2)" : "#0a0418"}`,
                    boxShadow: "0 4px 0 rgba(0,0,0,.3)",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="field">
            <label>Effect description</label>
            <textarea
              aria-label="Effect description"
              rows={3}
              value={state.effect}
              onChange={(e) =>
                setState((s) => ({ ...s, effect: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label>Trigger</label>
            <select
              aria-label="Effect trigger"
              value={state.trigger}
              onChange={(e) =>
                setState((s) => ({ ...s, trigger: e.target.value }))
              }
            >
              <option value="onPlay">When played</option>
              <option value="onDraw">When drawn</option>
              <option value="onTurn">Start of your turn (if in hand)</option>
              <option value="onLast">When it's your last card</option>
            </select>
          </div>
          <div className="rule-row on">
            <div className="rr-meta">
              <div className="rr-title">Playable any time</div>
              <div className="rr-desc">
                Acts as a wild — can be played on any color.
              </div>
            </div>
            <Switch
              on={state.wildLike}
              onChange={(v) => setState((s) => ({ ...s, wildLike: v }))}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              className="btn primary"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={handleSaveCard}
            >
              💾 Save to deck
            </button>
            <button className="btn ghost sm">Test play</button>
          </div>
          {saveError && (
            <div style={{ marginTop: 8, color: "#ff8aa4" }}>{saveError}</div>
          )}
        </div>
      </div>

      <div className="section-h">
        <h2>🗂 Saved custom cards</h2>
        <span className="chip">{cards.length} in deck</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {cardsLoading && <div className="panel">Loading custom cards...</div>}
        {!cardsLoading &&
          cards.map((c) => (
            <div
              key={c.id}
              className="panel"
              style={{
                display: "flex",
                gap: 14,
                padding: 14,
                alignItems: "center",
              }}
            >
              <div className="card sm" style={{ flexShrink: 0 }}>
                <div
                  className={`card-face`}
                  style={{
                    background:
                      c.color === "wild"
                        ? "conic-gradient(from 0deg, #ff4d6d 0 25%, #ffc93c 25% 50%, #3ddc84 50% 75%, #4a8cff 75% 100%)"
                        : c.color === "red"
                          ? "linear-gradient(160deg, #ff6b88, #ff4d6d)"
                          : c.color === "green"
                            ? "linear-gradient(160deg, #6ee8a8, #3ddc84)"
                            : "linear-gradient(160deg, #77a9ff, #4a8cff)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 30,
                      transform: "rotate(-6deg)",
                      filter: "drop-shadow(-2px 2px 0 rgba(0,0,0,.3))",
                    }}
                  >
                    {c.emoji}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-dim)",
                    margin: "2px 0 6px",
                  }}
                >
                  {c.effect}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                  by {c.by}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Stats({ onBack }) {
  const [lb, setLb] = React.useState([]);
  const [hist, setHist] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [leaderboard, history] = await Promise.all([
          dbAdapter.getLeaderboard(),
          dbAdapter.getHistory(),
        ]);
        if (!cancelled) {
          setLb(leaderboard || []);
          setHist(history || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h2
          className="display"
          style={{ margin: 0, fontSize: 28, textShadow: "2px 2px 0 #0a0418" }}
        >
          🏆 Stats & history
        </h2>
      </div>

      <div className="stat-grid">
        <div
          className="stat-card"
          style={{ background: "linear-gradient(160deg, #ff3c7a, #b22050)" }}
        >
          <div className="sl" style={{ color: "rgba(255,255,255,.75)" }}>
            Games won
          </div>
          <div className="sv">22</div>
        </div>
        <div
          className="stat-card"
          style={{ background: "linear-gradient(160deg, #ffc93c, #b8811a)" }}
        >
          <div className="sl" style={{ color: "#3a2610" }}>
            Total points
          </div>
          <div className="sv" style={{ color: "#2a1854" }}>
            4,105
          </div>
        </div>
        <div
          className="stat-card"
          style={{ background: "linear-gradient(160deg, #3ddcc8, #1d8578)" }}
        >
          <div className="sl" style={{ color: "#0a2e28" }}>
            Win streak
          </div>
          <div className="sv" style={{ color: "#0a2e28" }}>
            2 🔥
          </div>
        </div>
        <div
          className="stat-card"
          style={{ background: "linear-gradient(160deg, #7b5cff, #3a2a8a)" }}
        >
          <div className="sl" style={{ color: "rgba(255,255,255,.8)" }}>
            Times shouted
          </div>
          <div className="sv">57</div>
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}
      >
        <div className="panel">
          <div className="section-h" style={{ margin: 0, marginBottom: 14 }}>
            <h2 style={{ fontSize: 20 }}>👑 Leaderboard</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="chip">All time</span>
              <span className="chip ok">This month</span>
              <span className="chip">Week</span>
            </div>
          </div>
          {loading && <div className="panel">Loading leaderboard...</div>}
          {!loading &&
            lb.map((p, i) => (
              <div key={i} className={`lb-row p${i + 1}`}>
                <div className="rank">
                  {i === 0
                    ? "🥇"
                    : i === 1
                      ? "🥈"
                      : i === 2
                        ? "🥉"
                        : `#${i + 1}`}
                </div>
                <div className="player">
                  <Avatar av={p.av} bg={p.bg} size={36} />
                  <div>
                    <div>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                      {p.wins || 0} wins · streak {p.streak || 0}
                    </div>
                  </div>
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 13, color: "var(--ink-dim)" }}
                >
                  {p.points}
                </div>
                <div
                  style={{
                    width: 80,
                    height: 8,
                    background: "rgba(0,0,0,.3)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${lb[0]?.points ? (p.points / lb[0].points) * 100 : 0}%`,
                      height: "100%",
                      background: "var(--accent-2)",
                    }}
                  />
                </div>
              </div>
            ))}
        </div>

        <div className="panel">
          <div className="section-h" style={{ margin: 0, marginBottom: 14 }}>
            <h2 style={{ fontSize: 20 }}>📜 Recent games</h2>
            <button className="btn ghost sm">View all</button>
          </div>
          {loading && <div className="panel">Loading history...</div>}
          {!loading &&
            hist.map((g, i) => (
              <div key={i} className="history-row">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "rgba(0,0,0,.3)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 22,
                  }}
                >
                  {g.icon || "🎉"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{g.room}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                    {g.date || "Recent"} ·{" "}
                    {g.duration || `${g.duration_sec || 0}s`} · {g.rounds || 1}{" "}
                    rounds
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <span>won by</span>
                  <Avatar av={g.winnerAv} bg="#7b5cff" size={22} />
                  <span style={{ fontWeight: 600 }}>{g.winner}</span>
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 12, color: "var(--ink-dim)" }}
                >
                  {g.pts}pts
                </div>
              </div>
            ))}

          <div className="wavy-divider" />

          <div
            style={{
              fontSize: 12,
              color: "var(--ink-dim)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
              marginBottom: 8,
            }}
          >
            Favorite house rules
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className="chip">🥞 Stack Attack · 89%</span>
            <span className="chip">💯 Points · 76%</span>
            <span className="chip">🔄 7-0 Swap · 64%</span>
            <span className="chip">⚖️ Challenge +4 · 58%</span>
            <span className="chip">😈 No Mercy · 44%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Leaderboard Screen - Dedicated full-screen leaderboard with filters
function LeaderboardScreen({ onBack }) {
  const [loading, setLoading] = React.useState(true);
  const [lb, setLb] = React.useState([]);
  const [period, setPeriod] = React.useState("all"); // all, month, week
  const [sortBy, setSortBy] = React.useState("points"); // points, wins, streak

  React.useEffect(() => {
    // Load from localStorage or mock data
    const saved = localStorage.getItem("shout.leaderboard");
    if (saved) {
      try {
        setLb(JSON.parse(saved));
      } catch {
        setLb(window.APP_DATA?.leaderboard || []);
      }
    } else {
      setLb(window.APP_DATA?.leaderboard || []);
    }
    setLoading(false);
  }, []);

  const sortedLb = React.useMemo(() => {
    return [...lb].sort((a, b) => {
      if (sortBy === "points") return (b.points || 0) - (a.points || 0);
      if (sortBy === "wins") return (b.wins || 0) - (a.wins || 0);
      if (sortBy === "streak") return (b.streak || 0) - (a.streak || 0);
      return 0;
    });
  }, [lb, sortBy]);

  return (
    <div className="page-padded">
      <div className="section-h">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h1 className="display" style={{ margin: 0 }}>
          👑 Leaderboard
        </h1>
      </div>

      <div className="panel">
        <div className="section-h" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "month", "week"].map((p) => (
              <button
                key={p}
                className={`chip ${period === p ? "ok" : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p === "all"
                  ? "All time"
                  : p === "month"
                    ? "This month"
                    : "This week"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { key: "points", label: "Points" },
              { key: "wins", label: "Wins" },
              { key: "streak", label: "Streak" },
            ].map((s) => (
              <button
                key={s.key}
                className={`chip ${sortBy === s.key ? "ok" : ""}`}
                onClick={() => setSortBy(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="panel">Loading leaderboard...</div>}

        {!loading && sortedLb.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--ink-dim)",
            }}
          >
            No leaderboard data yet. Play some games! 🎮
          </div>
        )}

        {!loading &&
          sortedLb.map((p, i) => (
            <div
              key={p.id || i}
              className={`lb-row p${i + 1}`}
              style={{ marginBottom: 8 }}
            >
              <div className="rank" style={{ fontSize: 24, minWidth: 40 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </div>
              <div className="player" style={{ flex: 1 }}>
                <Avatar av={p.av} bg={p.bg} size={48} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                    {p.wins || 0} wins · streak {p.streak || 0} · {p.games || 0}{" "}
                    games
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "var(--accent-2)",
                  }}
                >
                  {sortBy === "points"
                    ? (p.points || 0).toLocaleString()
                    : sortBy === "wins"
                      ? p.wins || 0
                      : p.streak || 0}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    textTransform: "uppercase",
                  }}
                >
                  {sortBy === "points"
                    ? "points"
                    : sortBy === "wins"
                      ? "wins"
                      : "streak"}
                </div>
              </div>
              <div
                style={{
                  width: 100,
                  height: 10,
                  background: "rgba(0,0,0,.3)",
                  borderRadius: 5,
                  overflow: "hidden",
                  marginLeft: 20,
                }}
              >
                <div
                  style={{
                    width: `${sortedLb[0]?.[sortBy] ? ((p[sortBy] || 0) / sortedLb[0][sortBy]) * 100 : 0}%`,
                    height: "100%",
                    background: i < 3 ? "var(--accent-2)" : "var(--ink-dim)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          ))}
      </div>

      {/* Your stats summary */}
      <div className="stat-grid" style={{ marginTop: 20 }}>
        <div
          className="stat-card"
          style={{ background: "linear-gradient(160deg, #ff3c7a, #b22050)" }}
        >
          <div className="sl" style={{ color: "rgba(255,255,255,.75)" }}>
            Your Rank
          </div>
          <div className="sv">
            {sortedLb.findIndex((p) => p.id === "me") >= 0
              ? `#${sortedLb.findIndex((p) => p.id === "me") + 1}`
              : "—"}
          </div>
        </div>
        <div
          className="stat-card"
          style={{ background: "linear-gradient(160deg, #ffc93c, #b8811a)" }}
        >
          <div className="sl" style={{ color: "#3a2610" }}>
            Top 10 %
          </div>
          <div className="sv" style={{ color: "#2a1854" }}>
            {sortedLb.findIndex((p) => p.id === "me") >= 0
              ? `${Math.round(((sortedLb.findIndex((p) => p.id === "me") + 1) / sortedLb.length) * 100)}%`
              : "—"}
          </div>
        </div>
        <div
          className="stat-card"
          style={{ background: "linear-gradient(160deg, #3ddcc8, #1d8578)" }}
        >
          <div className="sl" style={{ color: "#0a2e28" }}>
            Players
          </div>
          <div className="sv" style={{ color: "#0a2e28" }}>
            {sortedLb.length}
          </div>
        </div>
      </div>
    </div>
  );
}

// Replay Viewer Component
function ReplayViewer({ onBack, initialReplayId = null }) {
  const [replays, setReplays] = React.useState([]);
  const [selectedReplay, setSelectedReplay] = React.useState(null);
  const [currentFrame, setCurrentFrame] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1);
  const [copied, setCopied] = React.useState(false);

  // Load replays list
  React.useEffect(() => {
    const list = ReplayRecorder.getCompletedReplays();
    setReplays(list.sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt)));

    if (initialReplayId) {
      const replay = ReplayRecorder.load(initialReplayId);
      if (replay) {
        setSelectedReplay(replay);
      }
    }
  }, [initialReplayId]);

  // Auto-play effect
  React.useEffect(() => {
    if (!isPlaying || !selectedReplay) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        if (prev >= selectedReplay.frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, selectedReplay, playbackSpeed]);

  const handleDelete = (roomId) => {
    if (confirm("Delete this replay?")) {
      ReplayRecorder.delete(roomId);
      setReplays(replays.filter((r) => r.roomId !== roomId));
      if (selectedReplay?.roomId === roomId) {
        setSelectedReplay(null);
        setCurrentFrame(0);
      }
    }
  };

  const handleShare = () => {
    if (!selectedReplay) return;
    const data = ReplayRecorder.exportForSharing(selectedReplay.roomId);
    if (data) {
      navigator.clipboard?.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (iso) => {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Replay list view
  if (!selectedReplay) {
    return (
      <div
        className="panel"
        style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <button className="btn ghost" onClick={onBack}>
            ← Back
          </button>
          <h2 style={{ margin: 0 }}>Game Replays</h2>
        </div>

        {replays.length === 0 ? (
          <div className="notice" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📹</div>
            <p>No replays yet. Complete some games to see them here!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {replays.map((replay) => (
              <div
                key={replay.roomId}
                className="panel"
                style={{
                  cursor: "pointer",
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: "var(--panel)",
                }}
                onClick={() =>
                  setSelectedReplay(ReplayRecorder.load(replay.roomId))
                }
              >
                <div style={{ fontSize: 32 }}>🎮</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {replay.playerCount} Players • {replay.moveCount} Moves
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-dim)",
                      marginTop: 4,
                    }}
                  >
                    {formatDate(replay.startedAt)} • Duration:{" "}
                    {formatTime(replay.duration)}
                  </div>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(replay.roomId);
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Replay player view
  const currentState = selectedReplay.frames[currentFrame]?.gameState;
  const frame = selectedReplay.frames[currentFrame];

  return (
    <div
      className="panel"
      style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn ghost"
          onClick={() => {
            setSelectedReplay(null);
            setCurrentFrame(0);
            setIsPlaying(false);
          }}
        >
          ← Back to List
        </button>
        <h2 style={{ margin: 0 }}>
          Replay: {selectedReplay.players.length} Players
        </h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn ghost sm" onClick={handleShare}>
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>
        </div>
      </div>

      {/* Playback Controls */}
      <div
        className="panel"
        style={{
          padding: 16,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn primary"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>

        <button
          className="btn ghost"
          onClick={() => setCurrentFrame(0)}
          disabled={currentFrame === 0}
        >
          ⏮ First
        </button>

        <button
          className="btn ghost"
          onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
          disabled={currentFrame === 0}
        >
          ⏴ Prev
        </button>

        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="range"
            min={0}
            max={selectedReplay.frames.length - 1}
            value={currentFrame}
            onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
            style={{ width: "100%" }}
          />
          <div
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "var(--ink-dim)",
            }}
          >
            Frame {currentFrame + 1} of {selectedReplay.frames.length}
          </div>
        </div>

        <button
          className="btn ghost"
          onClick={() =>
            setCurrentFrame(
              Math.min(selectedReplay.frames.length - 1, currentFrame + 1),
            )
          }
          disabled={currentFrame >= selectedReplay.frames.length - 1}
        >
          Next ⏵
        </button>

        <button
          className="btn ghost"
          onClick={() => setCurrentFrame(selectedReplay.frames.length - 1)}
          disabled={currentFrame >= selectedReplay.frames.length - 1}
        >
          Last ⏭
        </button>

        <select
          className="btn ghost"
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>

      {/* Move Info */}
      {frame && frame.type !== "init" && (
        <div
          className="panel"
          style={{ padding: 12, marginBottom: 16, background: "var(--panel)" }}
        >
          <strong>Move {currentFrame}:</strong>{" "}
          {frame.type === "play" ? (
            <>
              {selectedReplay.players.find((p) => p.id === frame.playerId)
                ?.name || "Unknown"}{" "}
              played {frame.cardId}
              {frame.chosenColor && ` (chose ${frame.chosenColor})`}
            </>
          ) : (
            <>
              {selectedReplay.players.find((p) => p.id === frame.playerId)
                ?.name || "Unknown"}{" "}
              drew a card
            </>
          )}
        </div>
      )}

      {/* Game State Display */}
      {currentState && (
        <div className="panel" style={{ padding: 20 }}>
          {/* Top Card */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-dim)",
                  marginBottom: 8,
                }}
              >
                Top Card
              </div>
              <MiniCard card={currentState.topCard} size="lg" />
              <div style={{ fontSize: 14, marginTop: 8 }}>
                Current Color:{" "}
                <span
                  style={{
                    color:
                      currentState.currentColor === "red"
                        ? "#ff3c7a"
                        : currentState.currentColor === "blue"
                          ? "#7b5cff"
                          : currentState.currentColor === "green"
                            ? "#3ddcc8"
                            : currentState.currentColor === "yellow"
                              ? "#ffc93c"
                              : "white",
                  }}
                >
                  {currentState.currentColor}
                </span>
              </div>
            </div>
          </div>

          {/* Players */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {currentState.players.map((player, idx) => (
              <div
                key={player.id}
                className="panel"
                style={{
                  padding: 12,
                  background:
                    currentState.currentPlayerIndex === idx
                      ? "rgba(255, 201, 60, 0.2)"
                      : "var(--panel)",
                  border:
                    currentState.currentPlayerIndex === idx
                      ? "2px solid #ffc93c"
                      : "1px solid rgba(0,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <Avatar
                    profile={
                      selectedReplay.players.find((p) => p.id === player.id) ||
                      player
                    }
                    size={32}
                  />
                  <span style={{ fontWeight: 600 }}>
                    {selectedReplay.players.find((p) => p.id === player.id)
                      ?.name || player.name}
                  </span>
                  {currentState.currentPlayerIndex === idx && (
                    <span
                      className="chip"
                      style={{ background: "#ffc93c", color: "#4a2805" }}
                    >
                      Current
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                  {player.hand?.length || 0} cards
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  {player.hand?.slice(0, 5).map((card, i) => (
                    <div
                      key={i}
                      style={{
                        width: 20,
                        height: 28,
                        borderRadius: 3,
                        background:
                          card.color === "wild"
                            ? "linear-gradient(135deg, #ff3c7a, #7b5cff, #3ddcc8, #ffc93c)"
                            : `var(--${card.color})`,
                        border: "1px solid rgba(0,0,0,0.3)",
                      }}
                    />
                  ))}
                  {player.hand?.length > 5 && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--ink-dim)",
                        alignSelf: "center",
                      }}
                    >
                      +{player.hand.length - 5}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Tournament Component
function Tournament({ onBack }) {
  const [view, setView] = React.useState("list"); // list, create, bracket, leaderboard
  const [tournaments, setTournaments] = React.useState([]);
  const [currentTournament, setCurrentTournament] = React.useState(null);
  const [leaderboard, setLeaderboard] = React.useState([]);
  const [newTournament, setNewTournament] = React.useState({
    name: "",
    maxPlayers: 16,
    format: "single",
  });
  const [error, setError] = React.useState("");

  // Load tournaments list
  React.useEffect(() => {
    setTournaments(TournamentAdapter.listAll());
  }, []);

  const handleCreate = () => {
    if (!newTournament.name.trim()) {
      setError("Please enter a tournament name");
      return;
    }

    // Add current user as first player
    const me = APP_DATA.currentUser || {
      id: "me",
      name: "You",
      avatar: { emoji: "🎮", color: "#ff3c7a" },
    };

    const tournament = TournamentAdapter.create({
      name: newTournament.name,
      maxPlayers: parseInt(newTournament.maxPlayers),
      format: newTournament.format,
      players: [me],
    });

    setCurrentTournament(tournament);
    setView("bracket");
    setError("");
  };

  const handleAddAI = (difficulty) => {
    if (!currentTournament) return;

    const aiPlayer = BotAdapter.createAIPlayer(
      currentTournament.players.length,
      difficulty,
    );

    const updated = {
      ...currentTournament,
      players: [...currentTournament.players, aiPlayer],
    };

    TournamentAdapter.save(updated);
    setCurrentTournament(updated);
  };

  const handleStart = () => {
    if (!currentTournament) return;

    const result = TournamentAdapter.start(currentTournament.id);

    if (result.error) {
      setError(result.error);
      return;
    }

    setCurrentTournament(result);
    setView("bracket");
    setError("");
  };

  const handleSimulateMatch = (matchId) => {
    if (!currentTournament) return;

    // Simulate a match (in real game, this would play an actual match)
    const match = currentTournament.rounds
      .flatMap((r) => r.matches)
      .find((m) => m.id === matchId);

    if (!match) return;

    // Random winner for simulation
    const winner = Math.random() > 0.5 ? match.player1 : match.player2;

    const result = TournamentAdapter.recordMatchResult(
      currentTournament.id,
      matchId,
      winner.id,
      {
        player1: Math.floor(Math.random() * 3),
        player2: Math.floor(Math.random() * 3),
      },
    );

    setCurrentTournament(result);
    setLeaderboard(TournamentAdapter.getLeaderboard(currentTournament.id));
  };

  const formatDate = (iso) => {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // List view
  if (view === "list") {
    return (
      <div
        className="panel"
        style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <button className="btn ghost" onClick={onBack}>
            ← Back
          </button>
          <h2 style={{ margin: 0 }}>Tournaments</h2>
          <button
            className="btn primary"
            style={{ marginLeft: "auto" }}
            onClick={() => setView("create")}
          >
            + New Tournament
          </button>
        </div>

        {tournaments.length === 0 ? (
          <div className="notice" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <p>No tournaments yet. Create one to start!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="panel"
                style={{
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: "var(--panel)",
                }}
              >
                <div style={{ fontSize: 32 }}>
                  {t.status === "finished"
                    ? "🏆"
                    : t.status === "active"
                      ? "🔥"
                      : "📝"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-dim)",
                      marginTop: 4,
                    }}
                  >
                    {t.playerCount} players • {t.status} •{" "}
                    {formatDate(t.createdAt)}
                  </div>
                </div>
                {t.status === "finished" && t.winner && (
                  <div className="chip ok">Winner: {t.winner.name}</div>
                )}
                <button
                  className="btn primary sm"
                  onClick={() => {
                    const loaded = TournamentAdapter.load(t.id);
                    setCurrentTournament(loaded);
                    setLeaderboard(TournamentAdapter.getLeaderboard(t.id));
                    setView("bracket");
                  }}
                >
                  View
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    if (confirm("Delete this tournament?")) {
                      TournamentAdapter.delete(t.id);
                      setTournaments(
                        tournaments.filter((tourney) => tourney.id !== t.id),
                      );
                    }
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Create view
  if (view === "create") {
    return (
      <div
        className="panel"
        style={{ maxWidth: 500, margin: "0 auto", padding: 24 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <button className="btn ghost" onClick={() => setView("list")}>
            ← Back
          </button>
          <h2 style={{ margin: 0 }}>Create Tournament</h2>
        </div>

        {error && (
          <div
            className="notice"
            style={{ marginBottom: 16, background: "rgba(255, 60, 122, 0.2)" }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label
              style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
            >
              Tournament Name
            </label>
            <input
              type="text"
              className="input"
              value={newTournament.name}
              onChange={(e) =>
                setNewTournament({ ...newTournament, name: e.target.value })
              }
              placeholder="e.g., Weekend Championship"
            />
          </div>

          <div>
            <label
              style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
            >
              Max Players
            </label>
            <select
              className="input"
              value={newTournament.maxPlayers}
              onChange={(e) =>
                setNewTournament({
                  ...newTournament,
                  maxPlayers: e.target.value,
                })
              }
            >
              <option value={8}>8 Players</option>
              <option value={16}>16 Players</option>
            </select>
          </div>

          <div>
            <label
              style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
            >
              Format
            </label>
            <select
              className="input"
              value={newTournament.format}
              onChange={(e) =>
                setNewTournament({ ...newTournament, format: e.target.value })
              }
            >
              <option value="single">Single Elimination</option>
              <option value="double">Double Elimination</option>
              <option value="round-robin">Round Robin</option>
            </select>
          </div>

          <button
            className="btn primary"
            onClick={handleCreate}
            style={{ marginTop: 16 }}
          >
            Create Tournament
          </button>
        </div>
      </div>
    );
  }

  // Bracket view
  if (!currentTournament) return null;

  return (
    <div
      className="panel"
      style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <button className="btn ghost" onClick={() => setView("list")}>
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>{currentTournament.name}</h2>
        <div
          className="chip"
          style={{
            background:
              currentTournament.status === "finished"
                ? "#3ddcc8"
                : currentTournament.status === "active"
                  ? "#ffc93c"
                  : "#7b5cff",
          }}
        >
          {currentTournament.status}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={() => setView("leaderboard")}>
            📊 Leaderboard
          </button>
          {currentTournament.status === "setup" && (
            <>
              <button className="btn ghost" onClick={() => handleAddAI("easy")}>
                🤖 +Easy AI
              </button>
              <button
                className="btn ghost"
                onClick={() => handleAddAI("normal")}
              >
                🎮 +Normal AI
              </button>
              <button className="btn ghost" onClick={() => handleAddAI("hard")}>
                🧠 +Hard AI
              </button>
              <button className="btn primary" onClick={handleStart}>
                Start Tournament
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          className="notice"
          style={{ marginBottom: 16, background: "rgba(255, 60, 122, 0.2)" }}
        >
          {error}
        </div>
      )}

      {/* Players in setup */}
      {currentTournament.status === "setup" && (
        <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
          <h4 style={{ marginTop: 0 }}>
            Players ({currentTournament.players.length}/
            {currentTournament.maxPlayers})
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {currentTournament.players.map((p) => (
              <div key={p.id} className="chip">
                {p.avatar?.emoji} {p.name}
                {p.isBot && (
                  <span style={{ marginLeft: 4, fontSize: 10 }}>
                    ({p.difficulty})
                  </span>
                )}
              </div>
            ))}
          </div>
          {currentTournament.players.length < 8 && (
            <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>
              Need at least 8 players to start
            </p>
          )}
        </div>
      )}

      {/* Bracket Display */}
      {currentTournament.rounds && (
        <div
          style={{
            display: "flex",
            gap: 40,
            overflowX: "auto",
            paddingBottom: 20,
          }}
        >
          {currentTournament.rounds.map((round, roundIdx) => (
            <div key={round.round} style={{ minWidth: 200 }}>
              <div
                style={{
                  textAlign: "center",
                  fontWeight: 600,
                  marginBottom: 16,
                  padding: "8px 16px",
                  background:
                    roundIdx === currentTournament.currentRound
                      ? "var(--accent-1)"
                      : "var(--panel)",
                  borderRadius: 20,
                }}
              >
                {round.name}
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {round.matches.map((match, matchIdx) => (
                  <div
                    key={match.id}
                    className="panel"
                    style={{
                      padding: 12,
                      background:
                        match.status === "finished"
                          ? "var(--panel)"
                          : match.status === "active"
                            ? "rgba(255, 201, 60, 0.2)"
                            : "rgba(0,0,0,0.3)",
                      border:
                        match.status === "active"
                          ? "2px solid var(--accent-2)"
                          : "1px solid rgba(0,0,0,0.3)",
                    }}
                  >
                    {/* Player 1 */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        background:
                          match.winner?.id === match.player1.id
                            ? "rgba(61, 220, 200, 0.3)"
                            : "transparent",
                        borderRadius: 4,
                      }}
                    >
                      <Avatar profile={match.player1} size={24} />
                      <span
                        style={{
                          flex: 1,
                          fontWeight:
                            match.winner?.id === match.player1.id ? 600 : 400,
                        }}
                      >
                        {match.player1.name}
                      </span>
                      <span>{match.scores?.player1 ?? "-"}</span>
                    </div>

                    {/* Divider */}
                    <div
                      style={{
                        height: 1,
                        background: "rgba(255,255,255,0.1)",
                        margin: "8px 0",
                      }}
                    />

                    {/* Player 2 */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        background:
                          match.winner?.id === match.player2.id
                            ? "rgba(61, 220, 200, 0.3)"
                            : "transparent",
                        borderRadius: 4,
                      }}
                    >
                      <Avatar profile={match.player2} size={24} />
                      <span
                        style={{
                          flex: 1,
                          fontWeight:
                            match.winner?.id === match.player2.id ? 600 : 400,
                        }}
                      >
                        {match.player2.name}
                      </span>
                      <span>{match.scores?.player2 ?? "-"}</span>
                    </div>

                    {/* Simulate button for pending matches */}
                    {match.status === "pending" &&
                      currentTournament.status === "active" && (
                        <button
                          className="btn primary sm"
                          style={{ marginTop: 8, width: "100%" }}
                          onClick={() => handleSimulateMatch(match.id)}
                        >
                          Simulate Match
                        </button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {currentTournament.winner && (
        <div
          className="panel"
          style={{
            marginTop: 20,
            padding: 30,
            textAlign: "center",
            background:
              "linear-gradient(135deg, rgba(255, 201, 60, 0.3), rgba(255, 60, 122, 0.3))",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
          <h3 style={{ margin: 0 }}>Champion</h3>
          <div style={{ fontSize: 24, fontWeight: 600 }}>
            {currentTournament.winner.name}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  CardCreator,
  Stats,
  LeaderboardScreen,
  ReplayViewer,
  Tournament,
});
