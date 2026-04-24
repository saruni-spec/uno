import { Engine, type Card, type GameState, type RulesState } from "../engine";

type Difficulty = "easy" | "normal" | "hard";
type WildChoice = "red" | "blue" | "green" | "yellow";

export const BotAdapter = {
  config: {
    reactionDelay: 1500,
    wildColorPreference: ["red", "blue", "green", "yellow"] as const,
  },

  async takeTurn(gameState: GameState, playerId: string) {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player || !player.isBot) return null;

    const difficulty: Difficulty = player.difficulty || "normal";
    const delayMs = difficulty === "easy" ? 2000 : difficulty === "hard" ? 1000 : 1500;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const topCard = gameState.topCard;
    const currentColor = gameState.currentColor || topCard.color;
    const rules = gameState.rules || {};
    const pendingDraw = Number(gameState.pendingDraw || 0);
    const stackingEnabled = Boolean(rules.stack);

    const playableCards =
      pendingDraw > 0
        ? stackingEnabled
          ? player.hand.filter((card) => card.value === "draw2" || card.value === "wild4")
          : []
        : player.hand.filter((card) => Engine.canPlay(card, topCard, currentColor, rules));

    if (playableCards.length === 0) return { action: "draw" as const, playerId };

    const chosenCard = this.chooseCard(playableCards, player.hand, currentColor, rules, difficulty);
    const chosenColor =
      chosenCard.color === "wild" ? this.chooseWildColor(player.hand) : null;

    return {
      action: "play" as const,
      playerId,
      cardId: chosenCard.id,
      chosenColor,
    };
  },

  chooseCard(
    playableCards: Card[],
    fullHand: Card[],
    currentColor: string,
    _rules: RulesState,
    difficulty: Difficulty,
  ) {
    const priority = (card: Card) => {
      let score = 0;
      if (difficulty === "easy") {
        score = Math.random() * 10;
        if (/^\d+$/.test(card.value)) score += 2;
        return score;
      }
      if (["skip", "reverse", "draw2"].includes(card.value)) score += difficulty === "hard" ? 20 : 10;
      if (card.value === "wild4") score += 15;
      else if (card.value === "wild") score += 5;
      if (card.color === currentColor && card.color !== "wild") score += 3;
      score += Engine.calculateScore([card]) * 0.1;
      if (fullHand.length <= 3 && /^\d+$/.test(card.value)) score += 2;
      return score;
    };

    return playableCards
      .map((card) => ({ card, score: priority(card) }))
      .sort((a, b) => b.score - a.score)[0].card;
  },

  chooseWildColor(hand: Card[]) {
    const counts: Record<string, number> = {};
    for (const card of hand) {
      if (card.color !== "wild") counts[card.color] = (counts[card.color] || 0) + 1;
    }
    let best: WildChoice = this.config.wildColorPreference[0];
    let max = 0;
    for (const [color, count] of Object.entries(counts)) {
      if (count > max) {
        max = count;
        best = color as WildChoice;
      }
    }
    return best;
  },
};
