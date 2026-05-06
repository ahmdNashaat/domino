import { afterEach, describe, expect, it } from 'vitest';
import { useOnlineGameStore } from './onlineGameStore';

describe('useOnlineGameStore', () => {
  afterEach(() => {
    useOnlineGameStore.getState().resetOnlineGame();
  });

  it('only allows classic tile selection while it is my turn in playing phase', () => {
    useOnlineGameStore.setState({
      variant: 'classic',
      phase: 'playing',
      isMyTurn: false,
      selectedTileIndex: -1,
    });

    useOnlineGameStore.getState().selectTile(2);
    expect(useOnlineGameStore.getState().selectedTileIndex).toBe(-1);

    useOnlineGameStore.setState({ isMyTurn: true, phase: 'round_end' });
    useOnlineGameStore.getState().selectTile(2);
    expect(useOnlineGameStore.getState().selectedTileIndex).toBe(-1);

    useOnlineGameStore.setState({ phase: 'playing' });
    useOnlineGameStore.getState().selectTile(2);
    expect(useOnlineGameStore.getState().selectedTileIndex).toBe(2);

    useOnlineGameStore.getState().selectTile(2);
    expect(useOnlineGameStore.getState().selectedTileIndex).toBe(-1);
  });
});
