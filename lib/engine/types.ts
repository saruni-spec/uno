export type Color = "red" | "yellow" | "green" | "blue" | "wild";
export type Direction = "cw" | "ccw";
export type GamePhase = "playing" | "finished";
export type GameMode = "solo" | "teams" | "shared-hand";

export type CardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export interface Card {
  id: string;
  color: Color;
  value: CardValue;
  customId?: string;
  customName?: string;
  customEmoji?: string;
}

export interface PlayerState {
  id: string;
  name: string;
  av?: string;
  bg?: string;
  team?: string | null;
  hand: Card[];
  cardCount?: number;
  isBot?: boolean;
  difficulty?: "easy" | "normal" | "hard";
}

export interface RulesState {
  stack?: boolean;
  sevenZero?: boolean;
  jumpIn?: boolean;
  challenge?: boolean;
  drawPlay?: boolean;
  noSpecialFinish?: boolean;
  turnTimer?: number;
  [key: string]: boolean | number | undefined;
}

export interface GameState {
  gameId: string;
  roomId: string;
  phase: GamePhase;
  direction: Direction;
  currentPlayerIndex: number;
  currentColor: Color | "red" | "yellow" | "green" | "blue";
  topCard: Card;
  deck: Card[];
  discardPile: Card[];
  players: PlayerState[];
  rules: RulesState;
  mode: GameMode;
  scores: Record<string, number>;
  round: number;
  winner: string | null;
  pendingDraw?: number;
  pendingSwap?: boolean;
}

export interface InitGameConfig {
  roomId: string;
  players: Omit<PlayerState, "hand">[];
  rules?: RulesState;
  targetScore?: number;
  handSize?: number;
  customCards?: Array<{
    id?: string;
    name?: string;
    emoji?: string;
    color?: Color;
  }>;
  mode?: GameMode;
}
