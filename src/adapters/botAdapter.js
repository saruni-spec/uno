// AI Bot Adapter
// Provides auto-play logic for disconnected or AFK players
// Uses simple heuristics: play if possible, draw if not, use wilds wisely

const BotAdapter = {
  // Bot configuration
  config: {
    reactionDelay: 1500, // ms before bot acts (simulates thinking)
    wildColorPreference: ["red", "blue", "green", "yellow"], // priority order
  },

  // Check if a player should be taken over by bot
  shouldTakeOver(gameState, playerId, disconnectTimeout = 30000) {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) return false;

    // Already a bot
    if (player.isBot) return false;

    // Check last activity timestamp
    const lastActivity = player.lastActivity || gameState.lastUpdateTime;
    const now = Date.now();
    const inactive = now - lastActivity > disconnectTimeout;

    // Take over if inactive and it's their turn
    const isTheirTurn =
      gameState.currentPlayerIndex ===
      gameState.players.findIndex((p) => p.id === playerId);

    return inactive && isTheirTurn;
  },

  // Mark a player as bot-controlled
  markAsBot(gameState, playerId) {
    return {
      ...gameState,
      players: gameState.players.map((p) =>
        p.id === playerId ? { ...p, isBot: true, botSince: Date.now() } : p,
      ),
    };
  },

  // Mark a player as reconnected (human returned)
  markAsHuman(gameState, playerId) {
    return {
      ...gameState,
      players: gameState.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              isBot: false,
              botSince: undefined,
              lastActivity: Date.now(),
            }
          : p,
      ),
    };
  },

  // Bot makes a decision for its turn
  async takeTurn(gameState, playerId, actions) {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player || !player.isBot) return null;

    // Get difficulty level (default to normal)
    const difficulty = player.difficulty || "normal";

    // Adjust reaction time based on difficulty
    const delayMs =
      difficulty === "easy" ? 2000 : difficulty === "hard" ? 1000 : 1500;
    await this.delay(delayMs);

    const topCard = gameState.topCard;
    const currentColor = gameState.currentColor || topCard?.color;
    const rules = gameState.rules || {};

    const pendingDraw = Number(gameState.pendingDraw || 0);
    const stackingEnabled = Boolean(rules.stack);

    // During draw penalties, only stack cards are legal (if stacking is enabled).
    // Otherwise bot must draw to resolve and pass turn.
    const playableCards =
      pendingDraw > 0
        ? stackingEnabled
          ? player.hand.filter(
              (card) => card?.value === "draw2" || card?.value === "wild4",
            )
          : []
        : player.hand.filter((card) =>
            Engine.canPlay(card, topCard, currentColor, rules),
          );

    if (playableCards.length === 0) {
      // Must draw
      return { action: "draw", playerId };
    }

    // Choose best card to play based on difficulty
    const chosenCard = this.chooseCard(
      playableCards,
      player.hand,
      currentColor,
      rules,
      difficulty,
    );

    // Determine color for wild cards based on difficulty
    let chosenColor = null;
    if (chosenCard.color === "wild") {
      if (difficulty === "easy") {
        // Random color for easy
        const colors = ["red", "blue", "green", "yellow"];
        chosenColor = colors[Math.floor(Math.random() * colors.length)];
      } else {
        chosenColor = this.chooseWildColor(player.hand, rules);
      }
    }

    return {
      action: "play",
      playerId,
      cardId: chosenCard.id,
      chosenColor,
    };
  },

  // Create a new AI player
  createAIPlayer(index, difficulty = "normal") {
    const names = {
      easy: ["Beginner Bot", "Novice AI", "Trainee"],
      normal: ["Player Bot", "Gamer AI", "Opponent"],
      hard: ["Pro Bot", "Expert AI", "Master"],
    };

    const avatars = ["🤖", "👾", "🎮", "🦾", "🧠"];
    const colors = ["#ff3c7a", "#3ddcc8", "#ffc93c", "#7b5cff", "#ff6b6b"];

    const nameList = names[difficulty] || names.normal;
    const name = `${nameList[index % nameList.length]} ${index + 1}`;

    return {
      id: `ai-${Date.now()}-${index}`,
      name,
      avatar: {
        emoji: avatars[index % avatars.length],
        color: colors[index % colors.length],
      },
      isBot: true,
      difficulty,
      bg: colors[index % colors.length],
    };
  },

  // Choose the best card to play from available options
  chooseCard(
    playableCards,
    fullHand,
    currentColor,
    rules,
    difficulty = "normal",
  ) {
    // Priority order for card selection based on difficulty
    const priority = (card) => {
      let score = 0;

      // Easy: Random with slight preference for valid plays
      if (difficulty === "easy") {
        score = Math.random() * 10;
        // Slight preference for numbered cards (easier to play)
        if (typeof card.value === "number") {
          score += 2;
        }
        return score;
      }

      // Hard: Optimal strategy with opponent tracking
      if (difficulty === "hard") {
        // Prefer action cards (skip, reverse, draw2) - disrupt opponents
        if (["skip", "reverse", "draw2"].includes(card.value)) {
          score += 20;
        }

        // Always save wild4 until necessary
        if (card.value === "wild4") {
          const safeCards = playableCards.filter((c) => c.value !== "wild4");
          if (safeCards.length > 0) {
            score -= 30; // Don't play wild4 if other options exist
          } else {
            score += 25; // Must play it
          }
        } else if (card.value === "wild") {
          const safeCards = playableCards.filter((c) => c.color !== "wild");
          if (safeCards.length > 0) {
            score -= 10; // Prefer colored cards
          } else {
            score += 10;
          }
        }

        // Change color to something opponents don't have
        if (card.color === "wild") {
          score += 5;
        }
      }

      // Normal (default): Balanced strategy
      // Prefer action cards (skip, reverse, draw2)
      if (["skip", "reverse", "draw2"].includes(card.value)) {
        score += 10;
      }

      // Prefer wild4 over regular wild (more powerful)
      if (card.value === "wild4") {
        score += 15;
      } else if (card.value === "wild") {
        score += 5;
      }

      // Prefer cards that match current color (keep color flowing)
      if (card.color === currentColor && card.color !== "wild") {
        score += 3;
      }

      // Prefer playing high-point cards (strategic for end-game)
      const points = Engine.CARD_POINTS?.[card.value] || 0;
      score += points * 0.1;

      // If we have few cards, prefer playing numbered cards (safer)
      if (fullHand.length <= 3 && typeof card.value === "number") {
        score += 2;
      }

      return score;
    };

    // Sort by priority and return best
    const sorted = playableCards
      .map((card) => ({ card, score: priority(card) }))
      .sort((a, b) => b.score - a.score);

    // Easy: Sometimes pick suboptimal cards (30% chance)
    if (difficulty === "easy" && sorted.length > 1 && Math.random() < 0.3) {
      return sorted[Math.floor(Math.random() * Math.min(2, sorted.length))]
        .card;
    }

    return sorted[0].card;
  },

  // Choose best color when playing wild
  chooseWildColor(hand, rules) {
    // Count colors in hand
    const colorCounts = {};
    for (const card of hand) {
      if (card.color && card.color !== "wild") {
        colorCounts[card.color] = (colorCounts[card.color] || 0) + 1;
      }
    }

    // Find color with most cards
    let bestColor = this.config.wildColorPreference[0];
    let maxCount = 0;

    for (const [color, count] of Object.entries(colorCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestColor = color;
      }
    }

    return bestColor;
  },

  // Utility: delay for simulation
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  // Get list of bot-controlled players
  getBotPlayers(gameState) {
    return gameState.players.filter((p) => p.isBot);
  },

  // Check if any bots need to act
  async checkAndAct(gameState, actions) {
    const botPlayers = this.getBotPlayers(gameState);
    const results = [];

    for (const bot of botPlayers) {
      const isTheirTurn =
        gameState.currentPlayerIndex ===
        gameState.players.findIndex((p) => p.id === bot.id);

      if (isTheirTurn && gameState.phase === "playing") {
        const decision = await this.takeTurn(gameState, bot.id, actions);
        if (decision) {
          results.push(decision);
        }
      }
    }

    return results;
  },
};

// Export for use
Object.assign(window, { BotAdapter });
