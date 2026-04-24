// Game Engine — Pure functions, no React, no side effects
// Phase 1: Local gameplay engine

const COLORS = ["red", "yellow", "green", "blue"];
const NUMBERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTIONS = ["skip", "reverse", "draw2"];
const WILDS = ["wild", "wild4"];

// Card point values for scoring
const CARD_POINTS = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  skip: 20,
  reverse: 20,
  draw2: 20,
  wild: 50,
  wild4: 50,
};

// Generate unique card ID
let cardIdCounter = 0;
function generateCardId() {
  return `c-${Date.now()}-${cardIdCounter++}`;
}

const Engine = {
  // Create a standard UNO deck (108 cards)
  createDeck(customCards = []) {
    const deck = [];

    // Number cards (0-9, two of each 1-9, one 0 per color)
    COLORS.forEach((color) => {
      // One 0 per color
      deck.push({ id: generateCardId(), color, value: "0" });

      // Two of each 1-9
      NUMBERS.slice(1).forEach((num) => {
        deck.push({ id: generateCardId(), color, value: num });
        deck.push({ id: generateCardId(), color, value: num });
      });

      // Two of each action per color
      ACTIONS.forEach((action) => {
        deck.push({ id: generateCardId(), color, value: action });
        deck.push({ id: generateCardId(), color, value: action });
      });
    });

    // Four wilds and four wild4s
    for (let i = 0; i < 4; i++) {
      deck.push({ id: generateCardId(), color: "wild", value: "wild" });
      deck.push({ id: generateCardId(), color: "wild", value: "wild4" });
    }

    // Add custom cards as wilds (flavor-only for now)
    customCards.forEach((custom) => {
      deck.push({
        id: generateCardId(),
        color: custom.color || "wild",
        value: "wild",
        customId: custom.id,
        customName: custom.name,
        customEmoji: custom.emoji,
      });
    });

    return deck;
  },

  // Fisher-Yates shuffle
  shuffle(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // Deal cards to players
  deal(deck, playerCount, handSize = 7) {
    const hands = Array.from({ length: playerCount }, () => []);
    const deckCopy = [...deck];

    for (let i = 0; i < handSize; i++) {
      for (let p = 0; p < playerCount; p++) {
        if (deckCopy.length > 0) {
          hands[p].push(deckCopy.shift());
        }
      }
    }

    return { hands, remainingDeck: deckCopy };
  },

  // Check if a card can be played on top of another
  canPlay(card, topCard, currentColor, rules = {}) {
    if (!card || !topCard) return false;

    // Wild cards can always be played
    if (card.color === "wild") return true;

    // Must match color or value
    const matchesColor = card.color === currentColor;
    const matchesValue = card.value === topCard.value;

    return matchesColor || matchesValue;
  },

  // Get next player index based on direction
  nextPlayerIndex(currentIndex, playerCount, direction) {
    if (direction === "cw") {
      return (currentIndex + 1) % playerCount;
    } else {
      return (currentIndex - 1 + playerCount) % playerCount;
    }
  },

  // Apply card effect and return updated game state
  applyCardEffect(gameState, playedCard) {
    const newState = { ...gameState };
    const rules = gameState.rules || {};

    switch (playedCard.value) {
      case "skip":
        // Skip next player
        newState.currentPlayerIndex = this.nextPlayerIndex(
          newState.currentPlayerIndex,
          newState.players.length,
          newState.direction,
        );
        break;

      case "reverse":
        // Reverse direction
        newState.direction = newState.direction === "cw" ? "ccw" : "cw";
        // In 2-player game, reverse acts like skip
        if (newState.players.length === 2) {
          newState.currentPlayerIndex = this.nextPlayerIndex(
            newState.currentPlayerIndex,
            newState.players.length,
            newState.direction,
          );
        }
        break;

      case "draw2":
        // Next player draws 2 (handle stacking in playCard)
        newState.pendingDraw = (newState.pendingDraw || 0) + 2;
        break;

      case "wild4":
        // Next player draws 4 (handle stacking in playCard)
        newState.pendingDraw = (newState.pendingDraw || 0) + 4;
        break;

      case "wild":
      case "wild4":
        // Wild color change handled by caller (needs player input)
        break;

      case "7":
        // 7-0 swap rule
        if (rules.sevenZero) {
          // Mark for swap action (handled by UI)
          newState.pendingSwap = true;
        }
        break;

      case "0":
        // 7-0 rotate rule
        if (rules.sevenZero) {
          // Rotate all hands
          const hands = newState.players.map((p) => [...p.hand]);
          if (newState.direction === "cw") {
            // Rotate forward
            const last = hands.pop();
            hands.unshift(last);
          } else {
            // Rotate backward
            const first = hands.shift();
            hands.push(first);
          }
          newState.players = newState.players.map((p, i) => ({
            ...p,
            hand: hands[i],
          }));
        }
        break;
    }

    return newState;
  },

  // Play a card from player's hand
  playCard(gameState, playerId, cardId, chosenColor = null) {
    const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1)
      return { success: false, error: "Player not found" };

    // Check it's this player's turn
    if (gameState.currentPlayerIndex !== playerIndex) {
      return { success: false, error: "Not your turn" };
    }

    const player = gameState.players[playerIndex];
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return { success: false, error: "Card not in hand" };

    const card = player.hand[cardIndex];
    const topCard = gameState.topCard;
    const currentColor = gameState.currentColor || topCard.color;
    const rules = gameState.rules || {};

    // If a draw penalty is pending, player can only stack draw cards.
    if ((gameState.pendingDraw || 0) > 0) {
      const isStackCard = card.value === "draw2" || card.value === "wild4";
      const canStack = rules.stack && isStackCard;
      if (!canStack) {
        return {
          success: false,
          error: "A draw penalty is pending. Play +2/+4 or draw cards.",
        };
      }
    }

    // Check if card is playable
    if (!this.canPlay(card, topCard, currentColor, gameState.rules)) {
      return { success: false, error: "Card cannot be played" };
    }

    // Create new state
    let newState = { ...gameState };

    // Remove card from hand
    newState.players = newState.players.map((p, i) => {
      if (i !== playerIndex) return p;
      return {
        ...p,
        hand: p.hand.filter((c) => c.id !== cardId),
      };
    });

    // Add to discard pile
    newState.discardPile = [...newState.discardPile, topCard];
    newState.topCard = card;

    // Handle wild color selection
    if (card.color === "wild" && chosenColor) {
      newState.currentColor = chosenColor;
    } else if (card.color !== "wild") {
      newState.currentColor = card.color;
    }

    // Apply card effects
    newState = this.applyCardEffect(newState, card);

    // Check for winner (before moving to next player if possible)
    const winnerCheck = this.checkWinner(newState, playerId);
    if (winnerCheck.isWinner) {
      newState.phase = "finished";
      newState.winner = playerId;
      return { success: true, gameState: newState, isWinner: true };
    }

    // Move to next player
    newState.currentPlayerIndex = this.nextPlayerIndex(
      newState.currentPlayerIndex,
      newState.players.length,
      newState.direction,
    );

    // Handle pending draw (stack attack or simple draw)
    if (newState.pendingDraw && newState.pendingDraw > 0) {
      const nextPlayer = newState.players[newState.currentPlayerIndex];
      const canStack =
        gameState.rules.stack &&
        nextPlayer.hand.some((c) => c.value === "draw2" || c.value === "wild4");

      if (!canStack) {
        // Apply the draw
        const { drawnCards, newDeck } = this.drawMultiple(
          newState.deck,
          newState.pendingDraw,
        );
        newState.deck = newDeck;
        newState.players = newState.players.map((p, i) => {
          if (i !== newState.currentPlayerIndex) return p;
          return { ...p, hand: [...p.hand, ...drawnCards] };
        });
        delete newState.pendingDraw;

        // Skip the drawing player (draw2/wild4 means lose turn)
        newState.currentPlayerIndex = this.nextPlayerIndex(
          newState.currentPlayerIndex,
          newState.players.length,
          newState.direction,
        );
      }
    }

    return { success: true, gameState: newState };
  },

  // Draw multiple cards from deck
  drawMultiple(deck, count) {
    const drawn = deck.slice(0, count);
    const newDeck = deck.slice(count);

    // If deck runs low, we should reshuffle discard (simplified here)
    // For now, just return what we have
    return { drawnCards: drawn, newDeck };
  },

  // Draw a single card
  drawCard(gameState, playerId, autoContinue = false) {
    const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1)
      return { success: false, error: "Player not found" };

    if (gameState.currentPlayerIndex !== playerIndex) {
      return { success: false, error: "Not your turn" };
    }

    const rules = gameState.rules || {};

    // If a draw penalty is pending, drawing means taking the full penalty
    // and losing the turn (unless auto-continue flow is explicitly used).
    if ((gameState.pendingDraw || 0) > 0 && !autoContinue) {
      const penalty = gameState.pendingDraw;
      const { drawnCards, newDeck } = this.drawMultiple(gameState.deck, penalty);
      let newState = {
        ...gameState,
        deck: newDeck,
        players: gameState.players.map((p, i) => {
          if (i !== playerIndex) return p;
          return { ...p, hand: [...p.hand, ...drawnCards] };
        }),
      };
      delete newState.pendingDraw;
      newState.currentPlayerIndex = this.nextPlayerIndex(
        newState.currentPlayerIndex,
        newState.players.length,
        newState.direction,
      );
      return {
        success: true,
        gameState: newState,
        drewPenalty: true,
        drawnCount: drawnCards.length,
        canPlay: false,
      };
    }

    if (gameState.deck.length === 0) {
      // Reshuffle discard pile (except top card)
      if (gameState.discardPile.length <= 1) {
        return { success: false, error: "No cards to draw" };
      }
      const newDeck = this.shuffle(gameState.discardPile.slice(0, -1));
      gameState = {
        ...gameState,
        deck: newDeck,
        discardPile: [gameState.discardPile[gameState.discardPile.length - 1]],
      };
    }

    const card = gameState.deck[0];
    const newDeck = gameState.deck.slice(1);

    let newState = {
      ...gameState,
      deck: newDeck,
      players: gameState.players.map((p, i) => {
        if (i !== playerIndex) return p;
        return { ...p, hand: [...p.hand, card] };
      }),
    };

    // Check if drawn card is playable
    const topCard = newState.topCard;
    const currentColor = newState.currentColor || topCard.color;
    const canPlay = this.canPlay(card, topCard, currentColor, newState.rules);

    // drawPlay rule: must keep drawing until playable
    if (rules.drawPlay && !canPlay && !autoContinue) {
      // Continue drawing (UI will handle animation, this is engine ready)
      return {
        success: true,
        gameState: newState,
        drawnCard: card,
        canPlay: false,
        mustDrawAgain: true,
      };
    }

    // Standard draw behavior (drawPlay OFF):
    // if the drawn card is not playable, turn passes immediately.
    if (!rules.drawPlay && !canPlay) {
      newState.currentPlayerIndex = this.nextPlayerIndex(
        newState.currentPlayerIndex,
        newState.players.length,
        newState.direction,
      );
    }

    return { success: true, gameState: newState, drawnCard: card, canPlay };
  },

  // Check if player has won the hand
  checkWinner(gameState, playerId) {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) return { isWinner: false };

    // Must have empty hand to win
    if (player.hand.length > 0) return { isWinner: false };

    // Check noSpecialFinish rule
    if (gameState.rules.noSpecialFinish) {
      const lastCard = gameState.topCard;
      const isActionCard = [
        "skip",
        "reverse",
        "draw2",
        "wild",
        "wild4",
      ].includes(lastCard.value);
      if (isActionCard) {
        return { isWinner: false, reason: "Cannot win on special card" };
      }
    }

    return { isWinner: true };
  },

  // Calculate score for a hand
  calculateScore(hand) {
    return hand.reduce((sum, card) => {
      return sum + (CARD_POINTS[card.value] || 0);
    }, 0);
  },

  // Validate if a wild4 play was legal (player has no cards of current color)
  validateWild4(gameState, playerId) {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) return { isLegal: false, reason: "Player not found" };

    const currentColor = gameState.currentColor || gameState.topCard.color;

    // Wild4 is legal if player has NO cards of the current color
    const hasColor = player.hand.some((c) => c.color === currentColor);

    return { isLegal: !hasColor, hasColor };
  },

  // Challenge a wild4 play - returns result with penalties applied
  challengeWild4(gameState, challengerId, targetId) {
    const validation = this.validateWild4(gameState, targetId);
    const rules = gameState.rules || {};

    // If challenge rule not enabled, reject
    if (!rules.challenge) {
      return { success: false, error: "Challenge rule not enabled" };
    }

    let newState = { ...gameState };
    const challenger = newState.players.find((p) => p.id === challengerId);
    const target = newState.players.find((p) => p.id === targetId);

    if (!challenger || !target) {
      return { success: false, error: "Invalid player" };
    }

    if (validation.isLegal) {
      // Challenge failed - challenger draws 2 + the 4 = 6 total
      const penalty = 6;
      const { drawnCards, newDeck } = this.drawMultiple(newState.deck, penalty);
      newState.deck = newDeck;

      const challengerIndex = newState.players.findIndex(
        (p) => p.id === challengerId,
      );
      newState.players = newState.players.map((p, i) => {
        if (i !== challengerIndex) return p;
        return { ...p, hand: [...p.hand, ...drawnCards] };
      });

      return {
        success: true,
        gameState: newState,
        challengeWon: false,
        message: "Challenge failed! Wild4 was legal. You draw 6 cards.",
      };
    } else {
      // Challenge succeeded - target draws 4 (the wild4 penalty) instead of next player
      const { drawnCards, newDeck } = this.drawMultiple(newState.deck, 4);
      newState.deck = newDeck;

      const targetIndex = newState.players.findIndex((p) => p.id === targetId);
      newState.players = newState.players.map((p, i) => {
        if (i !== targetIndex) return p;
        return { ...p, hand: [...p.hand, ...drawnCards] };
      });

      // Remove the pending draw since target already drew
      delete newState.pendingDraw;

      return {
        success: true,
        gameState: newState,
        challengeWon: true,
        message: "Challenge successful! Illegal Wild4. They draw 4.",
      };
    }
  },

  // Check if a player can jump in (play out of turn with identical card)
  canJumpIn(gameState, playerId, cardId) {
    const rules = gameState.rules || {};
    if (!rules.jumpIn)
      return { canJump: false, reason: "Jump-in rule not enabled" };

    // Can't jump in if it's your turn
    const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
    if (playerIndex === gameState.currentPlayerIndex) {
      return { canJump: false, reason: "It is your turn" };
    }

    const player = gameState.players[playerIndex];
    if (!player) return { canJump: false, reason: "Player not found" };

    const card = player.hand.find((c) => c.id === cardId);
    if (!card) return { canJump: false, reason: "Card not in hand" };

    const topCard = gameState.topCard;

    // Must be EXACT match (same color AND same value)
    const isExactMatch =
      card.color === topCard.color && card.value === topCard.value;

    if (!isExactMatch) {
      return {
        canJump: false,
        reason: "Must match both color and value exactly",
      };
    }

    return { canJump: true, card, player };
  },

  // Jump in - play a card out of turn
  jumpIn(gameState, playerId, cardId, chosenColor = null) {
    const check = this.canJumpIn(gameState, playerId, cardId);
    if (!check.canJump) {
      return { success: false, error: check.reason };
    }

    const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
    const card = check.card;

    // Create new state
    let newState = { ...gameState };

    // Remove card from hand
    newState.players = newState.players.map((p, i) => {
      if (i !== playerIndex) return p;
      return {
        ...p,
        hand: p.hand.filter((c) => c.id !== cardId),
      };
    });

    // Add to discard pile
    newState.discardPile = [...newState.discardPile, newState.topCard];
    newState.topCard = card;

    // Handle wild color selection
    if (card.color === "wild" && chosenColor) {
      newState.currentColor = chosenColor;
    } else if (card.color !== "wild") {
      newState.currentColor = card.color;
    }

    // Apply card effects
    newState = this.applyCardEffect(newState, card);

    // Jump-in player becomes the current player
    newState.currentPlayerIndex = playerIndex;

    // Check for winner
    const winnerCheck = this.checkWinner(newState, playerId);
    if (winnerCheck.isWinner) {
      newState.phase = "finished";
      newState.winner = playerId;
      return {
        success: true,
        gameState: newState,
        isWinner: true,
        jumpedIn: true,
      };
    }

    // Move to next player after the jumper
    newState.currentPlayerIndex = this.nextPlayerIndex(
      newState.currentPlayerIndex,
      newState.players.length,
      newState.direction,
    );

    // Handle pending draws
    if (newState.pendingDraw && newState.pendingDraw > 0) {
      const nextPlayer = newState.players[newState.currentPlayerIndex];
      const canStack =
        gameState.rules.stack &&
        nextPlayer.hand.some(
          (c) =>
            (c.value === "draw2" && newState.topCard.value === "draw2") ||
            (c.value === "wild4" && newState.topCard.value === "wild4"),
        );

      if (!canStack) {
        const { drawnCards, newDeck } = this.drawMultiple(
          newState.deck,
          newState.pendingDraw,
        );
        newState.deck = newDeck;
        newState.players = newState.players.map((p, i) => {
          if (i !== newState.currentPlayerIndex) return p;
          return { ...p, hand: [...p.hand, ...drawnCards] };
        });
        delete newState.pendingDraw;

        newState.currentPlayerIndex = this.nextPlayerIndex(
          newState.currentPlayerIndex,
          newState.players.length,
          newState.direction,
        );
      }
    }

    return { success: true, gameState: newState, jumpedIn: true };
  },

  // Initialize a new game
  initGame(roomConfig) {
    const {
      roomId,
      players,
      rules = {},
      targetScore = 500,
      handSize = 7,
      customCards = [],
      mode = "solo",
    } = roomConfig;

    // Create and shuffle deck
    const deck = this.shuffle(this.createDeck(customCards));

    // Deal cards
    const { hands, remainingDeck } = this.deal(deck, players.length, handSize);

    // Assign hands to players
    const playersWithHands = players.map((p, i) => ({
      ...p,
      hand: hands[i] || [],
      cardCount: hands[i]?.length || 0,
    }));

    // Flip top card (must be a number, not action or wild)
    let topCardIndex = 0;
    while (topCardIndex < remainingDeck.length) {
      const card = remainingDeck[topCardIndex];
      if (!["skip", "reverse", "draw2", "wild", "wild4"].includes(card.value)) {
        break;
      }
      topCardIndex++;
    }

    const topCard = remainingDeck[topCardIndex];
    const deckAfterFlip = [
      ...remainingDeck.slice(0, topCardIndex),
      ...remainingDeck.slice(topCardIndex + 1),
    ];

    return {
      gameId: `game-${Date.now()}`,
      roomId,
      phase: "playing",
      direction: "cw",
      currentPlayerIndex: 0,
      currentColor: topCard.color,
      topCard,
      deck: deckAfterFlip,
      discardPile: [],
      players: playersWithHands,
      rules,
      mode,
      scores: {}, // Populated by match state
      round: 1,
      winner: null,
      pendingDraw: 0,
    };
  },
};

// Export for use in browser
if (typeof window !== "undefined") {
  window.Engine = Engine;
}

// Export for potential Node.js testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = Engine;
}
