// Game table — the live play view (Phase 1: Engine-driven)

function GameTable({ onExit }) {
  const {
    gameState,
    matchState,
    playCard: enginePlayCard,
    drawCard: engineDrawCard,
    startNextRound,
    isPlayerTurn,
    getPlayableCards,
    canJumpIn,
    jumpIn,
    challengeWild4,
    getTurnTimeLimit,
    markActivity,
    chatMessages,
    sendChat,
    syncMeta,
  } = useGame();

  const [confetti, setConfetti] = React.useState(false);
  const [showWild, setShowWild] = React.useState(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");
  const [showBigUno, setShowBigUno] = React.useState(false);
  const [soundOn, setSoundOn] = React.useState(() => {
    const saved = localStorage.getItem("shout.sound");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [felt] = React.useState("neon");
  const [handOpen, setHandOpen] = React.useState(false);

  // Touch handling for swipe gestures
  const [touchStart, setTouchStart] = React.useState(null);
  const [touchEnd, setTouchEnd] = React.useState(null);
  const minSwipeDistance = 50;

  // Initialize sound and update setting
  React.useEffect(() => {
    SoundAdapter.setEnabled(soundOn);
    localStorage.setItem("shout.sound", JSON.stringify(soundOn));
    if (soundOn) {
      SoundAdapter.init();
    }
  }, [soundOn]);

  // Touch handlers for swipe gestures
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && !handOpen) {
      setHandOpen(true); // Swipe left to open hand
    }
    if (isRightSwipe && handOpen) {
      setHandOpen(false); // Swipe right to close hand
    }
  };

  // Keyboard navigation
  const [focusedCardIndex, setFocusedCardIndex] = React.useState(-1);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameState || !isMyTurn) return;

      const playableIndices = hand
        .map((c, i) => (canPlayCard(c) ? i : -1))
        .filter((i) => i !== -1);

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          if (playableIndices.length > 0) {
            const currentIdx = playableIndices.indexOf(focusedCardIndex);
            const newIdx =
              currentIdx > 0 ? currentIdx - 1 : playableIndices.length - 1;
            setFocusedCardIndex(playableIndices[newIdx]);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (playableIndices.length > 0) {
            const currentIdx = playableIndices.indexOf(focusedCardIndex);
            const newIdx =
              currentIdx < playableIndices.length - 1 ? currentIdx + 1 : 0;
            setFocusedCardIndex(playableIndices[newIdx]);
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedCardIndex >= 0 && canPlayCard(hand[focusedCardIndex])) {
            handlePlayCard(hand[focusedCardIndex]);
          }
          break;
        case "d":
        case "D":
          e.preventDefault();
          handleDrawCard();
          break;
        case "u":
        case "U":
          e.preventDefault();
          if (isMyTurn && hand.length === 2) {
            setShowBigUno(true);
            setTimeout(() => setShowBigUno(false), 1000);
            SoundAdapter?.unoShout?.();
            if (markActivity) markActivity();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, isMyTurn, hand, focusedCardIndex]);

  const [showHandEnd, setShowHandEnd] = React.useState(false);

  // Turn timer state
  const [timeLeft, setTimeLeft] = React.useState(null);
  const [showChallenge, setShowChallenge] = React.useState(null);
  const [jumpInCards, setJumpInCards] = React.useState([]);
  const [syncAgeSec, setSyncAgeSec] = React.useState(0);

  // Local human seat: prefer stable id "me", else first player (legacy)
  const meIndex = gameState?.players?.length
    ? gameState.players.findIndex((p) => p.id === "me")
    : -1;
  const me =
    meIndex >= 0 && gameState?.players
      ? gameState.players[meIndex]
      : gameState?.players?.[0];
  const myHand = me?.hand || [];
  const isMyTurn = gameState && me?.id ? isPlayerTurn(me.id) : false;
  const topCard = gameState?.topCard;
  const direction = gameState?.direction;
  const currentColor = gameState?.currentColor;
  const deckCount = gameState?.deck?.length || 0;
  const hand = me?.hand || [];

  // Opponents: everyone except the local seat
  const opponents =
    gameState?.players?.filter((p) => p.id !== me?.id) || [];

  const playableCards = gameState ? getPlayableCards(me?.id) : [];
  const canPlayCard = (c) => playableCards.some((pc) => pc.id === c.id);

  const handlePlayCard = async (c) => {
    if (!canPlayCard(c)) return;
    markActivity(); // Track player activity
    SoundAdapter.cardFlip(); // Play card sound
    if (c.color === "wild") {
      SoundAdapter.wildCard(); // Special wild sound
      setShowWild(c);
      return;
    }

    const result = await enginePlayCard(me.id, c.id);
    if (result.isWinner) {
      setConfetti(true);
      setShowHandEnd(true);
      SoundAdapter.winCelebration(); // Victory sound
    }
  };

  const handleWildColor = async (color) => {
    if (!showWild) return;
    SoundAdapter.actionCard(); // Action card sound for wild
    const result = await enginePlayCard(me.id, showWild.id, color);
  };

  const handlePickWild = handleWildColor;

  const handleDrawCard = async () => {
    if (!isMyTurn) return;
    markActivity(); // Track player activity
    SoundAdapter.cardDraw(); // Play draw sound
    await engineDrawCard(me.id);
  };

  const handleStartNextRound = () => {
    setShowHandEnd(false);
    startNextRound();
  };

  // Turn timer effect
  React.useEffect(() => {
    if (!isMyTurn || showHandEnd) {
      setTimeLeft(null);
      return;
    }

    const turnLimit = getTurnTimeLimit();
    if (!turnLimit) return; // Timer disabled

    let remaining = turnLimit;
    setTimeLeft(remaining);

    const timer = setInterval(() => {
      remaining -= 1;

      // Timer warning sounds
      if (remaining === 5 || remaining === 3 || remaining === 1) {
        SoundAdapter.timerWarning();
      }

      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(null);
        // Auto-draw when timer expires
        if (isMyTurn && !showHandEnd && me?.id) {
          engineDrawCard(me.id);
        }
        return;
      }

      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [isMyTurn, gameState?.currentPlayerIndex, showHandEnd, me?.id]);

  // Check for jump-in opportunities
  React.useEffect(() => {
    if (!gameState || !me || isMyTurn) {
      setJumpInCards([]);
      return;
    }

    // Find cards that can be jumped in
    const jumpable = me.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => {
        const result = canJumpIn(me.id, card.id);
        return result.canJump;
      });

    setJumpInCards(jumpable.map(({ card }) => card));
  }, [gameState?.topCard, gameState?.currentColor, isMyTurn]);

  const handleJumpIn = async (card) => {
    if (card.color === "wild") {
      // Need to pick color first
      setShowWild(card);
      return;
    }
    const result = await jumpIn(me.id, card.id);
    if (result.isWinner) {
      setConfetti(true);
      setShowHandEnd(true);
    }
  };

  const handleChallenge = async () => {
    if (!showChallenge) return;
    // Target is the player who played the wild4 (previous player)
    const currentIdx = gameState.currentPlayerIndex;
    const direction = gameState.direction;
    const playerCount = gameState.players.length;
    const targetIdx =
      direction === "cw"
        ? (currentIdx - 1 + playerCount) % playerCount
        : (currentIdx + 1) % playerCount;
    const targetId = gameState.players[targetIdx]?.id;

    await challengeWild4(me.id, targetId);
    setShowChallenge(null);
  };

  const feltObj = window.APP_DATA.felts.find((f) => f.id === felt);

  // Screen reader announcement - MUST be before any conditional return
  const [announcement, setAnnouncement] = React.useState("");

  React.useEffect(() => {
    if (gameState) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const isMyTurn = currentPlayer?.id === me?.id;
      if (isMyTurn) {
        setAnnouncement(`Your turn! You have ${myHand?.length || 0} cards.`);
      }
    }
  }, [gameState?.currentPlayerIndex]);

  React.useEffect(() => {
    const ts = syncMeta?.lastRemoteSyncAt;
    if (!ts) {
      setSyncAgeSec(0);
      return;
    }
    const tick = () => setSyncAgeSec(Math.max(0, Math.floor((Date.now() - ts) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [syncMeta?.lastRemoteSyncAt]);

  // Loading state
  if (!gameState || !matchState) {
    return (
      <div className="table-wrap">
        <div
          className="felt"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 24, color: "var(--ink-dim)" }}>
            Loading game...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="table-wrap"
      role="main"
      aria-label="UNO Game Table"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Screen reader live region */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      <div className="bg-decor" />

      {/* Top chrome */}
      <div className="table-top-chrome">
        <button className="btn ghost sm" onClick={onExit}>
          ← Leave
        </button>
        <div
          className="logo"
          style={{ fontSize: 20, transform: "rotate(-2deg)" }}
        >
          <div
            className="badge b2"
            style={{ width: 28, height: 28, fontSize: 16 }}
          >
            🎉
          </div>
          <span className="word">Saturday Night Chaos</span>
        </div>
        <span className="chip live">
          Round {matchState?.currentRound || 1} · Target{" "}
          {matchState?.targetScore || 500}
        </span>
        <span className="chip">
          📜 {Object.values(gameState?.rules || {}).filter(Boolean).length}{" "}
          house rules
        </span>
        <span
          className="chip"
          title="Debug sync health"
          style={{
            background:
              syncMeta?.source === "backend"
                ? syncMeta?.lastError
                  ? "#ff3c7a"
                  : "rgba(61,220,132,.25)"
                : "rgba(255,255,255,.12)",
          }}
        >
          🔄 {syncMeta?.source || "local"}
          {syncMeta?.source === "backend" ? ` · ${syncAgeSec}s` : ""}
          {syncMeta?.lastError ? " · !" : ""}
        </span>
        {timeLeft !== null && (
          <span
            className="chip"
            style={{
              background:
                timeLeft <= 5
                  ? "#ff3c7a"
                  : timeLeft <= 10
                    ? "#ffc93c"
                    : "var(--accent-1)",
              animation: timeLeft <= 5 ? "pulse 1s infinite" : "none",
            }}
          >
            ⏱ {timeLeft}s
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn ghost sm"
            onClick={() => setSoundOn((s) => !s)}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button
            className="btn ghost sm"
            onClick={() => setChatOpen((c) => !c)}
          >
            💬 Chat
          </button>
          <button className="btn ghost sm">⚙</button>
        </div>
      </div>

      {/* Score strip */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "10px 20px",
          background: "rgba(10,4,24,.6)",
          borderBottom: "2px solid rgba(0,0,0,.4)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Round indicator */}
        <span
          className="chip"
          style={{
            background: "var(--accent-2)",
            color: "var(--ink)",
            fontWeight: 600,
          }}
        >
          Round {matchState?.currentRound || 1}
        </span>

        {/* Scores */}
        {gameState?.mode === "teams"
          ? // Team scores
            ["A", "B", "C", "D"].map((team) => {
              const teamPlayers = gameState.players.filter(
                (p) => p.team === team,
              );
              if (teamPlayers.length === 0) return null;
              const teamScore = Object.entries(
                matchState?.cumulativeScores || {},
              )
                .filter(([id]) => teamPlayers.some((p) => p.id === id))
                .reduce((sum, [, score]) => sum + score, 0);
              return (
                <span
                  key={team}
                  className={`team-badge team-${team.toLowerCase()}`}
                >
                  Team {team}: {teamScore}
                </span>
              );
            })
          : // Individual scores
            gameState?.players?.slice(0, 4).map((p) => (
              <span
                key={p.id}
                className="chip"
                style={{
                  background: p.avatar?.color || p.bg || "#555",
                  fontWeight:
                    gameState?.currentPlayerIndex ===
                    gameState?.players?.findIndex((pl) => pl.id === p.id)
                      ? 700
                      : 400,
                  boxShadow:
                    gameState?.currentPlayerIndex ===
                    gameState?.players?.findIndex((pl) => pl.id === p.id)
                      ? "0 0 0 2px var(--ink)"
                      : "none",
                }}
              >
                {p.name}: {matchState?.cumulativeScores?.[p.id] || 0}
              </span>
            ))}

        {/* Target score */}
        <span className="chip" style={{ background: "rgba(255,255,255,0.1)" }}>
          Target: {matchState?.targetScore || 500}
        </span>

        <span
          style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-dim)" }}
        >
          {gameState?.rules?.turnTimer
            ? `⏱ ${timeLeft || getTurnTimeLimit()}s`
            : ""}
        </span>
      </div>

      <div className="felt">
        <div className={`felt-bg ${feltObj.cls}`} />
        <div className="felt-inner">
          {/* Opponents */}
          <div className="opponents">
            {opponents.map((op) => (
              <OpponentSlot
                key={op.id}
                op={op}
                isTurn={
                  gameState.players.findIndex((p) => p.id === op.id) ===
                  gameState.currentPlayerIndex
                }
              />
            ))}
          </div>

          {/* Center play area */}
          <div className="play-area">
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  color: "var(--ink-dim)",
                  marginBottom: 6,
                }}
              >
                Draw pile · {deckCount}
              </div>
              <div className="deck-stack-wrap">
                <div className="deck-stack">
                  <Card back size="lg" />
                  <Card back size="lg" />
                  <Card
                    back
                    size="lg"
                    onClick={handleDrawCard}
                    style={{
                      cursor: isMyTurn ? "pointer" : "not-allowed",
                      opacity: isMyTurn ? 1 : 0.5,
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className={`direction-indicator ${direction === "ccw" ? "ccw" : ""}`}
            >
              ↻
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  color: "var(--ink-dim)",
                  marginBottom: 6,
                }}
              >
                Discard pile
              </div>
              <div className="discard-pile">
                {gameState.discardPile.slice(-2).map((c, i) => (
                  <Card key={i} color={c.color} value={c.value} size="lg" />
                ))}
                <Card color={topCard.color} value={topCard.value} size="lg" />
              </div>
              {currentColor && currentColor !== topCard.color && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "var(--accent-2)",
                  }}
                >
                  Current color: <strong>{currentColor.toUpperCase()}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Player area */}
          <div className="player-area">
            <div className="player-bar">
              {isMyTurn ? (
                <span
                  className="chip"
                  style={{
                    background: "var(--accent-2)",
                    color: "#2a1854",
                    borderColor: "transparent",
                  }}
                >
                  ▶ Your turn
                </span>
              ) : (
                <span className="chip" style={{ opacity: 0.6 }}>
                  Waiting...
                </span>
              )}
              {me.team && (
                <span className={`team-badge team-${me.team.toLowerCase()}`}>
                  Team {me.team}
                </span>
              )}
              <span className="chip">{hand.length} cards</span>
            </div>
            <div className="hand">
              {hand.map((c) => (
                <Card
                  key={c.id}
                  color={c.color}
                  value={c.value}
                  sym={
                    c.sym ||
                    (c.value === "wild"
                      ? "✦"
                      : c.value === "wild4"
                        ? "+4"
                        : c.value === "skip"
                          ? "🚫"
                          : c.value === "reverse"
                            ? "↺"
                            : c.value === "draw2"
                              ? "+2"
                              : null)
                  }
                  playable={canPlayCard(c)}
                  onClick={() => {
                    if (jumpInCards.some((jc) => jc.id === c.id)) {
                      handleJumpIn(c);
                    } else if (canPlayCard(c)) {
                      handlePlayCard(c);
                    }
                  }}
                  jumpable={jumpInCards.some((jc) => jc.id === c.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SHOUT button */}
      {hand.length <= 2 && (
        <button
          className="shout-btn"
          onClick={() => {
            setConfetti(true);
          }}
        >
          SHOUT!
        </button>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <div
          style={{
            position: "fixed",
            right: 20,
            top: 140,
            bottom: 20,
            width: 280,
            background: "linear-gradient(160deg, var(--bg-2), var(--bg-1))",
            border: "3px solid #0a0418",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 10px 0 rgba(0,0,0,.4)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="display" style={{ fontSize: 18 }}>
              Chat
            </div>
            <button className="btn ghost sm" onClick={() => setChatOpen(false)}>
              ✕
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {chatMessages.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--ink-dim)",
                  padding: 20,
                }}
              >
                No messages yet. Say hello! 👋
              </div>
            ) : (
              chatMessages.map((msg) => {
                const sender = gameState?.players?.find(
                  (p) => p.id === msg.senderId,
                );
                const isMe = msg.senderId === "me";
                return (
                  <ChatMsg
                    key={msg.id}
                    av={sender?.avatar?.emoji || (isMe ? "🦊" : "�")}
                    bg={sender?.avatar?.color || (isMe ? "#ff3c7a" : "#555")}
                    name={msg.senderName}
                    msg={msg.text}
                    me={isMe}
                  />
                );
              })
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              placeholder="Say something..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) =>
                e.key === "Enter" &&
                chatInput.trim() &&
                (sendChat(chatInput.trim()), setChatInput(""))
              }
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 10,
                border: "2px solid rgba(255,255,255,.1)",
                background: "rgba(0,0,0,.3)",
                color: "var(--ink)",
                fontFamily: "Fredoka, sans-serif",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              className="btn sm yellow"
              onClick={() =>
                chatInput.trim() &&
                (sendChat(chatInput.trim()), setChatInput(""))
              }
              disabled={!chatInput.trim()}
            >
              ➤
            </button>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["😂", "🔥", "😱", "🎉", "💀", "👑", "🤡"].map((e) => (
              <button
                key={e}
                className="btn ghost sm"
                style={{ padding: "4px 10px" }}
                onClick={() => sendChat(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wild color picker */}
      {showWild && (
        <div className="modal-wrap" onClick={() => setShowWild(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420 }}
          >
            <h2>Pick a color ✦</h2>
            <p style={{ color: "var(--ink-dim)", margin: "0 0 12px" }}>
              The next player must match this color.
            </p>
            <div className="wild-picker">
              <div className="wc red" onClick={() => handlePickWild("red")}>
                RED
              </div>
              <div
                className="wc yellow"
                onClick={() => handlePickWild("yellow")}
              >
                YELLOW
              </div>
              <div className="wc green" onClick={() => handlePickWild("green")}>
                GREEN
              </div>
              <div className="wc blue" onClick={() => handlePickWild("blue")}>
                BLUE
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Wild4 Modal */}
      {showChallenge && (
        <div className="modal-wrap" onClick={() => setShowChallenge(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400, textAlign: "center" }}
          >
            <h2>⚖️ Challenge Wild +4?</h2>
            <p style={{ color: "var(--ink-dim)", margin: "12px 0" }}>
              Do you think they played Wild +4 when they had other playable
              cards?
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 20,
                justifyContent: "center",
              }}
            >
              <button
                className="btn yellow"
                onClick={handleChallenge}
                aria-label="Challenge Wild +4"
              >
                Challenge!
              </button>
              <button
                className="btn ghost"
                onClick={() => setShowChallenge(null)}
                aria-label="Accept and draw 4 cards"
              >
                Accept & Draw 4
              </button>
            </div>
          </div>
        </div>
      )}

      {confetti && <Confetti onDone={() => setConfetti(false)} />}

      {/* Hand End Modal */}
      {showHandEnd && matchState?.status !== "finished" && (
        <div className="modal-wrap" onClick={() => setShowHandEnd(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400, textAlign: "center" }}
          >
            <h2>🎉 Hand Complete!</h2>
            <p style={{ color: "var(--ink-dim)", margin: "12px 0" }}>
              <strong>
                {gameState?.players?.find(
                  (p) =>
                    p.id ===
                    matchState?.roundHistory?.[
                      matchState.roundHistory.length - 1
                    ]?.winner,
                )?.name || "Winner"}
              </strong>{" "}
              won this hand!
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                margin: "20px 0",
              }}
            >
              {matchState?.roundHistory?.[matchState.roundHistory.length - 1]
                ?.scores &&
                Object.entries(
                  matchState.roundHistory[matchState.roundHistory.length - 1]
                    .scores,
                ).map(([playerId, score]) => {
                  const player = gameState?.players?.find(
                    (p) => p.id === playerId,
                  );
                  return (
                    <div
                      key={playerId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 8,
                      }}
                    >
                      <span>{player?.name || playerId}</span>
                      <span>{score > 0 ? `+${score}` : 0} pts</span>
                    </div>
                  );
                })}
            </div>
            <div
              style={{
                borderTop: "2px solid rgba(255,255,255,0.1)",
                paddingTop: 12,
                marginTop: 12,
              }}
            >
              <h3>Cumulative Scores</h3>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "center",
                  margin: "12px 0",
                }}
              >
                {Object.entries(matchState?.cumulativeScores || {}).map(
                  ([id, score]) => {
                    const player = gameState?.players?.find((p) => p.id === id);
                    return (
                      <div key={id} className="chip" style={{ fontSize: 14 }}>
                        {player?.name || id}: <strong>{score}</strong>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 16,
                justifyContent: "center",
              }}
            >
              <button className="btn yellow" onClick={handleStartNextRound}>
                Next Round ▶
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setShowHandEnd(false);
                  onExit();
                }}
              >
                Exit to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match End Modal */}
      {showHandEnd && matchState?.status === "finished" && (
        <div className="modal-wrap">
          <div className="modal" style={{ maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontSize: 80, marginBottom: 10 }}>🏆</div>
            <h1 style={{ color: "var(--accent-2)", marginBottom: 8 }}>
              Match Winner!
            </h1>

            {/* Winner display */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                margin: "20px 0",
                padding: "16px 24px",
                background:
                  "linear-gradient(135deg, rgba(255,201,60,0.2), rgba(255,60,122,0.2))",
                borderRadius: 16,
                border: "2px solid var(--accent-2)",
              }}
            >
              <div style={{ fontSize: 48 }}>
                {gameState?.players?.find((p) => p.id === matchState?.winner)
                  ?.avatar?.emoji || "🎉"}
              </div>
              <div style={{ textAlign: "left" }}>
                <h2 style={{ margin: 0, color: "var(--accent-2)" }}>
                  {gameState?.players?.find((p) => p.id === matchState?.winner)
                    ?.name || "Winner"}
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 14,
                    color: "var(--ink-dim)",
                  }}
                >
                  {matchState?.cumulativeScores?.[matchState?.winner] || 0}{" "}
                  points
                </p>
              </div>
            </div>

            <p
              style={{
                fontSize: 13,
                color: "var(--ink-dim)",
                marginBottom: 16,
              }}
            >
              {matchState?.roundHistory?.length || 0} rounds played
            </p>

            {/* Final Scoreboard */}
            <div
              style={{
                borderTop: "2px solid rgba(255,255,255,0.1)",
                paddingTop: 16,
                marginTop: 16,
              }}
            >
              <h3 style={{ marginBottom: 12, fontSize: 16 }}>
                Final Standings
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  margin: "12px 0",
                }}
              >
                {Object.entries(matchState?.cumulativeScores || {})
                  .sort(([, a], [, b]) => b - a)
                  .map(([id, score], index) => {
                    const player = gameState?.players?.find((p) => p.id === id);
                    const isWinner = id === matchState?.winner;
                    return (
                      <div
                        key={id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          background: isWinner
                            ? "rgba(255,201,60,0.15)"
                            : "rgba(0,0,0,0.2)",
                          borderRadius: 10,
                          border: isWinner
                            ? "1px solid var(--accent-2)"
                            : "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: isWinner
                                ? "var(--accent-2)"
                                : "var(--ink-dim)",
                              width: 24,
                            }}
                          >
                            #{index + 1}
                          </span>
                          <span style={{ fontSize: 16 }}>
                            {player?.avatar?.emoji}
                          </span>
                          <span style={{ fontWeight: isWinner ? 600 : 400 }}>
                            {player?.name || id}
                            {isWinner && " 👑"}
                          </span>
                        </div>
                        <span
                          style={{
                            fontWeight: 700,
                            color: isWinner ? "var(--accent-2)" : "var(--ink)",
                          }}
                        >
                          {score}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 24,
                justifyContent: "center",
              }}
            >
              <button
                className="btn yellow"
                onClick={() => {
                  // Clear match and game state, then start fresh
                  MatchState.clear(matchState.roomId);
                  // Keep same players/rules but reset scores
                  const freshMatch = {
                    roomId: matchState.roomId,
                    createdAt: Date.now(),
                    players: matchState.players,
                    targetScore: matchState.targetScore,
                    currentRound: 1,
                    cumulativeScores: {},
                    roundHistory: [],
                    status: "active",
                    winner: null,
                    mode: matchState.mode,
                    rules: matchState.rules,
                  };
                  matchState.players.forEach((pid) => {
                    freshMatch.cumulativeScores[pid] = 0;
                  });
                  MatchState.save(matchState.roomId, freshMatch);
                  setShowHandEnd(false);
                  startNextRound();
                }}
              >
                🔄 Rematch
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  MatchState.clear(matchState.roomId);
                  onExit();
                }}
              >
                Exit to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Virtual UNO Button for Mobile */}
      {isMyTurn && gameState && (
        <div
          className={`virtual-uno-btn ${showBigUno ? "pressed" : ""}`}
          onClick={() => {
            if (isMyTurn) {
              setShowBigUno(true);
              setTimeout(() => setShowBigUno(false), 1000);
              SoundAdapter.unoShout();
              if (markActivity) markActivity();
            }
          }}
          role="button"
          aria-label="Call UNO"
        >
          UNO!
        </div>
      )}
    </div>
  );
}

function OpponentSlot({ op, isTurn }) {
  const cardCount =
    typeof op.hand?.length === "number" ? op.hand.length : (op.cardCount || 0);
  return (
    <div className={`opponent ${isTurn ? "turn" : ""}`}>
      <div className="op-cards-count">{cardCount}</div>
      <div className="op-hand">
        {Array.from({ length: Math.min(cardCount, 5) }).map((_, i) => (
          <Card key={i} back size="sm" style={{ "--r": `${(i - 2) * 4}deg` }} />
        ))}
      </div>
      <div className="op-name-tag">
        <Avatar
          av={op.avatar?.emoji || op.av}
          bg={op.avatar?.color || op.bg}
          size={26}
        />
        {op.name}
        {op.team && (
          <span
            className={`team-badge team-${op.team.toLowerCase()}`}
            style={{ padding: "2px 6px", fontSize: 10 }}
          >
            {op.team}
          </span>
        )}
      </div>
    </div>
  );
}

function ChatMsg({ av, bg, name, msg, me }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        flexDirection: me ? "row-reverse" : "row",
      }}
    >
      <Avatar av={av} bg={bg} size={26} />
      <div>
        <div
          style={{
            fontSize: 10,
            color: "var(--ink-dim)",
            fontWeight: 600,
            textAlign: me ? "right" : "left",
          }}
        >
          {name}
        </div>
        <div
          style={{
            padding: "6px 10px",
            background: me ? "var(--accent-4)" : "rgba(0,0,0,.3)",
            borderRadius: 10,
            borderTopLeftRadius: me ? 10 : 2,
            borderTopRightRadius: me ? 2 : 10,
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GameTable });
