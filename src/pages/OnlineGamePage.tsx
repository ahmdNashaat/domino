import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnlineGameStore } from '@/store/onlineGameStore';
import { useOnlineStore } from '@/store/onlineStore';
import { useSocket } from '@/hooks/useSocket';
import PlayerHand from '@/components/game/PlayerHand';
import TableArea from '@/components/game/TableArea';
import ChainArea from '@/components/game/ChainArea';
import WinPile from '@/components/game/WinPile';
import GameEffects from '@/components/game/GameEffects';
import GameTopBar from '@/components/game/GameTopBar';
import ChatPanel from '@/components/game/ChatPanel';
import { getTileHandValue, isJokerTile, isWaladTile } from '@/utils/gameEngine';
import { playDropSound, playCaptureSound, playSelectSound } from '@/utils/soundEffects';

export default function OnlineGamePage() {
  const navigate = useNavigate();
  const state = useOnlineGameStore();
  const { connected } = useOnlineStore();
  const { sendAction, sendDrop, leaveRoom } = useSocket();
  const [invalidPulse, setInvalidPulse] = useState(false);

  useEffect(() => {
    if (state.phase === 'idle' && !state.myPlayerId) navigate('/online');
  }, [state.phase, state.myPlayerId, navigate]);

  useEffect(() => {
    if (state.lastEvent?.type === 'invalid') {
      setInvalidPulse(true);
      const t = setTimeout(() => setInvalidPulse(false), 500);
      return () => clearTimeout(t);
    }
  }, [state.lastEvent]);

  useEffect(() => {
    if (state.lastEvent && state.lastEvent.type !== 'invalid') {
      const t = setTimeout(() => state.clearEvent(), 2000);
      return () => clearTimeout(t);
    }
  }, [state.lastEvent]);

  useEffect(() => {
    if (state.phase === 'round_end' || state.phase === 'game_over') navigate('/online/score');
  }, [state.phase, navigate]);

  const activeTile = state.me.hand[state.activeCardIndex];
  const isJoker = activeTile ? isJokerTile(activeTile) : false;
  const isWalad = activeTile ? isWaladTile(activeTile) : false;
  const activeValue = activeTile ? getTileHandValue(activeTile) : 0;
  const canAct = state.isMyTurn && state.phase === 'playing';

  const handleActiveCardClick = useCallback(() => {
    if (!canAct || !activeTile) return;
    if (isJoker && state.table.length > 0) {
      playCaptureSound();
      sendAction({ selectedTiles: state.table.map(t => t as [number, number]) });
      state.clearSelections();
      return;
    }
    playDropSound();
    sendAction({ selectedTiles: [] });
    state.clearSelections();
  }, [canAct, activeTile, isJoker, state.table, sendAction]);

  const handleConfirm = useCallback(() => {
    if (!canAct) return;
    const allSelected = [...state.selectedTableTiles, ...state.selectedBonbonaTiles];
    if (allSelected.length === 0) return;
    playCaptureSound();
    sendAction({ selectedTiles: allSelected as [number, number][], bonbonaTiles: state.selectedBonbonaTiles as [number, number][] });
    state.clearSelections();
  }, [canAct, state.selectedTableTiles, state.selectedBonbonaTiles, sendAction]);

  const handleExit = useCallback(() => {
    leaveRoom();
    state.resetOnlineGame();
    navigate('/home');
  }, [leaveRoom, navigate]);

  const opponentFakeHand: [number, number][] = Array.from(
    { length: state.opponent.handCount },
    () => [0, 0] as [number, number]
  );

  let statusText: string | undefined;
  let statusPulse = false;
  if (!state.isMyTurn && state.phase === 'playing') {
    statusText = 'دور الخصم...';
    statusPulse = true;
  } else if (state.isMyTurn && state.phase === 'playing') {
    statusText = 'دورك! 🎯';
  }

  const showConfirm = canAct && (state.selectedTableTiles.length > 0 || state.selectedBonbonaTiles.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative" dir="rtl">
      <GameEffects event={state.lastEvent} />
      <ChatPanel />

      <GameTopBar
        player={{ name: state.me.name, score: state.me.cumulativeScore }}
        opponent={{ name: state.opponent.name, score: state.opponent.cumulativeScore }}
        roundNumber={state.roundNumber}
        statusText={statusText}
        statusPulse={statusPulse}
        onExit={handleExit}
        isOnline
        connected={connected}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Opponent row */}
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="flex-shrink-0">
            <WinPile
              label={`مكسب ${state.opponent.name}`}
              tiles={state.opponent.winPile}
              isMine={false}
              reverse={false}
              selectedBonbonaTiles={state.selectedBonbonaTiles}
              onTileTap={canAct ? (tile) => { playSelectSound(); state.selectBonbonaTile(tile); } : undefined}
            />
          </div>
          <div className="flex-shrink-0">
            <PlayerHand
              hand={opponentFakeHand}
              activeIndex={-1}
              isPlayer={false}
              label={`${state.opponent.name} (${state.opponent.handCount})`}
            />
          </div>
        </div>

        {/* Table/Chain */}
        <div className="flex-1 flex flex-col justify-center px-3 py-2 gap-2">
          {state.variant === 'classic' ? (
            <ChainArea
              chain={state.chain}
              chainEnds={state.chainEnds}
            />
          ) : (
            <TableArea
              tiles={state.table}
              selectedTiles={state.selectedTableTiles}
              canSelect={canAct && !isJoker}
              onToggleTile={(tile) => { playSelectSound(); state.selectTableTile(tile); }}
              invalidPulse={invalidPulse}
              isWaladActive={isWalad}
              showConfirm={showConfirm}
              onConfirm={handleConfirm}
              activeValue={activeValue}
              isJoker={isJoker}
              tableEmpty={state.table.length === 0}
              canAct={canAct}
              onDrop={canAct ? handleActiveCardClick : undefined}
            />
          )}
        </div>

        {/* Player row */}
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex-shrink-0">
            <WinPile
              label="مكسبي"
              tiles={state.me.winPile}
              isMine={true}
              reverse={false}
            />
          </div>
          <div className="flex-shrink-0">
            <PlayerHand
              hand={state.me.hand}
              activeIndex={state.isMyTurn ? state.activeCardIndex : -1}
              isPlayer={true}
              label={`${state.me.name} (${state.me.hand.length})`}
              onActiveClick={state.isMyTurn ? handleActiveCardClick : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
