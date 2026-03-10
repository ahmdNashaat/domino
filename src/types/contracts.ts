export type DominoTile = [number, number];

export type TileState = 'normal' | 'active' | 'selected' | 'capturable' | 'frozen';
export type TileSize = 'sm' | 'md' | 'lg';

export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'bot' | 'friend';
export type GamePhase = 'idle' | 'playing' | 'waiting_player' | 'bot_thinking' | 'round_end' | 'game_over';
export type GameVariant = 'koutchina' | 'classic';
export type ClassicGamePhase = 'idle' | 'playing' | 'bot_thinking' | 'round_end' | 'game_over' | 'blocked';

export type ChainEnd = 'left' | 'right';

export interface ClassicPlayer {
  name: string;
  hand: DominoTile[];
  score: number;
  cumulativeScore: number;
  isBot: boolean;
}

export interface ClassicGameState {
  phase: ClassicGamePhase;
  gameMode: GameMode;
  chain: DominoTile[];
  chainEnds: [number, number];
  boneyard: DominoTile[];
  players: ClassicPlayer[];
  currentPlayerIndex: number;
  selectedTileIndex: number;
  roundNumber: number;
  targetScore: number;
  botDifficulty: BotDifficulty;
  passCount: number;
  lastEvent: ClassicGameEvent | null;
  playerCount: number;
}

export type ClassicGameEvent =
  | { type: 'play'; playerIndex: number; tile: DominoTile; end: ChainEnd }
  | { type: 'draw'; playerIndex: number; count: number }
  | { type: 'pass'; playerIndex: number }
  | { type: 'block'; message: string }
  | { type: 'invalid'; message: string };

export interface ClassicRoundScore {
  handScores: number[];
  winnerPoints: number;
  roundWinnerIndex: number; // -1 for tie
}

export interface Player {
  name: string;
  hand: DominoTile[];
  winPile: DominoTile[];
  basraCount: number;
  basraTiles: DominoTile[]; // tiles that triggered a basra (used for UI highlighting)
  score: number;
  cumulativeScore: number;
  lastCapture: DominoTile | null;
  lastCaptureGroup: DominoTile[];
}

export interface GameState {
  phase: GamePhase;
  gameMode: GameMode;
  table: DominoTile[];
  player: Player;
  opponent: Player;
  currentPlayerId: 'player' | 'opponent';
  activeCardIndex: number;
  selectedTableTiles: DominoTile[];
  selectedBonbonaTiles: DominoTile[];
  roundNumber: number;
  targetScore: number;
  botDifficulty: BotDifficulty;
  lastEvent: GameEvent | null;
}

export type GameEvent = 
  | { type: 'basra'; playerId: 'player' | 'opponent' }
  | { type: 'basra_bonbona'; playerId: 'player' | 'opponent' }
  | { type: 'bonbona'; playerId: 'player' | 'opponent' }
  | { type: 'joker'; playerId: 'player' | 'opponent'; tilesSwept: DominoTile[] }
  | { type: 'invalid'; message: string }
  | { type: 'capture'; playerId: 'player' | 'opponent'; tiles: DominoTile[] }
  | { type: 'drop'; playerId: 'player' | 'opponent'; tile: DominoTile };

export interface RoundScore {
  playerCards: number;
  opponentCards: number;
  playerBasras: number;
  opponentBasras: number;
  playerPoints: number;
  opponentPoints: number;
  diff: number;
  roundWinner: 'player' | 'opponent' | 'tie';
}

export interface Settings {
  playerName: string;
  defaultTargetScore: 600 | 1000;
  soundEnabled: boolean;
  language: 'ar' | 'en';
  botDifficulty: BotDifficulty;
}
