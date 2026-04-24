// React State Management for Game Engine
// Phase 1: Local gameplay state with localStorage persistence

const { createContext, useContext, useState, useCallback, useEffect } = React;

// Game State Context
const GameStateContext = createContext(null);

// Hook for accessing game state
function useGame() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

// Game Provider Component
function GameProvider({ children, initialRoomConfig }) {
  const [gameState, setGameState] = React.useState(null);
  const [matchState, setMatchState] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [chatMessages, setChatMessages] = React.useState([]);
  const [syncMeta, setSyncMeta] = React.useState({
    source: "local",
    lastRemoteSyncAt: null,
    lastError: null,
  });
  const gameStateRef = React.useRef(gameState);
  React.useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Initialize game from room config
  const initGame = useCallback(async (roomConfig) => {
    let newGame = null;

    // Try to load saved game state first (for resume)
    const savedGame = MatchState.loadGame(roomConfig.roomId);
    const savedMatch = MatchState.load(roomConfig.roomId);

    if (savedGame && savedMatch && savedMatch.status !== "finished") {
      // Resume existing game
      newGame = savedGame;
      setGameState(newGame);
      setMatchState(savedMatch);
      return newGame;
    }

    // Initialize new game
    if (dbAdapter.backendEnabled()) {
      const remote = await dbAdapter.getRoomState(roomConfig.roomId);
      if (remote) {
        newGame = remote;
      } else {
        const created = await dbAdapter.submitMove(roomConfig.roomId, {
          type: "init",
          roomConfig,
        });
        newGame = created?.gameState || Engine.initGame(roomConfig);
      }
    } else {
      newGame = Engine.initGame(roomConfig);
    }
    setGameState(newGame);

    // Initialize fresh match state
    if (savedMatch && savedMatch.status !== "finished") {
      setMatchState(savedMatch);
    } else {
      const freshMatch = {
        roomId: roomConfig.roomId,
        createdAt: Date.now(),
        players: roomConfig.players.map((p) => p.id),
        targetScore: roomConfig.targetScore || 500,
        currentRound: 1,
        cumulativeScores: {},
        roundHistory: [],
        status: "active",
        winner: null,
        mode: roomConfig.mode || "solo",
      };
      // Initialize scores
      roomConfig.players.forEach((p) => {
        freshMatch.cumulativeScores[p.id] = 0;
      });
      setMatchState(freshMatch);
      MatchState.save(roomConfig.roomId, freshMatch);
    }

    // Save initial game state
    MatchState.saveGame(roomConfig.roomId, newGame);

    // Initialize replay recording
    ReplayRecorder.init(roomConfig.roomId, newGame);

    return newGame;
  }, []);

  // Play a card
  const playCard = useCallback(
    async (playerId, cardId, chosenColor = null) => {
      if (!gameState) return { success: false, error: "No active game" };
      let result;
      if (dbAdapter.backendEnabled()) {
        result = await dbAdapter.submitMove(gameState.roomId, {
          type: "play",
          playerId,
          cardId,
          chosenColor,
        });
      } else {
        result = Engine.playCard(gameState, playerId, cardId, chosenColor);
      }

      if (result.success) {
        setGameState(result.gameState);
        if (dbAdapter.backendEnabled()) {
          setSyncMeta((prev) => ({
            ...prev,
            source: "backend",
            lastRemoteSyncAt: Date.now(),
            lastError: null,
          }));
        }

        // Save game state via adapter (currently no-op)
        dbAdapter.saveGameState(result.gameState.gameId, result.gameState);

        // Save to localStorage for resume
        MatchState.saveGame(
          result.gameState.roomId || result.gameState.gameId,
          result.gameState,
        );

        // Record move in replay
        ReplayRecorder.recordMove(
          initialRoomConfig?.roomId || result.gameState?.roomId,
          {
            type: "play",
            playerId,
            cardId,
            chosenColor,
            timestamp: Date.now(),
            gameState: result.gameState,
          },
        );

        // If hand finished, update match state
        if (result.isWinner) {
          handleHandEnd(result.gameState, playerId);
        }
      }

      return result;
    },
    [gameState],
  );

  // Draw a card
  const drawCard = useCallback(
    async (playerId) => {
      if (!gameState) return { success: false, error: "No active game" };
      let result;
      if (dbAdapter.backendEnabled()) {
        result = await dbAdapter.submitMove(gameState.roomId, {
          type: "draw",
          playerId,
        });
      } else {
        result = Engine.drawCard(gameState, playerId);
      }

      if (result.success) {
        setGameState(result.gameState);
        if (dbAdapter.backendEnabled()) {
          setSyncMeta((prev) => ({
            ...prev,
            source: "backend",
            lastRemoteSyncAt: Date.now(),
            lastError: null,
          }));
        }
        dbAdapter.saveGameState(result.gameState.gameId, result.gameState);
        MatchState.saveGame(
          result.gameState.roomId || result.gameState.gameId,
          result.gameState,
        );

        // Record move in replay
        ReplayRecorder.recordMove(
          initialRoomConfig?.roomId || result.gameState?.roomId,
          {
            type: "draw",
            playerId,
            timestamp: Date.now(),
            gameState: result.gameState,
          },
        );
      }

      return result;
    },
    [gameState],
  );

  // Handle hand end (winner determined)
  const handleHandEnd = useCallback(
    (finalGameState, winnerId) => {
      if (!matchState) return;

      // Calculate scores for this hand
      const roundScores = {};
      let totalPoints = 0;

      finalGameState.players.forEach((p) => {
        if (p.id !== winnerId) {
          const handScore = Engine.calculateScore(p.hand);
          roundScores[p.id] = handScore;
          totalPoints += handScore;
        } else {
          roundScores[p.id] = 0;
        }
      });

      // Update match state
      const newMatchState = { ...matchState };

      // Award points to winner
      if (matchState.mode === "solo") {
        newMatchState.cumulativeScores[winnerId] += totalPoints;
      } else if (matchState.mode === "teams") {
        // Sum points for winner's team
        const winner = finalGameState.players.find((p) => p.id === winnerId);
        const winningTeam = winner?.team;
        if (winningTeam) {
          finalGameState.players.forEach((p) => {
            if (p.team === winningTeam && p.id !== winnerId) {
              newMatchState.cumulativeScores[winnerId] += totalPoints;
            }
          });
        }
      }
      // Shared-hand mode: cooperative, all team members share score

      // Record round
      newMatchState.roundHistory.push({
        winner: winnerId,
        scores: roundScores,
        totalPoints,
      });

      // Check for match winner
      const winnerScore = newMatchState.cumulativeScores[winnerId];
      if (winnerScore >= newMatchState.targetScore) {
        newMatchState.status = "finished";
        newMatchState.winner = winnerId;

        // Save completed match to history
        MatchState.saveMatchHistory(newMatchState);

        // Finalize replay recording
        ReplayRecorder.finalize(matchState.roomId, winnerId, newMatchState);

        dbAdapter.saveMatch(newMatchState).catch((e) => {
          console.error("Failed to persist match result:", e);
        });
        // Clear game state for finished match (keep match record)
        MatchState.saveGame(matchState.roomId, null);
      } else {
        // Start next round
        newMatchState.currentRound++;
      }

      setMatchState(newMatchState);
      MatchState.save(matchState.roomId, newMatchState);
    },
    [matchState],
  );

  // Start next round (after hand ends)
  const startNextRound = useCallback(() => {
    // Keep same players and rules, reset game state
    const roomConfig = {
      roomId: matchState.roomId,
      players: initialRoomConfig.players.map((p, i) => ({
        id: p.id || `p${i}`,
        name: p.name,
        avatar: p.avatar,
        team: p.team || "A",
        score: 0,
        isBot: p.isBot || false,
        difficulty: p.difficulty || "normal",
      })),
      rules: gameState.rules,
      targetScore: matchState.targetScore,
      mode: matchState.mode,
    };

    const newGame = Engine.initGame(roomConfig);

    // Preserve match scores
    const gameWithScores = {
      ...newGame,
      scores: matchState.cumulativeScores,
      round: matchState.currentRound,
    };
    setGameState(gameWithScores);

    // Save new round state
    MatchState.saveGame(matchState.roomId, gameWithScores);
  }, [gameState, matchState]);

  // Get current player
  const currentPlayer = gameState?.players?.[gameState.currentPlayerIndex];

  // Check if it's a specific player's turn
  const isPlayerTurn = useCallback(
    (playerId) => {
      return currentPlayer?.id === playerId;
    },
    [currentPlayer],
  );

  // Get playable cards for a player
  const getPlayableCards = useCallback(
    (playerId) => {
      if (!gameState) return [];
      const player = gameState.players.find((p) => p.id === playerId);
      if (!player) return [];

      const topCard = gameState.topCard;
      const currentColor = gameState.currentColor || topCard?.color;
      const pendingDraw = Number(gameState.pendingDraw || 0);
      const stackingEnabled = Boolean(gameState.rules?.stack);

      if (pendingDraw > 0) {
        return stackingEnabled
          ? player.hand.filter(
              (card) => card?.value === "draw2" || card?.value === "wild4",
            )
          : [];
      }

      return player.hand.filter((card) =>
        Engine.canPlay(card, topCard, currentColor, gameState.rules),
      );
    },
    [gameState],
  );

  // Check if player can jump in
  const canJumpIn = useCallback(
    (playerId, cardId) => {
      if (!gameState) return { canJump: false };
      return Engine.canJumpIn(gameState, playerId, cardId);
    },
    [gameState],
  );

  // Jump in - play out of turn
  const jumpIn = useCallback(
    async (playerId, cardId, chosenColor = null) => {
      if (!gameState) return { success: false, error: "No active game" };
      const result = Engine.jumpIn(gameState, playerId, cardId, chosenColor);

      if (result.success) {
        setGameState(result.gameState);
        MatchState.saveGame(
          result.gameState.roomId || result.gameState.gameId,
          result.gameState,
        );
        if (result.isWinner) {
          handleHandEnd(result.gameState, playerId);
        }
      }
      return result;
    },
    [gameState],
  );

  // Challenge a wild4
  const challengeWild4 = useCallback(
    async (challengerId, targetId) => {
      if (!gameState) return { success: false, error: "No active game" };
      const result = Engine.challengeWild4(gameState, challengerId, targetId);

      if (result.success) {
        setGameState(result.gameState);
        MatchState.saveGame(
          result.gameState.roomId || result.gameState.gameId,
          result.gameState,
        );
      }
      return result;
    },
    [gameState],
  );

  // Get turn time limit in seconds
  const getTurnTimeLimit = useCallback(() => {
    if (!gameState) return null;
    const rules = gameState.rules || {};
    return rules.turnTimer || 30; // Default 30 seconds
  }, [gameState]);

  // Multiplayer sync integration
  const isBackendRoom =
    dbAdapter.backendEnabled() && Boolean(initialRoomConfig?.roomId);
  const isRealtimeMultiplayer =
    !isBackendRoom &&
    (initialRoomConfig?.multiplayer === true ||
      initialRoomConfig?.networkMode === "online" ||
      initialRoomConfig?.mode === "online");
  const isHost = initialRoomConfig?.isHost ?? !isRealtimeMultiplayer;

  // Initialize sync adapter
  useEffect(() => {
    if (isRealtimeMultiplayer && initialRoomConfig?.roomId) {
      SyncAdapter.init(initialRoomConfig.roomId, isHost, "me").then(() => {
        // Setup sync callbacks
        if (isHost) {
          // Host receives moves from clients
          SyncAdapter.onRemoteMove = (playerId, move) => {
            if (move.type === "play") {
              playCard(playerId, move.cardId, move.chosenColor);
            } else if (move.type === "draw") {
              drawCard(playerId);
            } else if (move.type === "jump") {
              jumpIn(playerId, move.cardId, move.chosenColor);
            }
          };

          SyncAdapter.onChallenge = (challengerId, targetId) => {
            challengeWild4(challengerId, targetId);
          };

          SyncAdapter.onJumpIn = (playerId, cardId, chosenColor) => {
            jumpIn(playerId, cardId, chosenColor);
          };

          // Host broadcasts state changes
          const broadcastInterval = setInterval(() => {
            if (gameState && matchState) {
              SyncAdapter.broadcastState(gameState, matchState);
            }
          }, 500);

          return () => clearInterval(broadcastInterval);
        } else {
          // Client receives state updates from host
          SyncAdapter.onStateUpdate = (state) => {
            setGameState(state.gameState);
            setMatchState(state.matchState);
          };

          // Request initial sync
          SyncAdapter.requestSync();
        }
      });

      return () => {
        SyncAdapter.disconnect();
      };
    }
  }, [isRealtimeMultiplayer, initialRoomConfig?.roomId, isHost]);

  // Backend room polling for online state synchronization.
  useEffect(() => {
    if (!isBackendRoom || !initialRoomConfig?.roomId) return;
    setSyncMeta((prev) => ({ ...prev, source: "backend" }));

    let cancelled = false;
    const poll = async () => {
      try {
        const remoteState = await dbAdapter.getRoomState(initialRoomConfig.roomId);
        if (cancelled || !remoteState) return;
        const localState = gameStateRef.current;
        if (
          !localState ||
          JSON.stringify(remoteState) !== JSON.stringify(localState)
        ) {
          setGameState(remoteState);
          MatchState.saveGame(
            remoteState.roomId || initialRoomConfig.roomId,
            remoteState,
          );
        }
        setSyncMeta((prev) => ({
          ...prev,
          source: "backend",
          lastRemoteSyncAt: Date.now(),
          lastError: null,
        }));
      } catch (e) {
        console.warn("Backend sync poll failed:", e?.message || e);
        setSyncMeta((prev) => ({
          ...prev,
          source: "backend",
          lastError: e?.message || "sync_failed",
        }));
      }
    };

    const interval = setInterval(poll, 1500);
    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isBackendRoom, initialRoomConfig?.roomId]);

  // Initialize on mount if config provided
  useEffect(() => {
    if (initialRoomConfig && !gameState) {
      initGame(initialRoomConfig);
    }
    setIsLoading(false);
  }, [initialRoomConfig, initGame, gameState]);

  // AI Bot takeover effect - handles disconnected/AFK players
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing") return;

    // Only host or local game manages bots
    const isHostOrLocal = isHost || !isRealtimeMultiplayer;
    if (!isHostOrLocal) return;

    const botCheckInterval = setInterval(async () => {
      const gs = gameStateRef.current;
      if (!gs || gs.phase !== "playing") return;

      // Check for inactive players to take over
      for (const player of gs.players) {
        if (player.id === "me") continue; // Don't bot the local player
        if (player.isBot) continue; // Already a bot

        const isInactive = BotAdapter.shouldTakeOver(
          gs,
          player.id,
          15000,
        ); // 15s timeout for demo
        if (isInactive) {
          // Mark as bot
          const newState = BotAdapter.markAsBot(gs, player.id);
          setGameState(newState);
          MatchState.saveGame(matchState?.roomId, newState);
          console.log(`Bot takeover: ${player.name}`);
        }
      }

      // Execute bot moves
      const botDecisions = await BotAdapter.checkAndAct(gameStateRef.current, {
        playCard: async (playerId, cardId, chosenColor) => {
          const result = await playCard(playerId, cardId, chosenColor);
          return result.success;
        },
        drawCard: async (playerId) => {
          const result = await drawCard(playerId);
          return result.success;
        },
      });

      // Execute decisions
      for (const decision of botDecisions) {
        if (decision.action === "play") {
          await playCard(
            decision.playerId,
            decision.cardId,
            decision.chosenColor,
          );
        } else if (decision.action === "draw") {
          await drawCard(decision.playerId);
        }
      }
    }, 2000);

    return () => clearInterval(botCheckInterval);
  }, [
    gameState,
    isHost,
    isRealtimeMultiplayer,
    playCard,
    drawCard,
    matchState?.roomId,
  ]);

  // Immediate bot turn effect - triggers when it's a bot's turn
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing") return;

    const isHostOrLocal = isHost || !isRealtimeMultiplayer;
    if (!isHostOrLocal) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer?.isBot) return;

    // Small delay for realism
    const timeout = setTimeout(async () => {
      const gs = gameStateRef.current;
      if (!gs || gs.phase !== "playing") return;
      const cp = gs.players[gs.currentPlayerIndex];
      if (!cp?.isBot || cp.id !== currentPlayer.id) return;

      const decision = await BotAdapter.takeTurn(gs, cp.id, {
        playCard: async (playerId, cardId, chosenColor) => {
          const result = await playCard(playerId, cardId, chosenColor);
          return result.success;
        },
        drawCard: async (playerId) => {
          const result = await drawCard(playerId);
          return result.success;
        },
      });

      if (decision) {
        if (decision.action === "play") {
          await playCard(
            decision.playerId,
            decision.cardId,
            decision.chosenColor,
          );
        } else if (decision.action === "draw") {
          await drawCard(decision.playerId);
        }
      }
    }, BotAdapter.config.reactionDelay);

    return () => clearTimeout(timeout);
  }, [
    gameState?.currentPlayerIndex,
    gameState?.phase,
    gameState?.players,
    isHost,
    isRealtimeMultiplayer,
    playCard,
    drawCard,
  ]);

  // Mark local player activity on any interaction
  const markActivity = useCallback(() => {
    if (!gameState) return;
    const playerIndex = gameState.players.findIndex((p) => p.id === "me");
    if (playerIndex === -1) return;

    const player = gameState.players[playerIndex];
    if (player.isBot) {
      // Human returned! Restore control
      const newState = BotAdapter.markAsHuman(gameState, "me");
      setGameState(newState);
    } else {
      // Just update activity timestamp
      const newState = {
        ...gameState,
        players: gameState.players.map((p, i) =>
          i === playerIndex ? { ...p, lastActivity: Date.now() } : p,
        ),
      };
      setGameState(newState);
    }
  }, [gameState]);

  // Send chat message
  const sendChat = useCallback(
    (text) => {
      if (!gameState) return;
      const player = gameState.players.find((p) => p.id === "me");
      const senderName = player?.name || "You";

      // Add locally
      const message = {
        id: `chat-${Date.now()}`,
        senderId: "me",
        senderName,
        text,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, message]);

      // Send to peers if multiplayer
      if (isRealtimeMultiplayer && SyncAdapter.isConnected) {
        SyncAdapter.sendChat("me", senderName, text);
      }
    },
    [gameState, isRealtimeMultiplayer],
  );

  const value = {
    gameState,
    matchState,
    isLoading,
    currentPlayer,
    chatMessages,
    initGame,
    playCard,
    drawCard,
    startNextRound,
    isPlayerTurn,
    getPlayableCards,
    canJumpIn,
    jumpIn,
    challengeWild4,
    getTurnTimeLimit,
    markActivity,
    sendChat,
    syncMeta,
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

// Match State Persistence (localStorage)
const MatchState = {
  key(roomId) {
    return `match:${roomId}`;
  },

  gameKey(roomId) {
    return `game:${roomId}`;
  },

  historyKey() {
    return "shout:matchHistory";
  },

  load(roomId) {
    try {
      const saved = localStorage.getItem(this.key(roomId));
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to load match state:", e);
      return null;
    }
  },

  loadGame(roomId) {
    try {
      const saved = localStorage.getItem(this.gameKey(roomId));
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to load game state:", e);
      return null;
    }
  },

  save(roomId, state) {
    try {
      localStorage.setItem(this.key(roomId), JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save match state:", e);
    }
  },

  saveGame(roomId, gameState) {
    try {
      if (gameState === null) {
        localStorage.removeItem(this.gameKey(roomId));
      } else {
        localStorage.setItem(this.gameKey(roomId), JSON.stringify(gameState));
      }
    } catch (e) {
      console.error("Failed to save game state:", e);
    }
  },

  clear(roomId) {
    try {
      localStorage.removeItem(this.key(roomId));
      localStorage.removeItem(this.gameKey(roomId));
    } catch (e) {
      console.error("Failed to clear match state:", e);
    }
  },

  listActive() {
    try {
      const matches = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("match:")) {
          const roomId = key.replace("match:", "");
          const match = this.load(roomId);
          if (match && match.status !== "finished") {
            matches.push({ roomId, ...match });
          }
        }
      }
      return matches;
    } catch (e) {
      return [];
    }
  },

  // Save completed match to history
  saveMatchHistory(matchState) {
    try {
      const history = this.getMatchHistory();
      const entry = {
        roomId: matchState.roomId,
        endedAt: new Date().toISOString(),
        winner: matchState.winner,
        players: matchState.players,
        mode: matchState.mode,
        targetScore: matchState.targetScore,
        cumulativeScores: matchState.cumulativeScores,
        roundHistory: matchState.roundHistory,
        rounds: matchState.currentRound,
      };
      history.unshift(entry); // Add to beginning (most recent first)
      // Keep only last 50 matches
      if (history.length > 50) {
        history.length = 50;
      }
      localStorage.setItem(this.historyKey(), JSON.stringify(history));

      // Also update player stats
      this.updatePlayerStats(entry);

      return true;
    } catch (e) {
      console.error("Failed to save match history:", e);
      return false;
    }
  },

  // Get all completed matches
  getMatchHistory() {
    try {
      const saved = localStorage.getItem(this.historyKey());
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load match history:", e);
      return [];
    }
  },

  // Clear match history
  clearMatchHistory() {
    try {
      localStorage.removeItem(this.historyKey());
      localStorage.removeItem("shout:playerStats");
      return true;
    } catch (e) {
      return false;
    }
  },

  // Update player stats from match history
  updatePlayerStats(matchEntry) {
    try {
      const statsKey = "shout:playerStats";
      const saved = localStorage.getItem(statsKey);
      const stats = saved
        ? JSON.parse(saved)
        : { games: 0, wins: 0, points: 0, streak: 0, bestStreak: 0 };

      stats.games++;
      const isWinner = matchEntry.winner === "me";
      if (isWinner) {
        stats.wins++;
        stats.streak++;
        if (stats.streak > stats.bestStreak) {
          stats.bestStreak = stats.streak;
        }
      } else {
        stats.streak = 0;
      }

      // Add points from this match
      const myPoints = matchEntry.cumulativeScores?.["me"] || 0;
      stats.points += myPoints;

      localStorage.setItem(statsKey, JSON.stringify(stats));
      return stats;
    } catch (e) {
      console.error("Failed to update stats:", e);
      return null;
    }
  },

  // Get player stats
  getPlayerStats() {
    try {
      const saved = localStorage.getItem("shout:playerStats");
      return saved
        ? JSON.parse(saved)
        : { games: 0, wins: 0, points: 0, streak: 0, bestStreak: 0 };
    } catch (e) {
      return { games: 0, wins: 0, points: 0, streak: 0, bestStreak: 0 };
    }
  },
};

// Export to window for global access
if (typeof window !== "undefined") {
  window.GameStateContext = GameStateContext;
  window.useGame = useGame;
  window.GameProvider = GameProvider;
  window.MatchState = MatchState;
}
