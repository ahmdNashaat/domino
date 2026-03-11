import { create } from 'zustand';
import { DominoTile, ClassicGamePhase, GameMode, BotDifficulty, ChainEnd, ClassicPlayer, ClassicGameEvent } from '@/types/contracts';
import { useStatsStore } from '@/store/statsStore';
import {
  generateClassicTiles, shuffleTiles, distributeClassicTilesMulti,
  getChainEnds, canPlayTile, getPlayableEnds, placeTile,
  hasPlayableTile, isGameBlockedMulti, calculateClassicRoundScoreMulti,
  findHighestDouble, calculateHandScore,
} from '@/utils/classicGameEngine';
import { makeClassicBotDecision, getClassicBotDelay } from '@/utils/classicBotAI';

const createPlayer = (name: string, isBot: boolean): ClassicPlayer => ({
  name, hand: [], score: 0, cumulativeScore: 0, isBot,
});

const BOT_NAMES = ['بوت 1', 'بوت 2', 'بوت 3'];


interface LastRoundSummary {
  phase: 'round_end' | 'game_over';
  players: ClassicPlayer[];
  targetScore: number;
  roundNumber: number;
}

interface ClassicGameStore {
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
  lastRoundSummary: LastRoundSummary | null;

  startGame: (playerName: string, targetScore: number, botDifficulty: BotDifficulty, gameMode: GameMode, opponentName?: string, playerCount?: number, extraNames?: string[]) => void;
  selectTile: (index: number) => void;
  playTile: (end: ChainEnd) => void;
  drawFromBoneyard: () => void;
  passTurn: () => void;
  clearEvent: () => void;
  nextRound: () => void;
  resetGame: () => void;
}

export const useClassicGameStore = create<ClassicGameStore>((set, get) => ({
  phase: 'idle',
  gameMode: 'bot',
  chain: [],
  chainEnds: [-1, -1],
  boneyard: [],
  players: [createPlayer('أنت', false)],
  currentPlayerIndex: 0,
  selectedTileIndex: -1,
  roundNumber: 1,
  targetScore: 100,
  botDifficulty: 'medium',
  passCount: 0,
  lastEvent: null,
  playerCount: 2,
  lastRoundSummary: null,

  startGame: (playerName, targetScore, botDifficulty, gameMode, opponentName, playerCount = 2, extraNames) => {
    const tiles = shuffleTiles(generateClassicTiles());
    const { hands, boneyard } = distributeClassicTilesMulti(tiles, playerCount);

    // Build players array
    const prevPlayers = get().players;
    const players: ClassicPlayer[] = [];

    // Player 0 is always the human
    players.push({
      ...createPlayer(playerName || 'لاعب 1', false),
      hand: hands[0],
      cumulativeScore: prevPlayers[0]?.cumulativeScore || 0,
    });

    for (let i = 1; i < playerCount; i++) {
      const isBot = gameMode === 'bot';
      let name: string;
      if (gameMode === 'friend') {
        name = extraNames?.[i - 1] || opponentName || `لاعب ${i + 1}`;
      } else {
        name = BOT_NAMES[i - 1] || `بوت ${i}`;
      }
      players.push({
        ...createPlayer(name, isBot),
        hand: hands[i],
        cumulativeScore: prevPlayers[i]?.cumulativeScore || 0,
      });
    }

    // Find starter (highest double)
    let starterIdx = 0;
    let highestDouble = -1;
    for (let i = 0; i < playerCount; i++) {
      const hd = findHighestDouble(hands[i]);
      if (hd > highestDouble) {
        highestDouble = hd;
        starterIdx = i;
      }
    }
    if (highestDouble < 0) starterIdx = Math.floor(Math.random() * playerCount);

    set({
      phase: 'playing',
      gameMode,
      chain: [],
      chainEnds: [-1, -1] as [number, number],
      boneyard,
      players,
      currentPlayerIndex: starterIdx,
      selectedTileIndex: -1,
      targetScore,
      botDifficulty,
      passCount: 0,
      lastEvent: null,
      playerCount,
      lastRoundSummary: null,
    });

    // If starter is a bot, trigger bot turn
    if (players[starterIdx].isBot) {
      setTimeout(() => triggerBotTurn(set, get), 800);
    }
  },

  selectTile: (index) => {
    const state = get();
    if (state.phase !== 'playing') return;
    const current = state.players[state.currentPlayerIndex];
    if (current.isBot) return;
    set({ selectedTileIndex: index === state.selectedTileIndex ? -1 : index });
  },

  playTile: (end) => {
    const state = get();
    if (state.phase !== 'playing') return;
    const idx = state.currentPlayerIndex;
    const current = state.players[idx];
    if (current.isBot) return;

    const tileIndex = state.selectedTileIndex;
    if (tileIndex < 0 || tileIndex >= current.hand.length) return;

    const tile = current.hand[tileIndex];
    const playableEnds = getPlayableEnds(tile, state.chainEnds);
    if (!playableEnds.includes(end)) {
      set({ lastEvent: { type: 'invalid', message: 'لا يمكن وضع هذه القطعة هنا' } });
      return;
    }

    const newChain = placeTile(state.chain, tile, end);
    const newChainEnds = getChainEnds(newChain);
    const newHand = current.hand.filter((_, i) => i !== tileIndex);
    const newPlayers = [...state.players];
    newPlayers[idx] = { ...current, hand: newHand };

    set({
      chain: newChain,
      chainEnds: newChainEnds,
      players: newPlayers,
      selectedTileIndex: -1,
      passCount: 0,
      lastEvent: { type: 'play', playerIndex: idx, tile, end },
    });

    setTimeout(() => processAfterTurn(set, get), 600);
  },

  drawFromBoneyard: () => {
    const state = get();
    if (state.phase !== 'playing') return;
    const idx = state.currentPlayerIndex;
    const current = state.players[idx];
    if (current.isBot) return;
    if (state.boneyard.length === 0) return;
    if (hasPlayableTile(current.hand, state.chainEnds)) {
      set({ lastEvent: { type: 'invalid', message: 'عندك قطعة تنفع تلعبها' } });
      return;
    }

    const drawn = state.boneyard[0];
    const newBoneyard = state.boneyard.slice(1);
    const newHand = [...current.hand, drawn];
    const newPlayers = [...state.players];
    newPlayers[idx] = { ...current, hand: newHand };

    set({
      boneyard: newBoneyard,
      players: newPlayers,
      selectedTileIndex: -1,
      lastEvent: { type: 'draw', playerIndex: idx, count: 1 },
    });
  },

  passTurn: () => {
    const state = get();
    if (state.phase !== 'playing') return;
    const idx = state.currentPlayerIndex;
    const current = state.players[idx];
    if (current.isBot) return;
    if (state.boneyard.length > 0) return;
    if (hasPlayableTile(current.hand, state.chainEnds)) {
      set({ lastEvent: { type: 'invalid', message: 'عندك قطعة تنفع تلعبها' } });
      return;
    }

    const newPassCount = state.passCount + 1;
    set({
      passCount: newPassCount,
      lastEvent: { type: 'pass', playerIndex: idx },
    });

    if (newPassCount >= state.playerCount) {
      setTimeout(() => endRound(set, get, -1), 800);
      return;
    }

    const nextIdx = (idx + 1) % state.playerCount;
    setTimeout(() => {
      set({ currentPlayerIndex: nextIdx, selectedTileIndex: -1, lastEvent: null });
      if (get().players[nextIdx].isBot) {
        triggerBotTurn(set, get);
      }
    }, 600);
  },

  clearEvent: () => set({ lastEvent: null }),

  nextRound: () => {
    const state = get();
    const tiles = shuffleTiles(generateClassicTiles());
    const { hands, boneyard } = distributeClassicTilesMulti(tiles, state.playerCount);

    let starterIdx = 0;
    let highestDouble = -1;
    for (let i = 0; i < state.playerCount; i++) {
      const hd = findHighestDouble(hands[i]);
      if (hd > highestDouble) { highestDouble = hd; starterIdx = i; }
    }
    if (highestDouble < 0) {
      // Lowest cumulative score starts
      let minScore = Infinity;
      state.players.forEach((p, i) => { if (p.cumulativeScore < minScore) { minScore = p.cumulativeScore; starterIdx = i; } });
    }

    const newPlayers = state.players.map((p, i) => ({
      ...p, hand: hands[i], score: 0,
    }));

    set({
      phase: 'playing',
      chain: [],
      chainEnds: [-1, -1] as [number, number],
      boneyard,
      players: newPlayers,
      currentPlayerIndex: starterIdx,
      selectedTileIndex: -1,
      roundNumber: state.roundNumber + 1,
      passCount: 0,
      lastEvent: null,
      lastRoundSummary: null,
    });

    if (newPlayers[starterIdx].isBot) {
      setTimeout(() => triggerBotTurn(set, get), 800);
    }
  },

  resetGame: () => {
    set({
      phase: 'idle',
      gameMode: 'bot',
      chain: [],
      chainEnds: [-1, -1] as [number, number],
      boneyard: [],
      players: [createPlayer('أنت', false)],
      currentPlayerIndex: 0,
      selectedTileIndex: -1,
      roundNumber: 1,
      passCount: 0,
      lastEvent: null,
      playerCount: 2,
      lastRoundSummary: null,
    });
  },
}));

function triggerBotTurn(set: any, get: () => ClassicGameStore) {
  set({ phase: 'bot_thinking' as ClassicGamePhase });
  const state = get();
  const delay = getClassicBotDelay(state.botDifficulty);

  setTimeout(() => executeBotMove(set, get), delay);
}

function executeBotMove(set: any, get: () => ClassicGameStore) {
  const state = get();
  const idx = state.currentPlayerIndex;
  const botHand = state.players[idx].hand;

  const decision = makeClassicBotDecision(botHand, state.chainEnds, state.boneyard.length, state.botDifficulty);

  if (decision.action === 'draw') {
    botDraw(set, get);
    return;
  }

  if (decision.action === 'pass') {
    const newPassCount = state.passCount + 1;
    set({
      phase: 'playing' as ClassicGamePhase,
      passCount: newPassCount,
      lastEvent: { type: 'pass', playerIndex: idx },
    });

    if (newPassCount >= state.playerCount) {
      setTimeout(() => endRound(set, get, -1), 800);
      return;
    }

    const nextIdx = (idx + 1) % state.playerCount;
    setTimeout(() => {
      set({ currentPlayerIndex: nextIdx, selectedTileIndex: -1, lastEvent: null });
      if (get().players[nextIdx].isBot) triggerBotTurn(set, get);
    }, 800);
    return;
  }

  // Play tile
  const tileIndex = decision.tileIndex!;
  const end = decision.end!;
  const tile = botHand[tileIndex];
  const newChain = placeTile(state.chain, tile, end);
  const newChainEnds = getChainEnds(newChain);
  const newHand = botHand.filter((_, i) => i !== tileIndex);
  const newPlayers = [...state.players];
  newPlayers[idx] = { ...state.players[idx], hand: newHand };

  set({
    phase: 'playing' as ClassicGamePhase,
    chain: newChain,
    chainEnds: newChainEnds,
    players: newPlayers,
    passCount: 0,
    lastEvent: { type: 'play', playerIndex: idx, tile, end },
  });

  setTimeout(() => processAfterTurn(set, get), 800);
}

function botDraw(set: any, get: () => ClassicGameStore) {
  const state = get();
  const idx = state.currentPlayerIndex;

  if (state.boneyard.length === 0) {
    const newPassCount = state.passCount + 1;
    set({
      phase: 'playing' as ClassicGamePhase,
      passCount: newPassCount,
      lastEvent: { type: 'pass', playerIndex: idx },
    });
    if (newPassCount >= state.playerCount) {
      setTimeout(() => endRound(set, get, -1), 800);
      return;
    }
    const nextIdx = (idx + 1) % state.playerCount;
    setTimeout(() => {
      set({ currentPlayerIndex: nextIdx, selectedTileIndex: -1, lastEvent: null });
      if (get().players[nextIdx].isBot) triggerBotTurn(set, get);
    }, 800);
    return;
  }

  const drawn = state.boneyard[0];
  const newBoneyard = state.boneyard.slice(1);
  const newHand = [...state.players[idx].hand, drawn];
  const newPlayers = [...state.players];
  newPlayers[idx] = { ...state.players[idx], hand: newHand };

  set({
    boneyard: newBoneyard,
    players: newPlayers,
    lastEvent: { type: 'draw', playerIndex: idx, count: 1 },
  });

  if (canPlayTile(drawn, state.chainEnds)) {
    setTimeout(() => {
      const s = get();
      const hand = s.players[idx].hand;
      const lastIdx = hand.length - 1;
      const ends = getPlayableEnds(hand[lastIdx], s.chainEnds);
      const tile = hand[lastIdx];
      const end = ends[0];
      const newChain = placeTile(s.chain, tile, end);
      const newChainEnds2 = getChainEnds(newChain);
      const finalHand = hand.filter((_, i) => i !== lastIdx);
      const np = [...s.players];
      np[idx] = { ...s.players[idx], hand: finalHand };

      set({
        phase: 'playing' as ClassicGamePhase,
        chain: newChain,
        chainEnds: newChainEnds2,
        players: np,
        passCount: 0,
        lastEvent: { type: 'play', playerIndex: idx, tile, end },
      });

      setTimeout(() => processAfterTurn(set, get), 800);
    }, 500);
  } else {
    setTimeout(() => botDraw(set, get), 400);
  }
}

function processAfterTurn(set: any, get: () => ClassicGameStore) {
  const state = get();
  const idx = state.currentPlayerIndex;
  const current = state.players[idx];

  if (current.hand.length === 0) {
    endRound(set, get, idx);
    return;
  }

  const allHands = state.players.map(p => p.hand);
  if (isGameBlockedMulti(allHands, state.boneyard, state.chainEnds)) {
    endRound(set, get, -1);
    return;
  }

  const nextIdx = (idx + 1) % state.playerCount;
  set({ currentPlayerIndex: nextIdx, selectedTileIndex: -1, lastEvent: null });

  if (state.players[nextIdx].isBot) {
    triggerBotTurn(set, get);
  }
}

function endRound(set: any, get: () => ClassicGameStore, finisherIndex: number) {
  const state = get();
  const hands = state.players.map(p => p.hand);
  const roundScore = calculateClassicRoundScoreMulti(hands, finisherIndex);

  const newPlayers = state.players.map((p, i) => {
    const pts = roundScore.roundWinnerIndex === i ? roundScore.winnerPoints : 0;
    return {
      ...p,
      score: pts,
      cumulativeScore: p.cumulativeScore + pts,
    };
  });

  const gameOver = newPlayers.some(p => p.cumulativeScore >= state.targetScore);

  if (gameOver) {
    const humanWon = newPlayers[0].cumulativeScore >= state.targetScore;
    useStatsStore.getState().recordGame(humanWon, false, 0, 0, roundScore.winnerPoints);
  }

  const phase = (gameOver ? 'game_over' : 'round_end') as ClassicGamePhase;
  const summary: LastRoundSummary = {
    phase: phase === 'game_over' ? 'game_over' : 'round_end',
    players: newPlayers,
    targetScore: state.targetScore,
    roundNumber: state.roundNumber,
  };

  set({
    phase,
    players: newPlayers,
    lastEvent: null,
    lastRoundSummary: summary,
  });
}
