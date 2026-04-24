import type {
  Card,
  CardValue,
  Color,
  Direction,
  GameState,
  InitGameConfig,
  PlayerState,
  RulesState,
} from "./types";

const COLORS: Exclude<Color, "wild">[] = ["red", "yellow", "green", "blue"];
const NUMBERS: CardValue[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTIONS: CardValue[] = ["skip", "reverse", "draw2"];

export const CARD_POINTS: Record<string, number> = {
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

let cardIdCounter = 0;
function generateCardId(): string {
  return `c-${Date.now()}-${cardIdCounter++}`;
}

function asColor(color: Color): Color {
  return color;
}

export const Engine = {
  CARD_POINTS,

  createDeck(customCards: InitGameConfig["customCards"] = []): Card[] {
    const deck: Card[] = [];

    for (const color of COLORS) {
      deck.push({ id: generateCardId(), color, value: "0" });
      for (const num of NUMBERS.slice(1)) {
        deck.push({ id: generateCardId(), color, value: num });
        deck.push({ id: generateCardId(), color, value: num });
      }
      for (const action of ACTIONS) {
        deck.push({ id: generateCardId(), color, value: action });
        deck.push({ id: generateCardId(), color, value: action });
      }
    }

    for (let i = 0; i < 4; i += 1) {
      deck.push({ id: generateCardId(), color: "wild", value: "wild" });
      deck.push({ id: generateCardId(), color: "wild", value: "wild4" });
    }

    for (const custom of customCards) {
      deck.push({
        id: generateCardId(),
        color: asColor(custom.color || "wild"),
        value: "wild",
        customId: custom.id,
        customName: custom.name,
        customEmoji: custom.emoji,
      });
    }

    return deck;
  },

  shuffle<T>(deck: T[]): T[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  deal(deck: Card[], playerCount: number, handSize = 7) {
    const hands: Card[][] = Array.from({ length: playerCount }, () => []);
    const copy = [...deck];
    for (let i = 0; i < handSize; i += 1) {
      for (let p = 0; p < playerCount; p += 1) {
        if (copy.length) hands[p].push(copy.shift() as Card);
      }
    }
    return { hands, remainingDeck: copy };
  },

  canPlay(card: Card, topCard: Card, currentColor: string, _rules: RulesState = {}) {
    if (!card || !topCard) return false;
    if (card.color === "wild") return true;
    return card.color === currentColor || card.value === topCard.value;
  },

  nextPlayerIndex(currentIndex: number, playerCount: number, direction: Direction) {
    return direction === "cw"
      ? (currentIndex + 1) % playerCount
      : (currentIndex - 1 + playerCount) % playerCount;
  },

  applyCardEffect(gameState: GameState, playedCard: Card): GameState {
    const newState: GameState = { ...gameState };
    const rules = gameState.rules || {};

    switch (playedCard.value) {
      case "skip":
        newState.currentPlayerIndex = this.nextPlayerIndex(
          newState.currentPlayerIndex,
          newState.players.length,
          newState.direction,
        );
        break;
      case "reverse":
        newState.direction = newState.direction === "cw" ? "ccw" : "cw";
        if (newState.players.length === 2) {
          newState.currentPlayerIndex = this.nextPlayerIndex(
            newState.currentPlayerIndex,
            newState.players.length,
            newState.direction,
          );
        }
        break;
      case "draw2":
        newState.pendingDraw = (newState.pendingDraw || 0) + 2;
        break;
      case "wild4":
        newState.pendingDraw = (newState.pendingDraw || 0) + 4;
        break;
      case "wild":
        break;
      case "7":
        if (rules.sevenZero) newState.pendingSwap = true;
        break;
      case "0":
        if (rules.sevenZero) {
          const hands = newState.players.map((p) => [...p.hand]);
          if (newState.direction === "cw") {
            const last = hands.pop();
            if (last) hands.unshift(last);
          } else {
            const first = hands.shift();
            if (first) hands.push(first);
          }
          newState.players = newState.players.map((p, i) => ({ ...p, hand: hands[i] }));
        }
        break;
      default:
        break;
    }
    return newState;
  },

  drawMultiple(deck: Card[], count: number, discardPile: Card[] = []) {
    let workingDeck = [...deck];
    let workingDiscard = [...discardPile];
    const drawnCards: Card[] = [];

    while (drawnCards.length < count) {
      if (workingDeck.length === 0) {
        if (workingDiscard.length === 0) break;
        workingDeck = this.shuffle(workingDiscard);
        workingDiscard = [];
      }
      const next = workingDeck.shift();
      if (!next) break;
      drawnCards.push(next);
    }

    return {
      drawnCards,
      newDeck: workingDeck,
      newDiscardPile: workingDiscard,
      shortBy: Math.max(0, count - drawnCards.length),
    };
  },

  calculateScore(hand: Card[]) {
    return hand.reduce((sum, card) => sum + (CARD_POINTS[card.value] || 0), 0);
  },

  checkWinner(gameState: GameState, playerId: string) {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) return { isWinner: false };
    if (player.hand.length > 0) return { isWinner: false };
    if (gameState.rules.noSpecialFinish) {
      const last = gameState.topCard.value;
      if (["skip", "reverse", "draw2", "wild", "wild4"].includes(last)) {
        return { isWinner: false, reason: "Cannot win on special card" };
      }
    }
    return { isWinner: true };
  },

  initGame(roomConfig: InitGameConfig): GameState {
    const {
      roomId,
      players,
      rules = {},
      handSize = 7,
      customCards = [],
      mode = "solo",
    } = roomConfig;
    const deck = this.shuffle(this.createDeck(customCards));
    const { hands, remainingDeck } = this.deal(deck, players.length, handSize);
    const playersWithHands: PlayerState[] = players.map((p, i) => ({
      ...p,
      hand: hands[i] || [],
      cardCount: hands[i]?.length || 0,
    }));

    let topCardIndex = 0;
    while (topCardIndex < remainingDeck.length) {
      const card = remainingDeck[topCardIndex];
      if (!["skip", "reverse", "draw2", "wild", "wild4"].includes(card.value)) break;
      topCardIndex += 1;
    }
    const safeTopIndex = topCardIndex < remainingDeck.length ? topCardIndex : 0;
    const topCard = remainingDeck[safeTopIndex];
    if (!topCard) throw new Error("Failed to initialize game: deck is empty after dealing");
    const deckAfterFlip = [
      ...remainingDeck.slice(0, safeTopIndex),
      ...remainingDeck.slice(safeTopIndex + 1),
    ];

    return {
      gameId: `game-${Date.now()}`,
      roomId,
      phase: "playing",
      direction: "cw",
      currentPlayerIndex: 0,
      currentColor: topCard.color === "wild" ? "red" : topCard.color,
      topCard,
      deck: deckAfterFlip,
      discardPile: [],
      players: playersWithHands,
      rules,
      mode,
      scores: {},
      round: 1,
      winner: null,
      pendingDraw: 0,
    };
  },
};

export type { Card, GameState, InitGameConfig, PlayerState, RulesState };
