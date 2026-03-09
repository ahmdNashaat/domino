import { create } from 'zustand';
import { DominoTile, GameEvent, GamePhase } from '@/types/contracts';
import { tilesEqual, isBlankTile, isWaladTile } from '@/utils/gameEngine';

interface OnlinePlayer {
  name: string;
  handCount: number;
  hand: DominoTile[]; // only populated for "me"
  winPile: DominoTile[];
  basraCount: number;
  score: number;
  cumulativeScore: number;
  lastCapture: DominoTile | null;
  lastCaptureGroup: DominoTile[];
}

export interface OnlineGameState {
  phase: GamePhase;
  table: DominoTile[];
  chain: DominoTile[]; // for classic
  chainEnds: [number, number]; // for classic
  boneyard: DominoTile[]; // for classic
  variant: 'koutchina' | 'classic';
  me: OnlinePlayer;
  opponent: OnlinePlayer;
  isMyTurn: boolean;
  activeCardIndex: number;
  selectedTileIndex: number; // for classic
  selectedTableTiles: DominoTile[];
  selectedBonbonaTiles: DominoTile[];
  roundNumber: number;
  targetScore: number;
  lastEvent: GameEvent | null;
  myPlayerId: string; // 'player0' or 'player1'

  // Actions (local UI only)
  selectTile: (index: number) => void; // for classic
  selectTableTile: (tile: DominoTile) => void;
  selectBonbonaTile: (tile: DominoTile) => void;
  clearEvent: () => void;
  clearSelections: () => void;

  // Server sync
  applyServerState: (data: ServerGameState) => void;
  setMyPlayerId: (id: string) => void;
  setEvent: (event: GameEvent) => void;
  resetOnlineGame: () => void;
}

export interface ServerGameState {
  phase: GamePhase;
  table: DominoTile[];
  chain?: DominoTile[]; // for classic
  chainEnds?: [number, number]; // for classic
  boneyard?: DominoTile[]; // for classic
  currentPlayerId: string;
  activeCardIndex: number;
  roundNumber: number;
  targetScore: number;
  lastEvent?: GameEvent | null;
  variant?: 'koutchina' | 'classic';

  // My data
  myHand: DominoTile[];
  myWinPile: DominoTile[];
  myBasraCount: number;
  myScore: number;
  myCumulativeScore: number;
  myName: string;
  myLastCapture: DominoTile | null;
  myLastCaptureGroup: DominoTile[];

  // Opponent data
  opponentHandCount: number;
  opponentWinPile: DominoTile[];
  opponentBasraCount: number;
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
  variant: 'koutchina',
  me: createEmptyPlayer('أنا'),
  opponent: createEmptyPlayer('الخصم'),
  isMyTurn: false,
  activeCardIndex: -1,
  selectedTileIndex: -1,
  selectedTableTiles: [],
  selectedBonbonaTiles: [],
  roundNumber: 1,
  targetScore: 600,
  lastEvent: null,
  myPlayerId: '',

  selectTile: (index) => set({ selectedTileIndex: index }),

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

    const already = state.selectedBonbonaTiles.find(t => tilesEqual(t, tile));
    if (already) {
      set({ selectedBonbonaTiles: state.selectedBonbonaTiles.filter(t => !tilesEqual(t, tile)) });
    } else {
      set({ selectedBonbonaTiles: [...state.selectedBonbonaTiles, tile] });
    }
  },

  clearEvent: () => set({ lastEvent: null }),
  clearSelections: () => set({ selectedTableTiles: [], selectedBonbonaTiles: [] }),

  setMyPlayerId: (id) => set({ myPlayerId: id }),

  setEvent: (event) => set({ lastEvent: event }),

  applyServerState: (data) => {
    const state = get();
    const isMyTurn = data.currentPlayerId === state.myPlayerId;

    set({
      phase: data.phase,
      table: data.table || [],
      chain: data.chain || [],
      chainEnds: data.chainEnds || [-1, -1],
      boneyard: data.boneyard || [],
      variant: data.variant || 'koutchina',
      isMyTurn,
      activeCardIndex: data.activeCardIndex,
      roundNumber: data.roundNumber,
      targetScore: data.targetScore,
      lastEvent: data.lastEvent || null,
      selectedTileIndex: -1,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      me: {
        name: data.myName,
        hand: data.myHand,
        handCount: data.myHand.length,
        winPile: data.myWinPile,
        basraCount: data.myBasraCount,
        score: data.myScore,
        cumulativeScore: data.myCumulativeScore,
        lastCapture: data.myLastCapture,
        lastCaptureGroup: data.myLastCaptureGroup,
      },
      opponent: {
        name: data.opponentName,
        hand: [],
        handCount: data.opponentHandCount,
        winPile: data.opponentWinPile,
        basraCount: data.opponentBasraCount,
        score: data.opponentScore,
        cumulativeScore: data.opponentCumulativeScore,
        lastCapture: data.opponentLastCapture,
        lastCaptureGroup: data.opponentLastCaptureGroup,
      },
    });
  },

  resetOnlineGame: () => {
    set({
      phase: 'idle',
      table: [],
      chain: [],
      chainEnds: [-1, -1],
      boneyard: [],
      variant: 'koutchina',
      me: createEmptyPlayer('أنا'),
      opponent: createEmptyPlayer('الخصم'),
      isMyTurn: false,
      activeCardIndex: -1,
      selectedTileIndex: -1,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      roundNumber: 1,
      targetScore: 600,
      lastEvent: null,
      myPlayerId: '',
    });
  },
}));
