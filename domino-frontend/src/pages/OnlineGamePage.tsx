import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { canPlayTile, getPlayableEnds, hasPlayableTile } from '@/utils/classicGameEngine';
import { playDropSound, playCaptureSound, playSelectSound } from '@/utils/soundEffects';
import { ArrowLeft, ArrowRight, Layers, SkipForward, LogOut } from 'lucide-react';

function DotPattern({ count }: { count: number }) {
  const positions: Record<number, [number, number][]> = {
    0: [],
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 25], [50, 50], [70, 75]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 25], [70, 25], [50, 50], [30, 75], [70, 75]],
    6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
  };
  const pos = positions[count] || [];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {pos.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={9} className="fill-[hsl(var(--tile-dot))]" />
      ))}
    </svg>
  );
}

export default function OnlineGamePage() {
  const navigate = useNavigate();
  const state = useOnlineGameStore();
  const { connected, gameVariant } = useOnlineStore();

  useEffect(() => {
    if (state.phase === 'idle' && !state.myPlayerId) navigate('/online');
  }, [state.phase, state.myPlayerId, navigate]);

  useEffect(() => {
    if (state.phase === 'round_end' || state.phase === 'game_over') navigate('/online/score');
  }, [state.phase, navigate]);

  const isClassic = gameVariant === 'classic' || state.variant === 'classic';

  if (isClassic) {
    return <OnlineClassicGame connected={connected} />;
  }

  return <OnlineKoutchinaGame connected={connected} />;
}

function OnlineKoutchinaGame({ connected }: { connected: boolean }) {
  const navigate = useNavigate();
  const state = useOnlineGameStore();
  const { sendAction, sendDrop, leaveRoom } = useSocket();
  const [invalidPulse, setInvalidPulse] = useState(false);

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
    const hasSelection = state.selectedTableTiles.length > 0 || state.selectedBonbonaTiles.length > 0;
    if (!hasSelection) return;
    playCaptureSound();
    const bonbonaRequested = state.selectedBonbonaTiles.length > 0;
    sendAction({
      selectedTiles: state.selectedTableTiles as [number, number][],
      bonbonaTiles: state.selectedBonbonaTiles as [number, number][],
      bonbona: bonbonaRequested,
    });
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
      <GameEffects event={state.lastEvent as any} />
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
              basraTiles={state.opponent.basraTiles}
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
        </div>

        {/* Player row */}
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex-shrink-0">
            <WinPile
              label="مكسبي"
              tiles={state.me.winPile}
              isMine={true}
              reverse={false}
              basraTiles={state.me.basraTiles}
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

function OnlineClassicGame({ connected }: { connected: boolean }) {
  const navigate = useNavigate();
  const state = useOnlineGameStore();
  const { sendAction, leaveRoom } = useSocket();
  const [showEndChoice, setShowEndChoice] = useState(false);
  const [pendingTileIndex, setPendingTileIndex] = useState<number | null>(null);

  useEffect(() => {
    if (state.lastEvent?.type === 'invalid') {
      const t = setTimeout(() => state.clearEvent(), 2000);
      return () => clearTimeout(t);
    }
  }, [state.lastEvent]);

  useEffect(() => {
    if (state.lastEvent && state.lastEvent.type !== 'invalid') {
      const t = setTimeout(() => state.clearEvent(), 1500);
      return () => clearTimeout(t);
    }
  }, [state.lastEvent]);

  const currentPlayer = state.classicPlayers.find(p => p.id === state.currentPlayerId);
  const isMyTurn = state.isMyTurn && state.phase === 'playing';
  const myHand = state.myHandClassic;
  const canDraw = isMyTurn && state.boneyardCount > 0 && !hasPlayableTile(myHand, state.chainEnds);
  const canPass = isMyTurn && state.boneyardCount === 0 && !hasPlayableTile(myHand, state.chainEnds);

  const otherPlayers = state.classicPlayers.filter(p => p.id !== state.myPlayerId);

  let statusText: string | undefined;
  let statusPulse = false;
  if (state.phase === 'playing' && currentPlayer) {
    if (currentPlayer.id === state.myPlayerId) {
      statusText = 'دورك!';
    } else {
      statusText = `دور ${currentPlayer.name}`;
      statusPulse = true;
    }
  }

  const handleTileSelect = (index: number) => {
    if (!isMyTurn) return;
    const tile = myHand[index];
    if (!tile) return;
    playSelectSound();

    const wasSelected = state.selectedTileIndex === index;
    const playable = canPlayTile(tile, state.chainEnds);
    state.selectTile(index);
    if (wasSelected) return;

    if (!playable) return;

    const ends = getPlayableEnds(tile, state.chainEnds);
    if (ends.length === 1 || state.chain.length === 0) {
      setTimeout(() => {
        playDropSound();
        sendAction({ type: 'play', tileIndex: index, end: ends[0] });
      }, 150);
    } else {
      setPendingTileIndex(index);
      setShowEndChoice(true);
    }
  };

  const handlePlayEnd = (end: 'left' | 'right') => {
    if (pendingTileIndex === null) return;
    playDropSound();
    sendAction({ type: 'play', tileIndex: pendingTileIndex, end });
    setShowEndChoice(false);
    setPendingTileIndex(null);
  };

  const handleDraw = () => {
    playCaptureSound();
    sendAction({ type: 'draw' });
  };

  const handlePass = () => {
    sendAction({ type: 'pass' });
  };

  const handleExit = () => {
    leaveRoom();
    state.resetOnlineGame();
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative" dir="rtl">
      <ChatPanel />

      {/* Event overlay */}
      <AnimatePresence>
        {state.lastEvent && state.lastEvent.type === 'block' && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="px-6 py-3 rounded-2xl bg-card/90 border border-primary/30 backdrop-blur-sm"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
            >
              <p className="text-lg font-arabic font-bold text-primary">
                اللعبة مقفلة!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invalid message */}
      <AnimatePresence>
        {state.lastEvent?.type === 'invalid' && (
          <motion.div
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-destructive/90 text-destructive-foreground text-sm font-arabic"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {state.lastEvent.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar - all player scores */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button
          onClick={handleExit}
          className="w-11 h-11 rounded-full bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground min-w-[44px] min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
          {state.classicPlayers.map((p) => (
            <motion.div
              key={p.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-arabic transition-all ${
                p.id === state.currentPlayerId
                  ? 'bg-primary/15 border border-primary/40 text-primary'
                  : 'bg-secondary/60 border border-border/50 text-muted-foreground'
              }`}
              animate={p.id === state.currentPlayerId ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="font-bold truncate max-w-[70px]">{p.name}</span>
              <span className="font-mono font-bold">{p.cumulativeScore}</span>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-mono">R{state.roundNumber}</span>
          {connected ? null : <span className="text-destructive">•</span>}
        </div>
      </div>

      {/* Status */}
      {statusText && (
        <motion.div
          className="text-center py-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className={`text-xs font-arabic text-primary ${statusPulse ? 'animate-pulse' : ''}`}>
            {statusText}
          </span>
        </motion.div>
      )}

      {/* Opponent hands (face down) */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 flex-wrap">
        {otherPlayers.map((op) => (
          <div key={op.id} className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(op.handCount, 10) }).map((_, hi) => (
                <motion.div
                  key={hi}
                  className="w-10 h-20 rounded-sm border border-border/50 diamond-pattern"
                  style={{ background: 'hsl(var(--tile-back))' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: hi * 0.02 }}
                />
              ))}
              {op.handCount > 10 && (
                <span className="text-[9px] font-mono text-muted-foreground/60">+{op.handCount - 10}</span>
              )}
            </div>
            <span className="text-[10px] font-arabic text-muted-foreground">
              {op.name} ({op.handCount})
            </span>
          </div>
        ))}
      </div>

      {/* Chain area + Boneyard */}
      <div className="flex-1 flex mx-2 my-1 gap-1.5 overflow-hidden">
        {state.boneyardCount > 0 && (
          <div className="flex flex-col items-center gap-1 py-2 px-1">
            <div className="flex flex-col items-center gap-0.5 max-h-full overflow-y-auto scrollbar-hide">
              {Array.from({ length: Math.min(6, state.boneyardCount) }).map((_, bi) => (
                <motion.div
                  key={bi}
                  className="w-6 h-9 rounded-sm border border-border/50 diamond-pattern flex-shrink-0"
                  style={{ background: 'hsl(var(--tile-back))' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: bi * 0.03 }}
                />
              ))}
              {state.boneyardCount > 6 && (
                <span className="text-[9px] font-mono text-muted-foreground/60">+{state.boneyardCount - 6}</span>
              )}
            </div>
            <div className="flex items-center gap-1 bg-card/80 rounded-lg px-2 py-0.5 border border-border/50">
              <Layers className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">{state.boneyardCount}</span>
            </div>
          </div>
        )}

        <div className="flex-1 felt-bg rounded-xl flex flex-col relative overflow-hidden" style={{ minHeight: 0 }}>
          <ChainArea chain={state.chain} chainEnds={state.chainEnds} />

          <AnimatePresence>
            {showEndChoice && pendingTileIndex !== null && (
              <motion.div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm z-30 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEndChoice(false)}
              >
                <motion.div
                  className="flex gap-4"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.8 }}
                  onClick={e => e.stopPropagation()}
                >
                  <motion.button
                    className="flex flex-col items-center gap-2 px-6 py-4 bg-card border border-primary/30 rounded-2xl hover:border-primary transition-colors"
                    onClick={() => handlePlayEnd('right')}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ArrowRight className="w-6 h-6 text-primary" />
                    <span className="text-sm font-arabic text-foreground">يمين</span>
                  </motion.button>
                  <motion.button
                    className="flex flex-col items-center gap-2 px-6 py-4 bg-card border border-primary/30 rounded-2xl hover:border-primary transition-colors"
                    onClick={() => handlePlayEnd('left')}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ArrowLeft className="w-6 h-6 text-primary" />
                    <span className="text-sm font-arabic text-foreground">شمال</span>
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 px-4 py-2">
        {canDraw && (
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 bg-accent/20 border border-accent/30 text-accent rounded-xl font-arabic text-sm font-bold"
            onClick={handleDraw}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Layers className="w-4 h-4" />
            اسحب ({state.boneyardCount})
          </motion.button>
        )}
        {canPass && (
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 bg-destructive/20 border border-destructive/30 text-destructive rounded-xl font-arabic text-sm font-bold"
            onClick={handlePass}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.95 }}
          >
            <SkipForward className="w-4 h-4" />
            تمرير
          </motion.button>
        )}
      </div>

      {/* Player hand */}
      <div className="px-2 pb-3 pt-1">
        <div className="overflow-x-auto flex items-center justify-center scrollbar-hide">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {myHand.map((tile, i) => {
              const playable = isMyTurn && canPlayTile(tile, state.chainEnds);
              const selected = state.selectedTileIndex === i;

              return (
                <motion.button
                  key={`${tile[0]}-${tile[1]}-${i}`}
                  className={`flex flex-col w-10 h-20 tile-face rounded-lg border-2 shadow-md overflow-hidden transition-all ${
                    selected
                      ? 'border-primary gold-glow -translate-y-2'
                      : playable
                        ? 'border-accent/50 hover:border-accent'
                        : 'border-border/30 opacity-60'
                  }`}
                  onClick={() => handleTileSelect(i)}
                  whileTap={{ scale: 0.95 }}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: selected ? -8 : 0, opacity: playable || selected ? 1 : 0.6 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="flex-1 p-0.5">
                    <DotPattern count={tile[0]} />
                  </div>
                  <div className="w-8 mx-auto h-px bg-[hsl(var(--tile-divider))]" />
                  <div className="flex-1 p-0.5">
                    <DotPattern count={tile[1]} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
        <p className="text-center text-xs font-arabic text-muted-foreground mt-1">
          {state.classicPlayers.find(p => p.id === state.myPlayerId)?.name || 'أنت'} ({myHand.length} قطعة)
        </p>
      </div>
    </div>
  );
}
