export type CellOwner = 'black' | 'white' | null;
export type GamePhase = 'placement' | 'movement' | 'finished';
export type GameMode = 'casual' | 'rated';

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  player: 'black' | 'white';
  from?: Position;
  to: Position;
  timestamp: number;
  moveNumber: number;
}

export interface Game {
  id: string;
  blackPlayer: PlayerInfo;
  whitePlayer: PlayerInfo;
  board: CellOwner[][];
  currentTurn: 'black' | 'white';
  phase: GamePhase;
  mode: GameMode;
  moves: Move[];
  status: 'waiting' | 'active' | 'finished';
  result?: GameResult;
  clock: {
    black: number;
    white: number;
  };
  lastMoveTimestamp: number;
  createdAt: number;
  spectators: number;
  positionHistory: string[];
  isBotGame?: boolean;
  botStrength?: string;
}

export interface PlayerInfo {
  uid: string;
  username: string;
  rating: number;
  ratingDeviation: number;
  piecesPlaced: number;
}

export interface GameResult {
  winner: 'black' | 'white' | 'draw';
  method: 'four-in-a-row' | 'timeout' | 'resignation' | 'abandon' | 'draw-agreed' | 'threefold-repetition' | '100-ply' | 'admin-intervention';
  ratingChangeBlack: number;
  ratingChangeWhite: number;
  blackRating: number;
  whiteRating: number;
}

export interface GameSummary {
  id: string;
  opponent: string;
  opponentUid: string;
  result: 'win' | 'loss' | 'draw';
  mode: GameMode;
  ratingChange: number;
  timestamp: number;
}

export interface SpectatorGame {
  id: string;
  blackPlayer: string;
  whitePlayer: string;
  blackRating: number;
  whiteRating: number;
  mode: GameMode;
  status: string;
}

export const BOARD_SIZE = 6;
export const TOTAL_PIECES = 8;
export const DEFAULT_TIME_MS = 3 * 60 * 1000;
export const MAX_PLY = 100;

export const GLICKO_DEFAULTS = {
  rating: 1500,
  ratingDeviation: 350,
  volatility: 0.06,
  tau: 0.6,
  convergenceTolerance: 1e-7,
};

export const MATCHMAKING = {
  initialRange: 100,
  rangeStep: 50,
  rangeInterval: 10000,
  maxRange: 500,
};

export const DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];