import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useClassicGameStore } from '@/store/classicGameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { canPlayTile, getPlayableEnds, hasPlayableTile } from '@/utils/classicGameEngine';
import ChainArea from '@/components/game/ChainArea';
import type { ChainEnd, DominoTile as DominoTileType } from '@/types/contracts';
import { Layers, SkipForward, LogOut } from 'lucide-react';
import { playDropSound, playCaptureSound, playSelectSound } from '@/utils/soundEffects';
import DominoTile from '@/components/game/DominoTile';
import ClassicPlayerZone from '@/components/game/ClassicPlayerZone';
import { clearScoreSnapshot, saveScoreSnapshot } from '@/utils/scoreSnapshot';
import { useIsMobile } from '@/hooks/use-mobile';

const BOT_AVATARS = ['🦁', '🐉', '⚡', '🎯'];

type PlayerActionState = {
  action: 'play' | 'draw' | 'pass' | null;
  tile?: DominoTileType;
};

type DrawAnim = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  key: number;
};

// ── Helper: does this tile need the player to choose an end? ──
// Only ask when:
//   1. The tile fits on BOTH ends
//   2. The two ends have DIFFERENT values (otherwise it doesn't matter)
function needsEndChoice(tile: DominoTileType, chainEnds: [number, number], chainLength: number): boolean {
  if (chainLength === 0) return false;                          // first tile — no ends yet
  const ends = getPlayableEnds(tile, chainEnds);
  if (ends.length < 2) return false;                           // only one end available
  if (chainEnds[0] === chainEnds[1]) return false;             // both ends same value — random OK
  return true;                                                  // different ends → ask
}

export default function ClassicGamePage() {
  const navigate = useNavigate();
  const state = useClassicGameStore();
  const { playerAvatar } = useSettingsStore();
  const isMobile = useIsMobile();

  // showEndChoice = waiting for player to click a chain end
  const [showEndChoice, setShowEndChoice] = useState(false);

  const [actionMap, setActionMap] = useState<Record<number, PlayerActionState>>({});
  const [drawAnim, setDrawAnim] = useState<DrawAnim | null>(null);
  const redirectRef = useRef(false);
  const idleRedirectRef = useRef(false);
  const actionTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const boneyardRef = useRef<HTMLDivElement>(null);
  const topZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const bottomZoneRef = useRef<HTMLDivElement>(null);

  const phaseTerminal = state.phase === 'round_end' || state.phase === 'game_over';

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

  useEffect(() => {
    const event = state.lastEvent;
    if (!event || event.type === 'invalid' || event.type === 'block') return;
    if (event.type !== 'play' && event.type !== 'draw' && event.type !== 'pass') return;

    const action = event.type;
    setActionMap(prev => ({
      ...prev,
      [event.playerIndex]: {
        action,
        tile: event.type === 'play' ? event.tile : undefined,
      },
    }));

    if (actionTimers.current[event.playerIndex]) {
      clearTimeout(actionTimers.current[event.playerIndex]);
    }
    actionTimers.current[event.playerIndex] = setTimeout(() => {
      setActionMap(prev => ({
        ...prev,
        [event.playerIndex]: { action: null },
      }));
    }, 2000);
  }, [state.lastEvent]);

  useEffect(() => {
    return () => {
      Object.values(actionTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const currentIdx = state.currentPlayerIndex;
  const currentPlayer = state.players[currentIdx];
  const isFriend = state.gameMode === 'friend';
  const bottomIndex = isFriend ? currentIdx : 0;
  const isHumanTurn = currentIdx === 0;
  const canAct = state.phase === 'playing' && (isFriend || isHumanTurn);
  const playerCount = state.players.length;

  const rotatedIndices = useMemo(
    () => Array.from({ length: playerCount }, (_, i) => (bottomIndex + i) % playerCount),
    [playerCount, bottomIndex]
  );

  const zoneRefByIndex = useMemo(() => {
    const refBySeatIndex: Record<number, React.RefObject<HTMLDivElement>> = isMobile
      ? { 0: bottomZoneRef, 1: topZoneRef, 2: topZoneRef, 3: topZoneRef }
      : {
          0: bottomZoneRef,
          1: playerCount === 2 ? topZoneRef : rightZoneRef,
          2: topZoneRef,
          3: leftZoneRef,
        };
    const map: Record<number, React.RefObject<HTMLDivElement>> = {};
    rotatedIndices.forEach((playerIndex, seatIdx) => {
      map[playerIndex] = refBySeatIndex[seatIdx];
    });
    return map;
  }, [isMobile, playerCount, rotatedIndices]);

  useEffect(() => {
    const event = state.lastEvent;
    if (!event || event.type !== 'draw') return;
    const targetRef = zoneRefByIndex[event.playerIndex];
    if (!targetRef?.current || !boneyardRef.current || !boardRef.current) return;

    const rootRect = boardRef.current.getBoundingClientRect();
    const fromRect = boneyardRef.current.getBoundingClientRect();
    const toRect = targetRef.current.getBoundingClientRect();

    setDrawAnim({
      from: { x: fromRect.left - rootRect.left + fromRect.width / 2, y: fromRect.top - rootRect.top + fromRect.height / 2 },
      to: { x: toRect.left - rootRect.left + toRect.width / 2, y: toRect.top - rootRect.top + toRect.height / 2 },
      key: Date.now(),
    });
  }, [state.lastEvent, zoneRefByIndex]);

  useEffect(() => {
    if (state.phase === 'idle') {
      if (!idleRedirectRef.current) {
        idleRedirectRef.current = true;
        navigate('/home', { replace: true });
      }
      return;
    }
    idleRedirectRef.current = false;
  }, [state.phase, navigate]);

  useEffect(() => {
    if (!phaseTerminal) { redirectRef.current = false; return; }
    if (redirectRef.current) return;
    redirectRef.current = true;

    const snapshot = {
      phase: state.phase === 'game_over' ? 'game_over' : 'round_end',
      players: state.players,
      targetScore: state.targetScore,
      roundNumber: state.roundNumber,
    };
    saveScoreSnapshot('scoreSnapshot:classic', snapshot);
    navigate('/classic-score', { state: { lastRoundSummary: snapshot } });
  }, [phaseTerminal, state.phase, state.players, state.targetScore, state.roundNumber, navigate]);

  const displayHand = state.players[bottomIndex]?.hand || [];
  const rotatedPlayers = useMemo(
    () => rotatedIndices.map(i => state.players[i]),
    [rotatedIndices, state.players]
  );

  const bottomSeat = rotatedPlayers[0];
  const bottomSeatIndex = rotatedIndices[0];
  const rightSeat = !isMobile && playerCount >= 3 ? rotatedPlayers[1] : null;
  const rightSeatIndex = !isMobile && playerCount >= 3 ? rotatedIndices[1] : null;
  const topSeat = !isMobile ? (playerCount === 2 ? rotatedPlayers[1] : rotatedPlayers[2] || null) : null;
  const topSeatIndex = !isMobile ? (playerCount === 2 ? rotatedIndices[1] : rotatedIndices[2] ?? null) : null;
  const leftSeat = !isMobile && playerCount >= 4 ? rotatedPlayers[3] : null;
  const leftSeatIndex = !isMobile && playerCount >= 4 ? rotatedIndices[3] : null;
  const topBots = isMobile ? rotatedPlayers.slice(1) : [];
  const topBotIndices = isMobile ? rotatedIndices.slice(1) : [];

  const avatarForIndex = (idx: number) =>
    idx === bottomIndex ? playerAvatar : BOT_AVATARS[(idx - 1 + BOT_AVATARS.length) % BOT_AVATARS.length];

  if (phaseTerminal || state.phase === 'idle') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground font-arabic">جاري عرض نتيجة الجولة...</p>
      </div>
    );
  }

  const displayChainEnds = state.chainEnds;
  const canDraw = canAct && state.boneyard.length > 0 && !hasPlayableTile(currentPlayer.hand, displayChainEnds);
  const canPass = canAct && state.boneyard.length === 0 && !hasPlayableTile(currentPlayer.hand, displayChainEnds);

  let statusText: string | undefined;
  let statusPulse = false;
  if (state.phase === 'bot_thinking') {
    statusText = 'البوت يفكر...';
    statusPulse = true;
  } else if (isFriend && state.phase === 'playing') {
    statusText = `دور ${currentPlayer.name}`;
  }

  // ── Tile select handler ──────────────────────────────────────
  const handleTileSelect = (index: number) => {
    if (!canAct) return;
    playSelectSound();

    const hand = state.players[bottomIndex].hand;
    const tile = hand[index];
    if (!canPlayTile(tile, displayChainEnds)) {
      state.selectTile(index);
      return;
    }

    const ends = getPlayableEnds(tile, displayChainEnds);
    state.selectTile(index);

    if (needsEndChoice(tile, displayChainEnds, state.chain.length)) {
      // Show glow on chain ends — player clicks the end they want
      setShowEndChoice(true);
    } else {
      // Auto-play: one end OR both ends same value → pick randomly among valid
      setTimeout(() => {
        playDropSound();
        const s = useClassicGameStore.getState();
        if (s.selectedTileIndex === index) {
          const randomEnd = ends[Math.floor(Math.random() * ends.length)] as ChainEnd;
          s.playTile(randomEnd);
        }
      }, 150);
    }
  };

  // Called when player clicks a highlighted chain-end tile
  const handleEndClick = (end: ChainEnd) => {
    if (!showEndChoice || state.selectedTileIndex < 0) return;
    playDropSound();
    state.playTile(end);
    setShowEndChoice(false);
  };

  // Cancel end choice if player clicks elsewhere
  const handleCancelEndChoice = () => {
    setShowEndChoice(false);
    state.selectTile(-1); // deselect
  };

  const handleDraw = () => {
    playCaptureSound();
    state.drawFromBoneyard();
  };

  return (
    <div
      ref={boardRef}
      className="min-h-screen bg-background flex flex-col overflow-hidden relative"
      dir="rtl"
      onClick={showEndChoice ? handleCancelEndChoice : undefined}
    >
      {/* Block/event overlay */}
      <AnimatePresence>
        {state.lastEvent?.type === 'block' && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="px-6 py-3 rounded-2xl bg-card/90 border border-primary/30 backdrop-blur-sm"
              initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}
            >
              <p className="text-lg font-arabic font-bold text-primary">اللعبة مقفلة!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invalid message */}
      <AnimatePresence>
        {state.lastEvent?.type === 'invalid' && (
          <motion.div
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-destructive/90 text-destructive-foreground text-sm font-arabic"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            {state.lastEvent.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draw animation */}
      <AnimatePresence>
        {drawAnim && (
          <motion.div
            key={drawAnim.key}
            className="absolute z-40 rounded-sm border border-border/60 diamond-pattern"
            style={{ width: 18, height: 32, background: 'hsl(var(--tile-back))' }}
            initial={{ x: drawAnim.from.x - 9, y: drawAnim.from.y - 16, opacity: 1 }}
            animate={{ x: drawAnim.to.x - 9, y: drawAnim.to.y - 16, opacity: 0 }}
            transition={{ duration: 0.4 }}
            onAnimationComplete={() => setDrawAnim(null)}
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button
          onClick={() => { clearScoreSnapshot('scoreSnapshot:classic'); state.resetGame(); navigate('/home'); }}
          className="w-11 h-11 rounded-full bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground min-w-[44px] min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 flex-1 justify-center">
          {state.players.map((p, i) => (
            <motion.div
              key={i}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-arabic transition-all ${
                i === currentIdx
                  ? 'bg-primary/15 border border-primary/40 text-primary'
                  : 'bg-secondary/60 border border-border/50 text-muted-foreground'
              }`}
              animate={i === currentIdx ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="font-bold truncate max-w-[60px]">{p.name}</span>
              <span className="font-mono font-bold">{p.cumulativeScore}</span>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-mono">R{state.roundNumber}</span>
        </div>
      </div>

      {/* Status */}
      {statusText && (
        <motion.div className="text-center py-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span className={`text-xs font-arabic text-primary ${statusPulse ? 'animate-pulse' : ''}`}>
            {statusText}
          </span>
        </motion.div>
      )}

      {/* Board layout */}
      <div className="flex-1 flex flex-col overflow-hidden px-2 pb-2">
        {/* Top player(s) */}
        <div className="flex items-center justify-center pt-2">
          {isMobile ? (
            <div ref={topZoneRef} className="flex items-center justify-center gap-2 flex-wrap">
              {topBots.map((seat, idx) => {
                const playerIndex = topBotIndices[idx];
                if (playerIndex === undefined) return null;
                return (
                  <ClassicPlayerZone
                    key={`${seat.name}-${playerIndex}`}
                    position="top"
                    avatar={avatarForIndex(playerIndex)}
                    name={seat.name}
                    cardCount={seat.hand.length}
                    isCurrentTurn={playerIndex === currentIdx}
                    lastAction={actionMap[playerIndex]?.action ?? null}
                    lastPlayedTile={actionMap[playerIndex]?.tile}
                  />
                );
              })}
            </div>
          ) : (
            topSeat && topSeatIndex !== null && (
              <ClassicPlayerZone
                ref={topZoneRef}
                position="top"
                avatar={avatarForIndex(topSeatIndex)}
                name={topSeat.name}
                cardCount={topSeat.hand.length}
                isCurrentTurn={topSeatIndex === currentIdx}
                lastAction={actionMap[topSeatIndex]?.action ?? null}
                lastPlayedTile={actionMap[topSeatIndex]?.tile}
              />
            )
          )}
        </div>

        <div className="flex-1 flex items-stretch gap-2 mt-2">
          {/* Left player */}
          {leftSeat && leftSeatIndex !== null && (
            <div className="flex items-center justify-center">
              <ClassicPlayerZone
                ref={leftZoneRef}
                position="left"
                avatar={avatarForIndex(leftSeatIndex)}
                name={leftSeat.name}
                cardCount={leftSeat.hand.length}
                isCurrentTurn={leftSeatIndex === currentIdx}
                lastAction={actionMap[leftSeatIndex]?.action ?? null}
                lastPlayedTile={actionMap[leftSeatIndex]?.tile}
              />
            </div>
          )}

          {/* Table */}
          <div
            className="flex-1 felt-bg rounded-xl flex flex-col relative overflow-hidden"
            style={{ minHeight: 0 }}
            onClick={e => e.stopPropagation()} // prevent cancel when clicking table
          >
            {state.boneyard.length > 0 && (
              <div ref={boneyardRef} className="absolute left-2 top-2 flex flex-col items-center gap-1 z-10">
                <div className="flex flex-col items-center gap-0.5 max-h-full overflow-y-auto scrollbar-hide">
                  {state.boneyard.slice(0, 6).map((_, bi) => (
                    <motion.div
                      key={bi}
                      className="w-6 h-9 rounded-sm border border-border/50 diamond-pattern flex-shrink-0"
                      style={{ background: 'hsl(var(--tile-back))' }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: bi * 0.03 }}
                    />
                  ))}
                  {state.boneyard.length > 6 && (
                    <span className="text-[9px] font-mono text-muted-foreground/60">+{state.boneyard.length - 6}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-card/80 rounded-lg px-2 py-0.5 border border-border/50">
                  <Layers className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-mono text-muted-foreground">{state.boneyard.length}</span>
                </div>
              </div>
            )}

            {/* Chain — pass end-click handlers */}
            <ChainArea
              chain={state.chain}
              chainEnds={state.chainEnds}
              highlightEnds={showEndChoice}
              onLeftEndClick={showEndChoice ? () => handleEndClick('left') : undefined}
              onRightEndClick={showEndChoice ? () => handleEndClick('right') : undefined}
            />
          </div>

          {/* Right player */}
          {rightSeat && rightSeatIndex !== null && (
            <div className="flex items-center justify-center">
              <ClassicPlayerZone
                ref={rightZoneRef}
                position="right"
                avatar={avatarForIndex(rightSeatIndex)}
                name={rightSeat.name}
                cardCount={rightSeat.hand.length}
                isCurrentTurn={rightSeatIndex === currentIdx}
                lastAction={actionMap[rightSeatIndex]?.action ?? null}
                lastPlayedTile={actionMap[rightSeatIndex]?.tile}
              />
            </div>
          )}
        </div>

        {/* Bottom player info */}
        <div className="flex items-center justify-center mt-2">
          {bottomSeat && (
            <ClassicPlayerZone
              ref={bottomZoneRef}
              position="bottom"
              avatar={avatarForIndex(bottomSeatIndex)}
              name={bottomSeat.name}
              cardCount={displayHand.length}
              isCurrentTurn={bottomSeatIndex === currentIdx}
              lastAction={actionMap[bottomSeatIndex]?.action ?? null}
              lastPlayedTile={actionMap[bottomSeatIndex]?.tile}
              showHand={false}
            />
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 px-4 py-2">
        {canDraw && (
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 bg-accent/20 border border-accent/30 text-accent rounded-xl font-arabic text-sm font-bold"
            onClick={handleDraw}
            initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.95 }}
          >
            <Layers className="w-4 h-4" />
            اسحب ({state.boneyard.length})
          </motion.button>
        )}
        {canPass && (
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 bg-destructive/20 border border-destructive/30 text-destructive rounded-xl font-arabic text-sm font-bold"
            onClick={() => state.passTurn()}
            initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.95 }}
          >
            <SkipForward className="w-4 h-4" />
            تمرير
          </motion.button>
        )}
      </div>

      {/* Player hand */}
      <div className="px-2 pb-3 pt-1">
        <div className="overflow-x-auto flex items-center justify-center scrollbar-hide">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {displayHand.map((tile, i) => {
              const playable = canAct && canPlayTile(tile, displayChainEnds);
              const selected = state.selectedTileIndex === i;
              const tileState = selected ? 'selected' : playable ? 'capturable' : 'normal';
              const opacity = playable || selected ? 1 : 0.6;

              return (
                <motion.div
                  key={`${tile[0]}-${tile[1]}-${i}`}
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: selected ? -6 : 0, opacity }}
                  transition={{ delay: i * 0.03 }}
                >
                  <DominoTile
                    tile={tile}
                    size="md"
                    state={tileState}
                    onClick={canAct ? () => handleTileSelect(i) : undefined}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
        {isFriend && (
          <p className="text-center text-xs font-arabic text-muted-foreground mt-1">
            {currentPlayer.name} ({currentPlayer.hand.length} قطعة)
          </p>
        )}
      </div>
    </div>
  );
}