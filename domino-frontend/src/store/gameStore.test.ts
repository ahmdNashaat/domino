import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';
import type { DominoTile } from '@/types/contracts';

describe('useGameStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    useGameStore.getState().resetGame();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the bot bonbona tile out of the table in offline mode', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    useGameStore.getState().startGame('Tester', 600, 'hard', 'bot');

    const playerLastCapture: DominoTile = [2, 1];
    const playerLastGroup: DominoTile[] = [playerLastCapture, [4, 4]];
    const botTile: DominoTile = [0, 3];

    useGameStore.setState(state => ({
      phase: 'playing',
      gameMode: 'bot',
      botDifficulty: 'hard',
      table: [],
      currentPlayerId: 'opponent',
      activeCardIndex: 0,
      selectedTableTiles: [],
      selectedBonbonaTiles: [],
      lastEvent: null,
      player: {
        ...state.player,
        hand: [[6, 6]],
        winPile: playerLastGroup,
        basraCount: 0,
        basraTiles: [],
        lastCapture: playerLastCapture,
        lastCaptureGroup: playerLastGroup,
      },
      opponent: {
        ...state.opponent,
        hand: [botTile],
        winPile: [],
        basraCount: 0,
        basraTiles: [],
        lastCapture: null,
        lastCaptureGroup: [],
      },
    }));

    vi.advanceTimersByTime(5000);

    const state = useGameStore.getState();
    expect(state.table).toEqual([]);
    expect(state.opponent.winPile).toEqual([...playerLastGroup, botTile]);
    expect(state.player.winPile).toEqual([]);
    expect(state.currentPlayerId).toBe('player');
  });
});
