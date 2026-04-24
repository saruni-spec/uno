// App shell — routing + top bar + tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  cardStyle: "chunky",
  handCurve: true,
  bigShout: true,
  chaosMode: false,
}; /*EDITMODE-END*/

function App() {
  const [screen, setScreen] = React.useState(
    () => localStorage.getItem("shout.screen") || "lobby",
  );
  const [activeRoom, setActiveRoom] = React.useState(null);
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [tweaks, setTweaks] = React.useState(() => {
    // Load saved tweaks from localStorage
    try {
      const saved = localStorage.getItem("shout.tweaks");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new tweak keys
        return { ...TWEAK_DEFAULTS, ...parsed };
      }
    } catch (e) {
      console.error("Failed to load tweaks:", e);
    }
    return TWEAK_DEFAULTS;
  });
  const [roomConfigOverride, setRoomConfigOverride] = React.useState(null);
  const [backendDataOn, setBackendDataOn] = React.useState(
    !!window.APP_CONFIG?.USE_BACKEND_DATA,
  );

  React.useEffect(() => {
    localStorage.setItem("shout.screen", screen);
  }, [screen]);

  React.useEffect(() => {
    if (window.APP_CONFIG?.USE_BACKEND_DATA) {
      dbAdapter.ensureSession().catch((e) => {
        console.error("Failed to initialize backend session:", e);
      });
    }
  }, []);

  // Tweak-mode protocol
  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const updateTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    // Persist to localStorage
    try {
      localStorage.setItem("shout.tweaks", JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save tweaks:", e);
    }
    window.parent.postMessage(
      { type: "__edit_mode_set_keys", edits: { [k]: v } },
      "*",
    );
  };

  const setBackendMode = (enabled) => {
    setBackendDataOn(enabled);
    localStorage.setItem("shout.useBackendData", enabled ? "true" : "false");
    window.location.reload();
  };

  // Apply tweak: chaos mode toggles a CSS flag
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--chaos",
      tweaks.chaosMode ? "1" : "0",
    );
    document.body.classList.toggle("chaos", !!tweaks.chaosMode);
  }, [tweaks.chaosMode]);

  const nav = [
    { id: "lobby", label: "� Play" },
    { id: "room", label: "🚪 Room" },
    { id: "cards", label: "🃑 Cards" },
    { id: "leaderboard", label: "👑 Leaderboard" },
    { id: "stats", label: "🏆 Stats" },
  ];

  const hideTopbar = screen === "game";

  // When starting a game, build room config from activeRoom
  const buildRoomConfig = React.useCallback(() => {
    if (roomConfigOverride) return roomConfigOverride;
    if (!activeRoom) return null; // No room selected, should redirect to lobby
    return {
      roomId: activeRoom.id,
      players: activeRoom.players || [],
      rules: activeRoom.rules || {},
      mode: activeRoom.mode || "solo",
      multiplayer: Boolean(activeRoom.multiplayer),
      networkMode: activeRoom.networkMode || "local",
      isHost: activeRoom.isHost !== false,
      targetScore: activeRoom.targetScore || 500,
    };
  }, [activeRoom, roomConfigOverride]);

  return (
    <>
      <div className="bg-decor" />
      <div className="app" data-screen-label={`Screen · ${screen}`}>
        {!hideTopbar && (
          <div className="topbar">
            <div className="logo">
              <div className="badge">N</div>
              <div className="badge b2">🏠</div>
              <span className="word">Noni's Card House</span>
            </div>
            <div className="nav">
              {nav.map((n) => (
                <button
                  key={n.id}
                  className={screen === n.id ? "active" : ""}
                  onClick={() => setScreen(n.id)}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <div className="profile">
              <div className="av" style={{ background: "#ff3c7a" }}>
                🦊
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.1,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>You</span>
                <span style={{ fontSize: 10, color: "var(--ink-dim)" }}>
                  Lvl 14 · 22 wins
                </span>
              </div>
            </div>
          </div>
        )}

        {screen === "lobby" && (
          <Lobby
            onEnterRoom={(r) => {
              setActiveRoom(r);
              setScreen("room");
            }}
            onCreateRoom={() => {
              setActiveRoom(null);
              setScreen("room");
            }}
            onNav={setScreen}
          />
        )}
        {screen === "room" && (
          <RoomSetup
            room={activeRoom}
            onStart={(savedRoom, payload) => {
              setActiveRoom(savedRoom || activeRoom);
              const sourcePlayers =
                savedRoom?.players?.length > 0
                  ? savedRoom.players
                  : payload?.players || [];
              setRoomConfigOverride({
                roomId:
                  savedRoom?.id || activeRoom?.id || `quick-${Date.now()}`,
                players:
                  sourcePlayers.map((p, i) => ({
                    id: p.id || (i === 0 ? "me" : `p${i + 1}`),
                    name: p.name,
                    avatar: {
                      emoji: p.avatar?.emoji ?? p.av,
                      color: p.avatar?.color ?? p.bg,
                    },
                    team: p.team || null,
                    isBot: Boolean(p.isBot),
                    difficulty: p.difficulty || "normal",
                    lastActivity: p.lastActivity,
                  })) || buildRoomConfig().players,
                rules: Object.fromEntries(
                  (savedRoom?.rules || payload?.rules || []).map((r) => [
                    r.id,
                    !!r.on,
                  ]),
                ),
                mode:
                  payload?.mode === "shared"
                    ? "shared-hand"
                    : payload?.mode || "solo",
                multiplayer: payload?.multiplayer ?? savedRoom?.multiplayer ?? true,
                networkMode:
                  payload?.networkMode || savedRoom?.networkMode || "online",
                isHost: savedRoom?.isHost !== false,
                targetScore: 500,
                handSize: 7,
              });
              setScreen("game");
            }}
            onBack={() => setScreen("lobby")}
          />
        )}
        {screen === "game" &&
          (() => {
            const roomConfig =
              window.__RESUMED_MATCH_CONFIG || buildRoomConfig();
            // Redirect to lobby if no valid room config
            if (!roomConfig) {
              setScreen("lobby");
              return null;
            }
            return (
              <GameProvider initialRoomConfig={roomConfig}>
                <GameTable
                  onExit={() => {
                    window.__RESUMED_MATCH_CONFIG = null;
                    setScreen("lobby");
                  }}
                />
              </GameProvider>
            );
          })()}
        {screen === "cards" && (
          <CardCreator onBack={() => setScreen("lobby")} />
        )}
        {screen === "leaderboard" && (
          <LeaderboardScreen onBack={() => setScreen("lobby")} />
        )}
        {screen === "stats" && <Stats onBack={() => setScreen("lobby")} />}
      </div>

      {tweaksOpen && (
        <div className="tweaks">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <h4 style={{ margin: 0 }}>🔧 Tweaks</h4>
            <button
              className="btn ghost sm"
              style={{ padding: "4px 8px" }}
              onClick={() => setTweaksOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="row">
            <span>Curved hand layout</span>
            <Switch
              on={tweaks.handCurve}
              onChange={(v) => updateTweak("handCurve", v)}
            />
          </div>
          <div className="row">
            <span>Big SHOUT button</span>
            <Switch
              on={tweaks.bigShout}
              onChange={(v) => updateTweak("bigShout", v)}
            />
          </div>
          <div className="row">
            <span>Chaos mode 🌀</span>
            <Switch
              on={tweaks.chaosMode}
              onChange={(v) => updateTweak("chaosMode", v)}
            />
          </div>
          <div className="row">
            <span>Backend data mode</span>
            <Switch on={backendDataOn} onChange={setBackendMode} />
          </div>
          <div
            className="row"
            style={{
              alignItems: "flex-start",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12 }}>Card style</span>
            <div style={{ display: "flex", gap: 6 }}>
              {["chunky", "clean", "retro"].map((s) => (
                <button
                  key={s}
                  className={`btn sm ${tweaks.cardStyle === s ? "yellow" : "ghost"}`}
                  style={tweaks.cardStyle === s ? {} : { boxShadow: "none" }}
                  onClick={() => updateTweak("cardStyle", s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--ink-dim)" }}>
            Jump to screen:
          </div>
          <div
            style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}
          >
            {["lobby", "room", "game", "cards", "stats"].map((s) => (
              <button
                key={s}
                className="btn ghost sm"
                style={{ padding: "4px 8px" }}
                onClick={() => setScreen(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Export for HTML entry point
Object.assign(window, { App });
