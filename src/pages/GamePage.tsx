import { useState, useEffect } from 'react';
import { motion } from 'framer-motion'; // force rebuild
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import PlayerHand from '@/components/game/PlayerHand';
import TableArea from '@/components/game/TableArea';
import WinPile from '@/components/game/WinPile';
import GameEffects from '@/components/game/GameEffects';
import GameTopBar from '@/components/game/GameTopBar';
import { getTileHandValue, isJokerTile, isWaladTile } from '@/utils/gameEngine';
import { playDropSound, playCaptureSound, playSelectSound } from '@/utils/soundEffects';

export default function GamePage() {
  const navigate = useNavigate();
  const state = useGameStore();
  const [invalidPulse, setInvalidPulse] = useState(false);

  useEffect(() => {
    if (state.phase === 'idle') navigate('/home');
  }, [state.phase, navigate]);

  useEffect(() => {
    if (state.phase === 'round_end' || state.phase === 'game_over') {
      navigate('/score');
    }
  }, [state.phase, navigate]);

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

  if (state.phase === 'round_end' || state.phase === 'game_over' || state.phase === 'idle') {
    return <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />;
  }

  const isFriend = state.gameMode === 'friend';
  const isPlayerTurn = state.currentPlayerId === 'player';
  const isOpponentTurn = state.currentPlayerId === 'opponent';
  const canAct = state.phase === 'playing' && (isFriend || isPlayerTurn);
  const currentPlayer = state[state.currentPlayerId];
  const activeTile = currentPlayer.hand[state.activeCardIndex];
  const isJoker = activeTile ? isJokerTile(activeTile) : false;
  const isWalad = activeTile ? isWaladTile(activeTile) : false;
  const activeValue = activeTile ? getTileHandValue(activeTile) : 0;

  const handleActiveCardClick = () => {
    if (!canAct || !activeTile) return;
    if (isJoker && state.table.length > 0) {
      state.confirmCapture();
      return;
    }
    playDropSound();
    state.dropTile();
  };

  const handleConfirmCapture = () => {
    playCaptureSound();
    state.confirmCapture();
  };

  const handleSelectTable = (tile: any) => {
    playSelectSound();
    state.selectTableTile(tile);
  };

  const handleSelectBonbona = (tile: any) => {
    playSelectSound();
    state.selectBonbonaTile(tile);
  };

  const playerHandVisible = isFriend ? isPlayerTurn : true;
  const opponentHandVisible = isFriend ? isOpponentTurn : false;

  // Status text
  let statusText: string | undefined;
  let statusPulse = false;
  if (state.phase === 'bot_thinking') {
    statusText = 'البوت يفكر...';
    statusPulse = true;
  } else if (isFriend && state.phase === 'playing') {
    statusText = `دور ${currentPlayer.name}`;
  }

  const showConfirm = canAct && (state.selectedTableTiles.length > 0 || state.selectedBonbonaTiles.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative" dir="rtl">
      <GameEffects event={state.lastEvent} />

      <GameTopBar
        player={{ name: state.player.name, score: state.player.cumulativeScore }}
        opponent={{ name: state.opponent.name, score: state.opponent.cumulativeScore }}
        roundNumber={state.roundNumber}
        statusText={statusText}
        statusPulse={statusPulse}
        onExit={() => { state.resetGame(); navigate('/home'); }}
      />

      {/* Main game area */}
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
              basraTiles={state.opponent.basraTiles}
              onTileTap={canAct ? handleSelectBonbona : undefined}
            />
          </div>
          <div className="flex-shrink-0">
            <PlayerHand
              hand={state.opponent.hand}
              activeIndex={isOpponentTurn ? state.activeCardIndex : -1}
              isPlayer={opponentHandVisible}
              label={`${state.opponent.name} (${state.opponent.hand.length})`}
              onActiveClick={isOpponentTurn && isFriend ? handleActiveCardClick : undefined}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 flex flex-col justify-center px-3 py-2 gap-2">
          <TableArea
            tiles={state.table}
            selectedTiles={state.selectedTableTiles}
            canSelect={canAct && !isJoker}
            onToggleTile={handleSelectTable}
            invalidPulse={invalidPulse}
            isWaladActive={isWalad}
            showConfirm={showConfirm}
            onConfirm={handleConfirmCapture}
            activeValue={activeValue}
            isJoker={isJoker}
            tableEmpty={state.table.length === 0}
            canAct={canAct}
            onDrop={canAct ? handleActiveCardClick : undefined}
          />
        </div>

        {/* Player row */}
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex-shrink-0">
            <WinPile
              label="مكسبي"
              tiles={state.player.winPile}
              isMine={true}
              reverse={false}
              basraTiles={state.player.basraTiles}
            />
          </div>
          <div className="flex-shrink-0">
            <PlayerHand
              hand={state.player.hand}
              activeIndex={isPlayerTurn ? state.activeCardIndex : -1}
              isPlayer={playerHandVisible}
              label={`${state.player.name} (${state.player.hand.length})`}
              onActiveClick={isPlayerTurn ? handleActiveCardClick : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
