import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClassicGameStore } from './classicGameStore';

describe('useClassicGameStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    useClassicGameStore.getState().resetGame();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ignores stale bot timers after a fresh round starts on the human turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    useClassicGameStore.getState().startGame('Tester', 100, 'hard', 'bot', undefined, 2);
    useClassicGameStore.getState().nextRound();

    useClassicGameStore.setState({
      phase: 'playing',
      roundNumber: 2,
      chain: [],
      chainEnds: [-1, -1],
      boneyard: [],
      players: [
        { name: 'Tester', hand: [[2, 3]], score: 0, cumulativeScore: 0, isBot: false },
        { name: 'Bot 1', hand: [[4, 4]], score: 0, cumulativeScore: 0, isBot: true },
      ],
      currentPlayerIndex: 0,
      selectedTileIndex: -1,
      playerCount: 2,
      lastEvent: null,
    });

    vi.advanceTimersByTime(4000);

    const state = useClassicGameStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.chain).toEqual([]);
    expect(state.players[0].hand).toEqual([[2, 3]]);
    expect(state.lastEvent).toBeNull();
  });

  it('restores playing phase when the human turn is stranded on bot_thinking', () => {
    useClassicGameStore.setState({
      phase: 'bot_thinking',
      gameMode: 'bot',
      chain: [],
      chainEnds: [-1, -1],
      boneyard: [],
      players: [
        { name: 'Tester', hand: [[2, 3]], score: 0, cumulativeScore: 0, isBot: false },
        { name: 'Bot 1', hand: [[4, 4]], score: 0, cumulativeScore: 0, isBot: true },
      ],
      currentPlayerIndex: 0,
      selectedTileIndex: -1,
      roundNumber: 2,
      targetScore: 100,
      botDifficulty: 'hard',
      passCount: 0,
      lastEvent: null,
      playerCount: 2,
      lastRoundSummary: null,
    });

    useClassicGameStore.getState().selectTile(0);

    const state = useClassicGameStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.selectedTileIndex).toBe(0);
  });
});
