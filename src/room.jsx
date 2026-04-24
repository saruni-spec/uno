// Room setup — personalization, teams, house rules, invite

function RoomSetup({ room, onStart, onBack }) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [state, setState] = React.useState(() => ({
    name: room?.name || "New Room",
    icon: room?.icon || "🎉",
    felt: room?.felt || "neon",
    cardBack: "classic",
    mode: room?.mode || "solo",
    rules: window.APP_DATA.houseRules.map((r) => ({ ...r })),
    players: room?.players?.length
      ? room.players
      : [
      { name: "You", av: "🦊", bg: "#ff3c7a", team: "A", ready: true },
      ],
    customRule: "",
    extraRules: [],
    showInvite: false,
  }));

  const felt = window.APP_DATA.felts.find((f) => f.id === state.felt);
  const activeRules =
    state.rules.filter((r) => r.on).length + state.extraRules.length;

  const setPlayerTeam = (idx, team) => {
    const players = [...state.players];
    players[idx] = { ...players[idx], team };
    setState((s) => ({ ...s, players }));
  };

  const addAIPlayer = (difficulty = "normal") => {
    if (state.players.length >= 8) {
      setError("Maximum 8 players allowed");
      return;
    }

    const aiPlayer = BotAdapter.createAIPlayer(
      state.players.length,
      difficulty,
    );
    aiPlayer.ready = true;
    aiPlayer.team = state.players.length % 2 === 0 ? "A" : "B";

    setState((s) => ({
      ...s,
      players: [...s.players, aiPlayer],
      error: "",
    }));
  };

  const handleStart = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: state.name,
        icon: state.icon,
        felt: state.felt,
        mode: state.mode,
        maxPlayers: 8,
        rules: state.rules,
        host: {
          name: state.players[0]?.name || "You",
          avatar: state.players[0]?.av || "🦊",
          color: state.players[0]?.bg || "#ff3c7a",
        },
        players: state.players,
        multiplayer: true,
        networkMode: "online",
      };
      let savedRoom = null;
      if (room?.id) {
        await dbAdapter.joinRoom(room.id, { team: state.players[0]?.team || null });
        savedRoom = (await dbAdapter.getRoom(room.id)) || room;
      } else {
        savedRoom = await dbAdapter.createRoom(payload);
      }
      onStart(savedRoom, payload);
    } catch (e) {
      setError(e.message || "Failed to start room");
    } finally {
      setSaving(false);
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
          Room setup
        </h2>
        <span className="chip ok">Host · You</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn ghost sm"
            onClick={() => setState((s) => ({ ...s, showInvite: true }))}
          >
            🔗 Invite
          </button>
          <button
            className="btn primary"
            onClick={handleStart}
            disabled={saving}
          >
            Start game · {state.players.filter((p) => p.ready).length}/
            {state.players.length} ready
          </button>
        </div>
      </div>
      {error && (
        <div className="panel" style={{ marginBottom: 16 }}>
          Could not create room: {error}
        </div>
      )}

      <div
        style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}
      >
        {/* Left column: identity + players */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Preview */}
          <div
            className="panel"
            style={{
              padding: 0,
              overflow: "hidden",
              position: "relative",
              minHeight: 240,
            }}
          >
            <div
              className={`felt-bg ${felt.cls}`}
              style={{ position: "absolute", inset: 0 }}
            />
            <div
              style={{
                position: "relative",
                padding: 24,
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 22,
                  background: state.players[0].bg,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 44,
                  border: "3px solid #0a0418",
                  boxShadow: "0 6px 0 rgba(0,0,0,.4)",
                }}
              >
                {state.icon}
              </div>
              <div>
                <div
                  className="display"
                  style={{ fontSize: 32, textShadow: "3px 3px 0 #0a0418" }}
                >
                  {state.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="chip">
                    {state.mode === "teams" ? "👥 Teams" : "🧍 Free-for-all"}
                  </span>
                  <span className="chip">📜 {activeRules} house rules</span>
                  <span className="chip">🎨 {felt.name} felt</span>
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex" }}>
                <div style={{ transform: "rotate(-8deg)", marginRight: -20 }}>
                  <Card color="red" value="7" size="sm" />
                </div>
                <div style={{ transform: "rotate(4deg)" }}>
                  <Card color="blue" value="reverse" size="sm" />
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Identity</h3>
            <div className="field">
              <label>Room name</label>
              <input
                aria-label="Room name"
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
                {window.APP_DATA.roomIcons.map((i) => (
                  <div
                    key={i}
                    onClick={() => setState((s) => ({ ...s, icon: i }))}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 22,
                      cursor: "pointer",
                      background:
                        state.icon === i
                          ? "rgba(255,210,63,.2)"
                          : "rgba(0,0,0,.2)",
                      border: `2px solid ${state.icon === i ? "var(--accent-2)" : "transparent"}`,
                    }}
                  >
                    {i}
                  </div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Table felt</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                }}
              >
                {window.APP_DATA.felts.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setState((s) => ({ ...s, felt: f.id }))}
                    className={f.cls}
                    style={{
                      height: 64,
                      borderRadius: 12,
                      cursor: "pointer",
                      border: `3px solid ${state.felt === f.id ? "var(--accent-2)" : "#0a0418"}`,
                      display: "flex",
                      alignItems: "flex-end",
                      padding: 8,
                      position: "relative",
                      boxShadow: "0 4px 0 rgba(0,0,0,.3)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: "rgba(0,0,0,.6)",
                        padding: "2px 6px",
                        borderRadius: 6,
                      }}
                    >
                      {f.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Card back</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {window.APP_DATA.cardBacks.map((cb) => (
                  <div
                    key={cb.id}
                    onClick={() => setState((s) => ({ ...s, cardBack: cb.id }))}
                    style={{ cursor: "pointer", textAlign: "center" }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 68,
                        borderRadius: 10,
                        background: `radial-gradient(circle at 50% 50%, ${cb.swatch} 0%, #1a0a40 90%)`,
                        border: `3px solid ${state.cardBack === cb.id ? "var(--accent-2)" : "#0a0418"}`,
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "Lilita One",
                        color: "var(--accent-2)",
                        fontSize: 14,
                        textShadow: "-1px 1px 0 #0a0418",
                        transform: "rotate(-6deg)",
                      }}
                    >
                      S!
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 4,
                        color: "var(--ink-dim)",
                      }}
                    >
                      {cb.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Players · {state.players.length}</h3>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  background: "rgba(0,0,0,.3)",
                  padding: 4,
                  borderRadius: 10,
                }}
              >
                <button
                  className={`btn sm ${state.mode === "solo" ? "yellow" : "ghost"}`}
                  style={
                    state.mode === "solo"
                      ? {}
                      : { boxShadow: "none", border: "none" }
                  }
                  onClick={() => setState((s) => ({ ...s, mode: "solo" }))}
                >
                  🧍 Solo
                </button>
                <button
                  className={`btn sm ${state.mode === "teams" ? "yellow" : "ghost"}`}
                  style={
                    state.mode === "teams"
                      ? {}
                      : { boxShadow: "none", border: "none" }
                  }
                  onClick={() => setState((s) => ({ ...s, mode: "teams" }))}
                >
                  👥 Teams
                </button>
                <button
                  className={`btn sm ${state.mode === "shared" ? "yellow" : "ghost"}`}
                  style={
                    state.mode === "shared"
                      ? {}
                      : { boxShadow: "none", border: "none" }
                  }
                  onClick={() => setState((s) => ({ ...s, mode: "shared" }))}
                >
                  🤝 Shared hand
                </button>
              </div>
            </div>

            {state.mode !== "solo" && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-dim)",
                  marginBottom: 10,
                }}
              >
                {state.mode === "teams"
                  ? "Team members play separate hands, share the win."
                  : "Team members share a single hand and play cooperatively."}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.players.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    background: "rgba(0,0,0,.2)",
                    borderRadius: 12,
                    border: "2px solid rgba(255,255,255,.04)",
                  }}
                >
                  <Avatar av={p.av} bg={p.bg} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {p.name}
                      {i === 0 && (
                        <span className="chip ok" style={{ marginLeft: 8 }}>
                          you · host
                        </span>
                      )}
                      {p.isBot && (
                        <span
                          className="chip"
                          style={{
                            marginLeft: 8,
                            background:
                              p.difficulty === "easy"
                                ? "#3ddcc8"
                                : p.difficulty === "hard"
                                  ? "#ff3c7a"
                                  : "#ffc93c",
                          }}
                        >
                          {p.difficulty}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                      {p.ready ? "✓ Ready" : "⏳ Setting up..."}
                    </div>
                  </div>
                  {state.mode !== "solo" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {["A", "B", "C", "D"].map((t) => (
                        <div
                          key={t}
                          onClick={() => setPlayerTeam(i, t)}
                          className={`team-badge team-${t.toLowerCase()}`}
                          style={{
                            cursor: "pointer",
                            opacity: p.team === t ? 1 : 0.3,
                            transform: p.team === t ? "scale(1.1)" : "none",
                          }}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button
                className="btn ghost sm"
                style={{ justifyContent: "center" }}
              >
                + Invite another player
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn ghost sm"
                  style={{ justifyContent: "center", flex: 1 }}
                  onClick={() => addAIPlayer("easy")}
                >
                  🤖 Add Easy AI
                </button>
                <button
                  className="btn ghost sm"
                  style={{ justifyContent: "center", flex: 1 }}
                  onClick={() => addAIPlayer("normal")}
                >
                  🎮 Add Normal AI
                </button>
                <button
                  className="btn ghost sm"
                  style={{ justifyContent: "center", flex: 1 }}
                  onClick={() => addAIPlayer("hard")}
                >
                  🧠 Add Hard AI
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: rules */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <h3 style={{ margin: 0 }}>📜 House rules</h3>
              <span className="chip">{activeRules} on</span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-dim)",
                marginBottom: 14,
              }}
            >
              Every family has their own. Toggle what's in play — or write your
              own below.
            </div>
            {state.rules.map((r, i) => (
              <div key={r.id} className={`rule-row ${r.on ? "on" : ""}`}>
                <div className="rr-meta">
                  <div className="rr-title">
                    <span style={{ fontSize: 18 }}>{r.emoji}</span> {r.name}
                  </div>
                  <div className="rr-desc">{r.desc}</div>
                </div>
                <Switch
                  on={r.on}
                  onChange={(v) => {
                    const rules = [...state.rules];
                    rules[i] = { ...r, on: v };
                    setState((s) => ({ ...s, rules }));
                  }}
                />
              </div>
            ))}

            {state.extraRules.length > 0 && (
              <>
                <div className="wavy-divider" />
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: "var(--ink-dim)",
                    marginBottom: 8,
                  }}
                >
                  Your custom rules
                </div>
                {state.extraRules.map((er, i) => (
                  <div key={i} className="rule-row on">
                    <div className="rr-meta">
                      <div className="rr-title">
                        <span style={{ fontSize: 18 }}>✏️</span> {er}
                      </div>
                      <div className="rr-desc">Custom house rule.</div>
                    </div>
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          extraRules: s.extraRules.filter((_, x) => x !== i),
                        }));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </>
            )}

            <div className="wavy-divider" />
            <div className="field" style={{ margin: 0 }}>
              <label>Add your own house rule</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  aria-label="Custom house rule"
                  type="text"
                  placeholder='e.g. "Stacking skips — 2 skips in a row = everyone draws"'
                  value={state.customRule}
                  onChange={(e) =>
                    setState((s) => ({ ...s, customRule: e.target.value }))
                  }
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    if (state.customRule.trim()) {
                      setState((s) => ({
                        ...s,
                        extraRules: [...s.extraRules, s.customRule.trim()],
                        customRule: "",
                      }));
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>⚙️ Match settings</h3>
            <div className="field">
              <label>Play to</label>
              <select aria-label="Score target" defaultValue="500">
                <option value="single">Single round (first to 0 wins)</option>
                <option value="250">250 points</option>
                <option value="500">500 points</option>
                <option value="1000">1000 points</option>
                <option value="custom">Custom target...</option>
              </select>
            </div>
            <div className="field">
              <label>Starting hand size</label>
              <select aria-label="Starting hand size" defaultValue="7">
                <option>5</option>
                <option>7</option>
                <option>10</option>
              </select>
            </div>
            <div className="field">
              <label>Turn timer</label>
              <select aria-label="Turn timer" defaultValue="30">
                <option value="0">No timer</option>
                <option value="15">15 sec</option>
                <option value="30">30 sec</option>
                <option value="60">1 min</option>
              </select>
            </div>
            <div className="rule-row on">
              <div className="rr-meta">
                <div className="rr-title">🎨 Include custom cards</div>
                <div className="rr-desc">
                  Shuffle your room's custom cards into the deck.
                </div>
              </div>
              <Switch on={true} onChange={() => {}} />
            </div>
          </div>
        </div>
      </div>

      {state.showInvite && (
        <InviteModal
          room={state}
          onClose={() => setState((s) => ({ ...s, showInvite: false }))}
        />
      )}
    </div>
  );
}

function InviteModal({ room, onClose }) {
  const code =
    "SHOUT-" +
    (room.name || "ROOM")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4) +
    "-" +
    Math.floor(1000 + Math.random() * 9000);
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <h2>Invite your crew 🎉</h2>
        <p style={{ color: "var(--ink-dim)", marginTop: 0 }}>
          Share the code or link. Works across wifi, internet, or same device.
        </p>

        <div
          style={{
            background: "rgba(0,0,0,.3)",
            borderRadius: 14,
            padding: 20,
            textAlign: "center",
            margin: "16px 0",
            border: "2px dashed rgba(255,255,255,.15)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: "var(--ink-dim)",
            }}
          >
            Room code
          </div>
          <div
            className="display"
            style={{
              fontSize: 36,
              letterSpacing: ".1em",
              textShadow: "3px 3px 0 #0a0418",
              margin: "6px 0 10px",
            }}
          >
            {code}
          </div>
          <button className="btn sm yellow">📋 Copy</button>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <button className="btn ghost">📱 QR code</button>
          <button className="btn ghost">🔗 Share link</button>
          <button className="btn ghost">📡 Local wifi</button>
          <button className="btn ghost">🌐 Internet</button>
        </div>

        <div style={{ textAlign: "right", marginTop: 16 }}>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RoomSetup, InviteModal });
