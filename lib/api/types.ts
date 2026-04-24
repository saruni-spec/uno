export interface SessionUser {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  token?: string;
}

export interface RoomRule {
  id: string;
  on: boolean;
}

export interface RoomSummary {
  id: string;
  code?: string;
  name: string;
  icon?: string;
  felt?: string;
  mode?: string;
  status?: "waiting" | "playing" | string;
  maxPlayers?: number;
  playerCount?: number;
  host?: string;
  hostAvatar?: string;
  activeRules?: number;
  players?: Array<{
    id?: string;
    name?: string;
    av?: string;
    bg?: string;
    team?: string | null;
    is_ready?: boolean;
    is_host?: boolean;
  }>;
  rules?: RoomRule[];
  multiplayer?: boolean;
  networkMode?: string;
  isHost?: boolean;
}

export interface AuthSessionResponse {
  user: SessionUser;
}

export interface RoomsResponse {
  rooms: RoomSummary[];
}

export interface RoomResponse {
  room: RoomSummary;
}

export interface LeaderboardEntry {
  name: string;
  av?: string;
  bg?: string;
  wins?: number;
  points?: number;
  streak?: number;
  games?: number;
}

export interface HistoryEntry {
  id?: string;
  room?: string;
  icon?: string;
  winner?: string;
  winner_av?: string;
  rounds?: number;
  pts?: number;
  played_at?: string;
  duration_sec?: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface HistoryResponse {
  history: HistoryEntry[];
}

export interface CustomCard {
  id: string;
  name: string;
  emoji: string;
  color: string;
  effect: string;
  trigger: string;
  by?: string;
}

export interface CustomCardsResponse {
  customCards: CustomCard[];
}

export interface CustomCardResponse {
  customCard: CustomCard;
}
