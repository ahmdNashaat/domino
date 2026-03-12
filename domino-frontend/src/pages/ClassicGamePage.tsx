import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useClassicGameStore } from '@/store/classicGameStore';
import { canPlayTile, getPlayableEnds, hasPlayableTile } from '@/utils/classicGameEngine';
import ChainArea from '@/components/game/ChainArea';
import { ChainEnd } from '@/types/contracts';
import { ArrowLeft, ArrowRight, Layers, SkipForward, LogOut } from 'lucide-react';
import { playDropSound, playCaptureSound, playSelectSound } from '@/utils/soundEffects';
import DominoTile from '@/components/game/DominoTile';
import { clearScoreSnapshot, saveScoreSnapshot } from '@/utils/scoreSnapshot';


export default function ClassicGamePage() {
  const navigate = useNavigate();
  const state = useClassicGameStore();
  const [showEndChoice, setShowEndChoice] = useState(false);
  const redirectRef = useRef(false);
  const idleRedirectRef = useRef(false);

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
    if (!phaseTerminal) {
      redirectRef.current = false;
      return;
    }
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

  const currentIdx = state.currentPlayerIndex;
  const currentPlayer = state.players[currentIdx];
  const humanIdx = 0; // Player 0 is always human
  const isHumanTurn = currentIdx === humanIdx;
  const isFriend = state.gameMode === 'friend';
  const canAct = state.phase === 'playing' && (isFriend || isHumanTurn);

  const displayHand = isFriend ? currentPlayer.hand : state.players[humanIdx].hand;

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

  // Other players (opponents) to display
  const otherPlayers = state.players.filter((_, i) => (isFriend ? i !== currentIdx : i !== humanIdx));

  let statusText: string | undefined;
  let statusPulse = false;
  if (state.phase === 'bot_thinking') {
    statusText = `${currentPlayer.name} يفكر...`;
    statusPulse = true;
  } else if (isFriend && state.phase === 'playing') {
    statusText = `دور ${currentPlayer.name}`;
  }

  const handleTileSelect = (index: number) => {
    if (!canAct) return;
    playSelectSound();

    const hand = isFriend ? currentPlayer.hand : state.players[humanIdx].hand;
    const tile = hand[index];
    if (!canPlayTile(tile, displayChainEnds)) {
      state.selectTile(index);
      return;
    }

    const ends = getPlayableEnds(tile, displayChainEnds);
    state.selectTile(index);

    if (ends.length === 1 || state.chain.length === 0) {
      setTimeout(() => {
        playDropSound();
        const s = useClassicGameStore.getState();
        if (s.selectedTileIndex === index) {
          s.playTile(ends[0]);
        }
      }, 150);
    } else {
      setShowEndChoice(true);
    }
  };

  const handlePlayEnd = (end: ChainEnd) => {
    playDropSound();
    state.playTile(end);
    setShowEndChoice(false);
  };

  const handleDraw = () => {
    playCaptureSound();
    state.drawFromBoneyard();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative" dir="rtl">
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
                🔒 اللعبة مقفولة!
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
      <div className="flex items-center justify-center gap-4 px-4 py-2">
        {otherPlayers.map((op, oi) => (
          <div key={oi} className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5">
              {op.hand.map((_, hi) => (
                <motion.div
                  key={hi}
                  className="w-10 h-20 rounded-sm border border-border/50 diamond-pattern"
                  style={{ background: 'hsl(var(--tile-back))' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: hi * 0.02 }}
                />
              ))}
            </div>
            <span className="text-[10px] font-arabic text-muted-foreground">
              {op.name} ({op.hand.length})
            </span>
          </div>
        ))}
      </div>

      {/* Chain area + Boneyard */}
      <div className="flex-1 flex mx-2 my-1 gap-1.5 overflow-hidden">
        {/* Boneyard on the left */}
        {state.boneyard.length > 0 && (
          <div className="flex flex-col items-center gap-1 py-2 px-1">
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

        {/* Chain */}
        <div className="flex-1 felt-bg rounded-xl flex flex-col relative overflow-hidden" style={{ minHeight: 0 }}>
          <ChainArea chain={state.chain} chainEnds={state.chainEnds} />

          {/* End choice modal */}
          <AnimatePresence>
            {showEndChoice && state.selectedTileIndex >= 0 && (
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
                    onClick={() => handlePlayEnd('left')}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ArrowRight className="w-6 h-6 text-primary" />
                    <span className="text-sm font-arabic text-foreground">يمين</span>
                  </motion.button>
                  <motion.button
                    className="flex flex-col items-center gap-2 px-6 py-4 bg-card border border-primary/30 rounded-2xl hover:border-primary transition-colors"
                    onClick={() => handlePlayEnd('right')}
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
            اسحب ({state.boneyard.length})
          </motion.button>
        )}
        {canPass && (
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 bg-destructive/20 border border-destructive/30 text-destructive rounded-xl font-arabic text-sm font-bold"
            onClick={() => state.passTurn()}
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