import { create } from 'zustand';
import { DominoTile, GameState, GamePhase, GameMode, BotDifficulty, GameEvent, Player } from '@/types/contracts';
import { useStatsStore } from '@/store/statsStore';
import {
  generateTiles, shuffleTiles, distributeTiles,
  getTileHandValue, getTileTableValue, isJokerTile, isBlankTile, isWaladTile,
  canCapture, canPartitionCapture, isBasra, tilesEqual, calculateRoundScore
} from '@/utils/gameEngine';
import { makeBotDecision, getBotDelay } from '@/utils/botAI';

const createPlayer = (name: string): Player => ({
  name,
  hand: [],
  winPile: [],
  basraCount: 0,
  basraTiles: [],
  score: 0,
  cumulativeScore: 0,
  lastCapture: null,
  lastCaptureGroup: [],
});

interface GameStore extends GameState {
  startGame: (playerName: string, targetScore: number, botDifficulty: BotDifficulty, gameMode: GameMode, opponentName?: string) => void;
  selectTableTile: (tile: DominoTile) => void;
  confirmCapture: () => void;
  dropTile: () => void;
  selectBonbonaTile: (tile: DominoTile) => void;
  clearEvent: () => void;
  nextRound: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'idle',
  gameMode: 'bot',
  table: [],
  player: createPlayer('أنت'),
  opponent: createPlayer('البوت'),
  currentPlayerId: 'player',
  activeCardIndex: -1,
  selectedTableTiles: [],
  selectedBonbonaTiles: [],
  roundNumber: 1,
  targetScore: 600,
  botDifficulty: 'medium',
  lastEvent: null,

  startGame: (playerName, targetScore, botDifficulty, gameMode, opponentName) => {
    const tiles = shuffleTiles(generateTiles());
    const [playerHand, opponentHand] = distributeTiles(tiles);
    const oppName = gameMode === 'friend' ? (opponentName || 'لاعب 2') : 'البوت';

    // First round: random start
    const starter = Math.random() < 0.5 ? 'player' : 'opponent';
    const starterHand = starter === 'player' ? playerHand : opponentHand;

    set({
      phase: 'playing',
      gameMode,
      table: [],
      player: { ...createPlayer(playerName || 'لاعب'), hand: playerHand, cumulativeScore: get().player.cumulativeScore },
      opponent: { ...createPlayer(oppName), hand: opponentHand, cumulativeScore: get().opponent.cumulativeScore },
      currentPlayerId: starter,
      activeCardIndex: starterHand.length - 1,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      targetScore,
      botDifficulty,
      lastEvent: null,
    });

    // If bot starts in bot mode, trigger bot turn
    if (gameMode === 'bot' && starter === 'opponent') {
      setTimeout(() => triggerBotTurn(set, get), 800);
    }
  },

  selectTableTile: (tile) => {
    const state = get();
    if (!canPlayerAct(state)) return;

    if (isBlankTile(tile)) {
      // Only الولد can capture البلاطة
      const current = state[state.currentPlayerId];
      const activeTile = current.hand[state.activeCardIndex];
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
    if (!canPlayerAct(state)) return;

    const already = state.selectedBonbonaTiles.find(t => tilesEqual(t, tile));
    if (already) {
      set({ selectedBonbonaTiles: state.selectedBonbonaTiles.filter(t => !tilesEqual(t, tile)) });
    } else {
      set({ selectedBonbonaTiles: [...state.selectedBonbonaTiles, tile] });
    }
  },

  confirmCapture: () => {
    const state = get();
    if (!canPlayerAct(state)) return;

    const pid = state.currentPlayerId;
    const otherId: 'player' | 'opponent' = pid === 'player' ? 'opponent' : 'player';
    const current = state[pid];
    const other = state[otherId];

    const activeTile = current.hand[state.activeCardIndex];
    if (!activeTile) return;

    // Joker on empty table → drops as value 2
    if (isJokerTile(activeTile) && state.table.length === 0) {
      const newHand = current.hand.filter((_, i) => i !== state.activeCardIndex);
      set({
        [pid]: { ...current, hand: newHand },
        table: [...state.table, activeTile],
        selectedTableTiles: [],
        selectedBonbonaTiles: [],
        lastEvent: { type: 'drop', playerId: pid, tile: activeTile },
      } as any);
      setTimeout(() => processAfterTurn(set, get), 600);
      return;
    }

    // Joker sweeps all
    if (isJokerTile(activeTile)) {
      const swept = [...state.table];
      const newHand = current.hand.filter((_, i) => i !== state.activeCardIndex);
      const newWinPile = [...current.winPile, ...swept, activeTile];

      set({
        [pid]: { ...current, hand: newHand, winPile: newWinPile, lastCapture: activeTile, lastCaptureGroup: [...swept, activeTile] },
        table: [],
        lastEvent: { type: 'joker', playerId: pid, tilesSwept: swept },
        selectedTableTiles: [],
        selectedBonbonaTiles: [],
      } as any);

      setTimeout(() => processAfterTurn(set, get), 1500);
      return;
    }

    const handValue = getTileHandValue(activeTile);
    const selectedTiles = state.selectedTableTiles;
    const bonbonaTiles = state.selectedBonbonaTiles;

    if (selectedTiles.length === 0 && bonbonaTiles.length === 0) {
      set({ lastEvent: { type: 'invalid', message: 'اختار أوراق من الطاولة' } });
      return;
    }

    // Validate bonbona - check if active tile value equals the LAST SINGLE TILE of opponent's win pile
    if (bonbonaTiles.length > 0) {
      const otherWinPile = other.winPile;
      if (!otherWinPile || otherWinPile.length === 0) {
        set({ lastEvent: { type: 'invalid', message: 'الخصم لسه ما كسبش حاجة' }, selectedBonbonaTiles: [] });
        return;
      }
      // Active tile must be joker (for basra check later)
      if (isJokerTile(activeTile)) {
        set({ lastEvent: { type: 'invalid', message: 'الجوكر ما فيهش بونبونة' }, selectedBonbonaTiles: [] });
        return;
      }
      // Get LAST SINGLE TILE value from opponent's win pile
      const lastTile = otherWinPile[otherWinPile.length - 1];
      if (isJokerTile(lastTile)) {
        set({ lastEvent: { type: 'invalid', message: 'الجوكر ما فيهش بونبونة' }, selectedBonbonaTiles: [] });
        return;
      }
      const lastTileValue = getTileTableValue(lastTile);
      if (handValue !== lastTileValue) {
        set({ lastEvent: { type: 'invalid', message: 'قيمة كارتك لا تساوي قيمة آخر أكل الخصم' }, selectedBonbonaTiles: [] });
        return;
      }
      // Bonbona takes only the last tile
      if (bonbonaTiles.length !== 1 || !tilesEqual(bonbonaTiles[0], lastTile)) {
        set({ lastEvent: { type: 'invalid', message: 'اختار آخر قطعة من مكسب الخصم فقط' }, selectedBonbonaTiles: [] });
        return;
      }
    }

    // Validate table captures (exclude blanket from sum check)
    const nonBlankSelected = selectedTiles.filter(t => !isBlankTile(t));
    if (nonBlankSelected.length > 0 && !canPartitionCapture(handValue, selectedTiles)) {
      set({ lastEvent: { type: 'invalid', message: `لا يمكن تقسيم الأوراق المختارة لمجموعات بقيمة ${handValue}` } });
      return;
    }

    // If only blanket selected, must be الولد
    if (selectedTiles.length > 0 && nonBlankSelected.length === 0 && !isWaladTile(activeTile)) {
      set({ lastEvent: { type: 'invalid', message: 'البلاطة لا يأخذها غير الولد' } });
      return;
    }

    const basra = selectedTiles.length > 0 && isBasra(state.table, selectedTiles, activeTile);
    
    // Bonbona counts as basra only if opponent's last win tile was a basra tile
    let bonbonaCountsAsBasra = false;
    if (bonbonaTiles.length > 0 && other.winPile.length > 0) {
      const lastBonbonaTile = other.winPile[other.winPile.length - 1];
      bonbonaCountsAsBasra = other.basraTiles.some(t => tilesEqual(t, lastBonbonaTile));
    }
    
    const newHand = current.hand.filter((_, i) => i !== state.activeCardIndex);
    const captured = [...selectedTiles, ...bonbonaTiles, activeTile];
    const newWinPile = [...current.winPile, ...captured];
    const newTable = state.table.filter(t => !selectedTiles.some(s => tilesEqual(s, t)));
    const newBasraCount = current.basraCount + (basra || bonbonaCountsAsBasra ? 1 : 0);
    const newBasraTiles = basra || bonbonaCountsAsBasra ? [...current.basraTiles, activeTile] : current.basraTiles;

    let newOtherWinPile = other.winPile;
    let newOtherBasraTiles = other.basraTiles;
    if (bonbonaTiles.length > 0) {
      newOtherWinPile = newOtherWinPile.filter(t => !bonbonaTiles.some(bt => tilesEqual(bt, t)));
      newOtherBasraTiles = newOtherBasraTiles.filter(t => !bonbonaTiles.some(bt => tilesEqual(bt, t)));
    }

    const isBonbona = bonbonaTiles.length > 0;
    const event: GameEvent = isBonbona
      ? bonbonaCountsAsBasra 
        ? { type: 'basra_bonbona', playerId: pid }
        : { type: 'bonbona', playerId: pid }
      : basra
        ? { type: 'basra', playerId: pid }
        : { type: 'capture', playerId: pid, tiles: captured };

    set({
      [pid]: { ...current, hand: newHand, winPile: newWinPile, basraCount: newBasraCount, basraTiles: newBasraTiles, lastCapture: activeTile, lastCaptureGroup: captured },
      [otherId]: { ...other, winPile: newOtherWinPile, basraTiles: newOtherBasraTiles },
      table: newTable,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      lastEvent: event,
    } as any);

    setTimeout(() => processAfterTurn(set, get), isBonbona ? 2000 : basra ? 1800 : 800);
  },

  dropTile: () => {
    const state = get();
    if (!canPlayerAct(state)) return;

    const pid = state.currentPlayerId;
    const current = state[pid];
    const activeTile = current.hand[state.activeCardIndex];
    if (!activeTile) return;

    if (isJokerTile(activeTile) && state.table.length > 0) {
      set({ lastEvent: { type: 'invalid', message: 'الجوكر لازم يكسح الطاولة' } });
      return;
    }

    const newHand = current.hand.filter((_, i) => i !== state.activeCardIndex);
    set({
      [pid]: { ...current, hand: newHand },
      table: [...state.table, activeTile],
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      lastEvent: { type: 'drop', playerId: pid, tile: activeTile },
    } as any);

    setTimeout(() => processAfterTurn(set, get), 600);
  },

  clearEvent: () => set({ lastEvent: null }),

  nextRound: () => {
    const state = get();
    const tiles = shuffleTiles(generateTiles());
    const [playerHand, opponentHand] = distributeTiles(tiles);

    // Lowest cumulative score starts
    const starter = state.player.cumulativeScore <= state.opponent.cumulativeScore ? 'player' : 'opponent';
    const starterHand = starter === 'player' ? playerHand : opponentHand;

    set({
      phase: 'playing',
      table: [],
      player: { ...state.player, hand: playerHand, winPile: [], basraCount: 0, basraTiles: [], score: 0, lastCapture: null, lastCaptureGroup: [] },
      opponent: { ...state.opponent, hand: opponentHand, winPile: [], basraCount: 0, basraTiles: [], score: 0, lastCapture: null, lastCaptureGroup: [] },
      currentPlayerId: starter,
      activeCardIndex: starterHand.length - 1,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      roundNumber: state.roundNumber + 1,
      lastEvent: null,
    });

    // If bot starts in bot mode, trigger bot turn
    if (state.gameMode === 'bot' && starter === 'opponent') {
      setTimeout(() => triggerBotTurn(set, get), 800);
    }
  },

  resetGame: () => {
    set({
      phase: 'idle',
      gameMode: 'bot',
      table: [],
      player: createPlayer('أنت'),
      opponent: createPlayer('البوت'),
      currentPlayerId: 'player',
      activeCardIndex: -1,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      roundNumber: 1,
      lastEvent: null,
    });
  },
}));

function canPlayerAct(state: GameState & { gameMode: GameMode }): boolean {
  if (state.phase !== 'playing') return false;
  if (state.gameMode === 'friend') return true;
  return state.currentPlayerId === 'player';
}

function triggerBotTurn(set: any, get: () => GameStore) {
  const state = get();
  const delay = getBotDelay(state.botDifficulty);
  set({ phase: 'bot_thinking' as GamePhase });

  setTimeout(() => {
    executeBotMove(set, get);
  }, delay);
}

function executeBotMove(set: any, get: () => GameStore) {
  const currentState = get();
  const botHand = currentState.opponent.hand;
  if (botHand.length === 0) return;

  const activeTile = botHand[botHand.length - 1];
  const decision = makeBotDecision(
    activeTile,
    currentState.table,
    currentState.botDifficulty,
    currentState.player.lastCapture,
    currentState.player.lastCaptureGroup,
    currentState.player.winPile
  );

  // Handle bonbona tiles from player's win pile
  let playerUpdate: Partial<Player> = {};
  if (decision.bonbona && decision.bonbonaTiles.length > 0) {
    const newPlayerWinPile = currentState.player.winPile.filter(
      t => !decision.bonbonaTiles.some(bt => tilesEqual(bt, t))
    );
    const newPlayerBasraTiles = currentState.player.basraTiles.filter(
      t => !decision.bonbonaTiles.some(bt => tilesEqual(bt, t))
    );
    playerUpdate = { winPile: newPlayerWinPile, basraTiles: newPlayerBasraTiles };
  }
  const playerLastTile = currentState.player.winPile[currentState.player.winPile.length - 1];
  const playerLastIsBasra = playerLastTile
    ? currentState.player.basraTiles.some(t => tilesEqual(t, playerLastTile))
    : false;

  if (isJokerTile(activeTile) && currentState.table.length === 0) {
    const newHand = botHand.filter((_, i) => i !== botHand.length - 1);
    set({
      phase: 'playing' as GamePhase,
      opponent: { ...currentState.opponent, hand: newHand },
      player: { ...currentState.player, ...playerUpdate },
      table: [...currentState.table, activeTile],
      lastEvent: { type: 'drop', playerId: 'opponent', tile: activeTile } as GameEvent,
    });
  } else if (isJokerTile(activeTile)) {
     const swept = [...currentState.table];
    const newHand = botHand.filter((_, i) => i !== botHand.length - 1);
    const newWinPile = [...currentState.opponent.winPile, ...swept, activeTile];
    const captureGroup = [...swept, activeTile];
    set({
      phase: 'playing' as GamePhase,
      opponent: { ...currentState.opponent, hand: newHand, winPile: newWinPile, lastCapture: activeTile, lastCaptureGroup: captureGroup },
      player: { ...currentState.player, ...playerUpdate },
      table: [],
      lastEvent: { type: 'joker', playerId: 'opponent', tilesSwept: swept } as GameEvent,
    });
  } else if (decision.drop) {
    const newHand = botHand.filter((_, i) => i !== botHand.length - 1);
    // Bot can do bonbona even when dropping (no table capture needed)
    let bonbonaIsBasra = false;
    if (decision.bonbona && playerLastIsBasra) {
      bonbonaIsBasra = true;
    }

       if (decision.bonbona && decision.bonbonaTiles.length > 0) {
       const newWinPile = [...currentState.opponent.winPile, ...decision.bonbonaTiles, activeTile];
       const newTable = [...currentState.table, activeTile];
       const newBasraCount = currentState.opponent.basraCount + (bonbonaIsBasra ? 1 : 0);
       const newBasraTiles = bonbonaIsBasra ? [...currentState.opponent.basraTiles, activeTile] : currentState.opponent.basraTiles;
       set({
         phase: 'playing' as GamePhase,
         opponent: { ...currentState.opponent, hand: newHand, winPile: newWinPile, basraCount: newBasraCount, basraTiles: newBasraTiles, lastCapture: activeTile, lastCaptureGroup: [...decision.bonbonaTiles, activeTile] },
        player: { ...currentState.player, ...playerUpdate },
        table: newTable,
        lastEvent: bonbonaIsBasra ? { type: 'basra_bonbona', playerId: 'opponent' } as GameEvent : { type: 'bonbona', playerId: 'opponent' } as GameEvent,
      });
    } else {
      set({
        phase: 'playing' as GamePhase,
        opponent: { ...currentState.opponent, hand: newHand },
        table: [...currentState.table, activeTile],
        lastEvent: { type: 'drop', playerId: 'opponent', tile: activeTile } as GameEvent,
      });
    }
  } else {
    const basra = isBasra(currentState.table, decision.selected, activeTile);
    let bonbonaIsBasra = false;
    if (decision.bonbona && playerLastIsBasra) {
      bonbonaIsBasra = true;
    }
    const newHand = botHand.filter((_, i) => i !== botHand.length - 1);
    const captured = [...decision.selected, ...decision.bonbonaTiles, activeTile];
    const newWinPile = [...currentState.opponent.winPile, ...captured];
    const newTable = currentState.table.filter(t => !decision.selected.some(s => tilesEqual(s, t)));
    const newBasra = currentState.opponent.basraCount + (basra || bonbonaIsBasra ? 1 : 0);
    const newBasraTiles = (basra || bonbonaIsBasra) ? [...currentState.opponent.basraTiles, activeTile] : currentState.opponent.basraTiles;

    const event: GameEvent = decision.bonbona
      ? bonbonaIsBasra
        ? { type: 'basra_bonbona', playerId: 'opponent' }
        : { type: 'bonbona', playerId: 'opponent' }
      : basra
        ? { type: 'basra', playerId: 'opponent' }
        : { type: 'capture', playerId: 'opponent', tiles: captured };

    set({
      phase: 'playing' as GamePhase,
      opponent: { ...currentState.opponent, hand: newHand, winPile: newWinPile, basraCount: newBasra, basraTiles: newBasraTiles, lastCapture: activeTile, lastCaptureGroup: captured },
      player: { ...currentState.player, ...playerUpdate },
      table: newTable,
      lastEvent: event,
    });
  }

  const eventDelay = decision.bonbona ? 2000 : 1000;
  setTimeout(() => {
    const afterBot = get();
    if (afterBot.player.hand.length === 0 && afterBot.opponent.hand.length === 0) {
      endRound(set, get);
      return;
    }
    set({
      currentPlayerId: 'player' as const,
      activeCardIndex: afterBot.player.hand.length - 1,
      lastEvent: null,
    });
  }, eventDelay);
}

function processAfterTurn(set: any, get: () => GameStore) {
  const state = get();
  const playerHand = state.player.hand;
  const opponentHand = state.opponent.hand;

  if (playerHand.length === 0 && opponentHand.length === 0) {
    endRound(set, get);
    return;
  }

  // Determine next player
  const nextPlayerId: 'player' | 'opponent' = state.currentPlayerId === 'player' ? 'opponent' : 'player';
  const nextHand = nextPlayerId === 'player' ? playerHand : opponentHand;

  // If next player has no cards, check other or end
  if (nextHand.length === 0) {
    const otherHand = nextPlayerId === 'player' ? opponentHand : playerHand;
    if (otherHand.length === 0) {
      endRound(set, get);
    } else {
      // Stay with current player
      const stayId = state.currentPlayerId;
      const stayHand = stayId === 'player' ? playerHand : opponentHand;
      set({
        currentPlayerId: stayId,
        activeCardIndex: stayHand.length - 1,
        lastEvent: null,
      });
    }
    return;
  }

  set({
    currentPlayerId: nextPlayerId,
    activeCardIndex: nextHand.length - 1,
    lastEvent: null,
  });

  // In bot mode, if it's bot's turn, trigger bot AI
  if (state.gameMode === 'bot' && nextPlayerId === 'opponent') {
    triggerBotTurn(set, get);
  }
}

function endRound(set: any, get: () => GameStore) {
  const state = get();

  const remainingTable = state.table;
  let playerPile = [...state.player.winPile];
  let opponentPile = [...state.opponent.winPile];

  if (state.player.lastCapture) {
    playerPile = [...playerPile, ...remainingTable];
  } else {
    opponentPile = [...opponentPile, ...remainingTable];
  }

  const roundScore = calculateRoundScore(playerPile, opponentPile, state.player.basraCount, state.opponent.basraCount);

  const newPlayerCumulative = state.player.cumulativeScore + roundScore.playerPoints;
  const newOpponentCumulative = state.opponent.cumulativeScore + roundScore.opponentPoints;

  const gameOver = newPlayerCumulative >= state.targetScore || newOpponentCumulative >= state.targetScore;

  if (gameOver) {
    const playerWon = newPlayerCumulative >= state.targetScore;
    const isOnline = state.gameMode === 'bot' ? false : state.gameMode === 'friend' ? false : true;
    const winnerScore = Math.max(roundScore.playerPoints, roundScore.opponentPoints);
    useStatsStore.getState().recordGame(
      playerWon,
      isOnline,
      state.player.basraCount,
      0, // bonbonas tracked separately if needed
      winnerScore
    );
  }

  set({
    phase: gameOver ? 'game_over' as GamePhase : 'round_end' as GamePhase,
    table: [],
    player: {
      ...state.player,
      winPile: playerPile,
      score: roundScore.playerPoints,
      cumulativeScore: newPlayerCumulative,
    },
    opponent: {
      ...state.opponent,
      winPile: opponentPile,
      score: roundScore.opponentPoints,
      cumulativeScore: newOpponentCumulative,
    },
  });
}

