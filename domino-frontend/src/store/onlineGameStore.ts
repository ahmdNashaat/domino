import { create } from 'zustand';
import { DominoTile, GameEvent, GamePhase, ClassicGameEvent } from '@/types/contracts';
import { tilesEqual, isBlankTile, isWaladTile } from '@/utils/gameEngine';

interface OnlinePlayer {
  name: string;
  handCount: number;
  hand: DominoTile[]; // only populated for "me"
  winPile: DominoTile[];
  basraCount: number;
  basraTiles: DominoTile[];
  score: number;
  cumulativeScore: number;
  lastCapture: DominoTile | null;
  lastCaptureGroup: DominoTile[];
}

interface OnlineClassicPlayer {
  id: string;
  name: string;
  handCount: number;
  score: number;
  cumulativeScore: number;
}

export type OnlineLastRoundSummary =
  | {
    variant: 'koutchina';
    phase: 'round_end' | 'game_over';
    me: OnlinePlayer;
    opponent: OnlinePlayer;
    targetScore: number;
    roundNumber: number;
  }
  | {
    variant: 'classic';
    phase: 'round_end' | 'game_over';
    classicPlayers: OnlineClassicPlayer[];
    myPlayerId: string;
    targetScore: number;
    roundNumber: number;
  };

export interface OnlineGameState {
  phase: GamePhase;
  table: DominoTile[];
  chain: DominoTile[]; // for classic
  chainEnds: [number, number]; // for classic
  boneyard: DominoTile[]; // koutchina only (classic uses count)
  boneyardCount: number; // classic only
  variant: 'koutchina' | 'classic';
  me: OnlinePlayer;
  opponent: OnlinePlayer;
  classicPlayers: OnlineClassicPlayer[];
  myHandClassic: DominoTile[];
  isMyTurn: boolean;
  currentPlayerId: string;
  activeCardIndex: number;
  selectedTileIndex: number; // for classic
  selectedTableTiles: DominoTile[];
  selectedBonbonaTiles: DominoTile[];
  roundNumber: number;
  targetScore: number;
  timerEnabled: boolean;
  timerSeconds: number;
  turnDeadline: number | null;
  lastEvent: GameEvent | ClassicGameEvent | null;
  myPlayerId: string; // 'player0' or 'player1'
  lastRoundSummary: OnlineLastRoundSummary | null;

  // Actions (local UI only)
  selectTile: (index: number) => void; // for classic
  selectTableTile: (tile: DominoTile) => void;
  selectBonbonaTile: (tile: DominoTile) => void;
  clearEvent: () => void;
  clearSelections: () => void;

  // Server sync
  applyServerState: (data: ServerGameState) => void;
  setMyPlayerId: (id: string) => void;
  setEvent: (event: GameEvent | ClassicGameEvent) => void;
  resetOnlineGame: () => void;
}

export interface ServerGameState {
  phase: GamePhase;
  table: DominoTile[];
  chain?: DominoTile[]; // for classic
  chainEnds?: [number, number]; // for classic
  boneyard?: DominoTile[]; // koutchina only
  boneyardCount?: number; // classic only
  currentPlayerId: string;
  activeCardIndex: number;
  roundNumber: number;
  targetScore: number;
  timerEnabled?: boolean;
  timerSeconds?: number;
  turnDeadline?: number | null;
  lastEvent?: GameEvent | ClassicGameEvent | null;
  variant?: 'koutchina' | 'classic';
  players?: OnlineClassicPlayer[]; // classic summary

  // My data
  myHand: DominoTile[];
  myWinPile: DominoTile[];
  myBasraCount: number;
  myBasraTiles: DominoTile[];
  myScore: number;
  myCumulativeScore: number;
  myName: string;
  myLastCapture: DominoTile | null;
  myLastCaptureGroup: DominoTile[];

  // Opponent data
  opponentHandCount: number;
  opponentWinPile: DominoTile[];
  opponentBasraCount: number;
  opponentBasraTiles: DominoTile[];
  opponentScore: number;
  opponentCumulativeScore: number;
  opponentName: string;
  opponentLastCapture: DominoTile | null;
  opponentLastCaptureGroup: DominoTile[];
}

const createEmptyPlayer = (name: string): OnlinePlayer => ({
  name,
  handCount: 0,
  hand: [],
  winPile: [],
  basraCount: 0,
  basraTiles: [],
  score: 0,
  cumulativeScore: 0,
  lastCapture: null,
  lastCaptureGroup: [],
});

export const useOnlineGameStore = create<OnlineGameState>((set, get) => ({
  phase: 'idle',
  table: [],
  chain: [],
  chainEnds: [-1, -1],
  boneyard: [],
  boneyardCount: 0,
  variant: 'koutchina',
  me: createEmptyPlayer('أنا'),
  opponent: createEmptyPlayer('الخصم'),
  classicPlayers: [],
  myHandClassic: [],
  isMyTurn: false,
  currentPlayerId: '',
  activeCardIndex: -1,
  selectedTileIndex: -1,
  selectedTableTiles: [],
  selectedBonbonaTiles: [],
  roundNumber: 1,
  targetScore: 600,
  timerEnabled: false,
  timerSeconds: 30,
  turnDeadline: null,
  lastEvent: null,
  myPlayerId: '',
  lastRoundSummary: null,

  selectTile: (index) => set((s) => ({ selectedTileIndex: index === s.selectedTileIndex ? -1 : index })),

  selectTableTile: (tile) => {
    const state = get();
    if (!state.isMyTurn || state.phase !== 'playing') return;

    // Only الولد can select البلاطة
    if (isBlankTile(tile)) {
      const activeTile = state.me.hand[state.activeCardIndex];
      if (!activeTile || !isWaladTile(activeTile)) return;
    }

    const already = state.selectedTableTiles.find(t => tilesEqual(t, tile));
    if (already) {
      set({ selectedTableTiles: state.selectedTableTiles.filter(t => !tilesEqual(t, tile)) });
    } else {
      set({ selectedTableTiles: [...state.selectedTableTiles, tile] });
    }
  },

  selectBonbonaTile: (tile) => {
    const state = get();
    if (!state.isMyTurn || state.phase !== 'playing') return;

    const lastGroup = state.opponent.lastCaptureGroup || [];
    const inGroup = lastGroup.some(t => tilesEqual(t, tile));
    if (!inGroup) return;

    const allSelected =
      state.selectedBonbonaTiles.length === lastGroup.length &&
      state.selectedBonbonaTiles.every(t => lastGroup.some(l => tilesEqual(l, t)));

    set({ selectedBonbonaTiles: allSelected ? [] : [...lastGroup] });
  },

  clearEvent: () => set({ lastEvent: null }),
  clearSelections: () => set({ selectedTableTiles: [], selectedBonbonaTiles: [] }),

  setMyPlayerId: (id) => set({ myPlayerId: id }),

  setEvent: (event) => set({ lastEvent: event }),

  applyServerState: (data) => {
    const state = get();
    const isMyTurn = data.currentPlayerId === state.myPlayerId;
    const nextTimerEnabled = Object.prototype.hasOwnProperty.call(data, 'timerEnabled')
      ? data.timerEnabled ?? false
      : state.timerEnabled;
    const nextTimerSeconds = Object.prototype.hasOwnProperty.call(data, 'timerSeconds')
      ? data.timerSeconds ?? state.timerSeconds
      : state.timerSeconds;
    const nextTurnDeadline = Object.prototype.hasOwnProperty.call(data, 'turnDeadline')
      ? (data.turnDeadline ?? null)
      : state.turnDeadline;

    if (data.variant === 'classic') {
      const phaseTerminal = data.phase === 'round_end' || data.phase === 'game_over';
      const keepClassicSummary =
        state.lastRoundSummary?.variant === 'classic' &&
        state.lastRoundSummary.roundNumber === data.roundNumber;
      const classicSummary: OnlineLastRoundSummary | null = phaseTerminal
        ? {
          variant: 'classic',
          phase: data.phase,
          classicPlayers: data.players || [],
          myPlayerId: state.myPlayerId,
          targetScore: data.targetScore,
          roundNumber: data.roundNumber,
        }
        : (keepClassicSummary ? state.lastRoundSummary : null);

      set({
        phase: data.phase,
        table: [],
        chain: data.chain || [],
        chainEnds: data.chainEnds || [-1, -1],
        boneyard: [],
        boneyardCount: data.boneyardCount ?? 0,
        variant: 'classic',
        classicPlayers: data.players || [],
        myHandClassic: data.myHand || [],
        isMyTurn,
        currentPlayerId: data.currentPlayerId,
        activeCardIndex: -1,
        roundNumber: data.roundNumber,
        targetScore: data.targetScore,
        timerEnabled: nextTimerEnabled,
        timerSeconds: nextTimerSeconds,
        turnDeadline: nextTurnDeadline,
        lastEvent: data.lastEvent || null,
        selectedTileIndex: -1,
        selectedTableTiles: [],
        selectedBonbonaTiles: [],
        me: createEmptyPlayer('أنا'),
        opponent: createEmptyPlayer('الخصم'),
        lastRoundSummary: classicSummary,
      });
      return;
    }

    const meData: OnlinePlayer = {
      name: data.myName,
      hand: data.myHand,
      handCount: data.myHand.length,
      winPile: data.myWinPile,
      basraCount: data.myBasraCount,
      basraTiles: data.myBasraTiles || [],
      score: data.myScore,
      cumulativeScore: data.myCumulativeScore,
      lastCapture: data.myLastCapture,
      lastCaptureGroup: data.myLastCaptureGroup,
    };

    const opponentData: OnlinePlayer = {
      name: data.opponentName,
      hand: [],
      handCount: data.opponentHandCount,
      winPile: data.opponentWinPile,
      basraCount: data.opponentBasraCount,
      basraTiles: data.opponentBasraTiles || [],
      score: data.opponentScore,
      cumulativeScore: data.opponentCumulativeScore,
      lastCapture: data.opponentLastCapture,
      lastCaptureGroup: data.opponentLastCaptureGroup,
    };

    const phaseTerminal = data.phase === 'round_end' || data.phase === 'game_over';
    const keepKoutchinaSummary =
      state.lastRoundSummary?.variant === 'koutchina' &&
      state.lastRoundSummary.roundNumber === data.roundNumber;
    const koutchinaSummary: OnlineLastRoundSummary | null = phaseTerminal
      ? {
        variant: 'koutchina',
        phase: data.phase,
        me: meData,
        opponent: opponentData,
        targetScore: data.targetScore,
        roundNumber: data.roundNumber,
      }
      : (keepKoutchinaSummary ? state.lastRoundSummary : null);

    set({
      phase: data.phase,
      table: data.table || [],
      chain: data.chain || [],
      chainEnds: data.chainEnds || [-1, -1],
      boneyard: data.boneyard || [],
      boneyardCount: 0,
      variant: data.variant || 'koutchina',
      classicPlayers: [],
      myHandClassic: [],
      isMyTurn,
      currentPlayerId: data.currentPlayerId,
      activeCardIndex: data.activeCardIndex,
      roundNumber: data.roundNumber,
      targetScore: data.targetScore,
      timerEnabled: nextTimerEnabled,
      timerSeconds: nextTimerSeconds,
      turnDeadline: nextTurnDeadline,
      lastEvent: data.lastEvent || null,
      selectedTileIndex: -1,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      me: meData,
      opponent: opponentData,
      lastRoundSummary: koutchinaSummary,
    });
  },

  resetOnlineGame: () => {
    set({
      phase: 'idle',
      table: [],
      chain: [],
      chainEnds: [-1, -1],
      boneyard: [],
      boneyardCount: 0,
      variant: 'koutchina',
      me: createEmptyPlayer('أنا'),
      opponent: createEmptyPlayer('الخصم'),
      classicPlayers: [],
      myHandClassic: [],
      isMyTurn: false,
      currentPlayerId: '',
      activeCardIndex: -1,
      selectedTileIndex: -1,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      roundNumber: 1,
      targetScore: 600,
      timerEnabled: false,
      timerSeconds: 30,
      turnDeadline: null,
      lastEvent: null,
      myPlayerId: '',
      lastRoundSummary: null,
    });
  },
}));
