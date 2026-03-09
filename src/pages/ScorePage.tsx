import { useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Trophy, Home, RotateCcw } from 'lucide-react';
import {
  playWinMusic, playLoseMusic, playDrawMusic,
  playRoundWinJingle, playRoundLoseJingle,
  playScoreRevealSound,
} from '@/utils/soundEffects';

export default function ScorePage() {
  const navigate = useNavigate();
  const phase = useGameStore(s => s.phase);
  const player = useGameStore(s => s.player);
  const opponent = useGameStore(s => s.opponent);
  const targetScore = useGameStore(s => s.targetScore) || 600;
  const roundNumber = useGameStore(s => s.roundNumber);
  const nextRound = useGameStore(s => s.nextRound);
  const resetGame = useGameStore(s => s.resetGame);

  const isValidPhase = phase === 'round_end' || phase === 'game_over';
  const isGameOver = phase === 'game_over';
  const pCumScore = player?.cumulativeScore ?? 0;
  const oCumScore = opponent?.cumulativeScore ?? 0;
  const pScore = player?.score ?? 0;
  const oScore = opponent?.score ?? 0;
  const playerWon = pCumScore > oCumScore;
  const isDraw = pCumScore === oCumScore;
  const played = useRef(false);

  // Memoize random positions for decorative circles
  const circles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      w: 10 + Math.random() * 14,
      left: `${10 + Math.random() * 80}%`,
      top: `${10 + Math.random() * 80}%`,
      bg: ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', 'hsl(51, 100%, 60%)'][i % 4],
      dur: 2 + Math.random() * 2,
    })),
  []);

  useEffect(() => {
    if (phase === 'idle' || phase === 'playing' || phase === 'bot_thinking') {
      navigate('/home', { replace: true });
    }
  }, [phase, navigate]);

  useEffect(() => {
    if (played.current || !isValidPhase) return;
    played.current = true;
    const t = setTimeout(() => {
      try {
        if (isGameOver) {
          if (isDraw) playDrawMusic();
          else if (playerWon) playWinMusic();
          else playLoseMusic();
        } else {
          if (pScore > oScore) playRoundWinJingle();
          else playRoundLoseJingle();
        }
      } catch (e) {
        console.warn('Sound playback failed:', e);
      }
    }, 300);
    const t2 = setTimeout(() => {
      try { playScoreRevealSound(); } catch (e) { /* ignore */ }
    }, 1200);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [isValidPhase]);

  if (!isValidPhase) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground font-arabic animate-pulse">جاري التحميل...</p>
      </div>
    );
  }

  const handleNextRound = () => {
    nextRound();
    navigate('/game');
  };

  const handleGoHome = () => {
    resetGame();
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {circles.map((c, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ width: c.w, height: c.w, left: c.left, top: c.top, background: c.bg }}
          animate={{ y: [0, -10, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: c.dur, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      <motion.div
        className="w-full max-w-md flex flex-col items-center gap-5 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-end gap-3 mb-2">
            <motion.div
              className="w-8 h-16 tile-face rounded-md border border-primary/20"
              initial={{ rotate: -20, y: 20, opacity: 0 }}
              animate={{ rotate: -15, y: 0, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
            />
            <motion.div
              className="w-8 h-16 tile-face rounded-md border border-primary/20"
              initial={{ rotate: 20, y: 20, opacity: 0 }}
              animate={{ rotate: 15, y: 0, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
            />
          </div>

          {isGameOver ? (
            <motion.div
              className="text-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <h1 className={`text-3xl font-bold font-arabic ${playerWon ? 'gold-text' : 'text-muted-foreground'}`}>
                {isDraw ? '🤝 تعادل!' : playerWon ? '🎉 مبروك الفوز!' : '😔 خسرت'}
              </h1>
            </motion.div>
          ) : (
            <h2 className="text-2xl font-bold font-arabic">
              <span className="text-destructive">🔥</span> نهاية الجولة <span className="text-destructive">🔥</span>
            </h2>
          )}
        </div>

        <motion.div
          className="w-full bg-card/90 border border-border rounded-2xl overflow-hidden backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="grid grid-cols-3 border-b border-border">
            <div className="py-3 text-center">
              <p className="text-sm font-arabic font-bold text-muted-foreground">{opponent?.name || 'الخصم'}</p>
            </div>
            <div className="py-3 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div className="py-3 text-center relative">
              {pScore >= oScore && (
                <motion.span
                  className="absolute -top-1 left-1/2 -translate-x-1/2 text-lg"
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  👑
                </motion.span>
              )}
              <p className="text-sm font-arabic font-bold text-primary">{player?.name || 'لاعب'}</p>
            </div>
          </div>

          {[
            { label: 'كروت المكسب', pVal: player?.winPile?.length ?? 0, oVal: opponent?.winPile?.length ?? 0, delay: 0.4 },
            { label: 'فرق الكروت\n> 10 = 4', pVal: (player?.winPile?.length ?? 0) > (opponent?.winPile?.length ?? 0) ? ((player?.winPile?.length ?? 0) - (opponent?.winPile?.length ?? 0) >= 10 ? 4 : 0) : 0, oVal: (opponent?.winPile?.length ?? 0) > (player?.winPile?.length ?? 0) ? ((opponent?.winPile?.length ?? 0) - (player?.winPile?.length ?? 0) >= 10 ? 4 : 0) : 0, delay: 0.6 },
            { label: 'البصرة\n× 100', pVal: (player?.basraCount ?? 0) * 100, oVal: (opponent?.basraCount ?? 0) * 100, delay: 0.8, highlight: true },
          ].map((row, idx) => (
            <div key={idx} className="grid grid-cols-3 border-b border-border/50">
              <div className="py-3 text-center">
                <CountUp to={row.oVal} delay={row.delay + 0.1} highlight={row.highlight} />
              </div>
              <div className="py-3 flex items-center justify-center">
                <p className="text-[11px] font-arabic text-muted-foreground text-center whitespace-pre-line leading-tight">{row.label}</p>
              </div>
              <div className="py-3 text-center">
                <CountUp to={row.pVal} delay={row.delay} highlight={row.highlight} />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-3 bg-secondary/30">
            <div className="py-3 text-center">
              <motion.span
                className="text-lg font-mono font-bold text-destructive"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2, type: 'spring' }}
              >
                {oScore}
              </motion.span>
            </div>
            <div className="py-3 flex items-center justify-center">
              <p className="text-sm font-arabic font-bold text-foreground">المجموع</p>
            </div>
            <div className="py-3 text-center">
              <motion.span
                className="text-lg font-mono font-bold text-primary"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2, type: 'spring' }}
              >
                {pScore}
              </motion.span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="w-full flex flex-col gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <div className="flex items-center justify-between">
            <PlayerScore name={opponent?.name || 'الخصم'} score={oCumScore} color="destructive" />
            <div className="text-center">
              <p className="text-xs font-arabic text-muted-foreground">الهدف</p>
              <p className="text-lg font-mono font-bold text-foreground">{targetScore}</p>
            </div>
            <PlayerScore name={player?.name || 'لاعب'} score={pCumScore} color="primary" isPlayer />
          </div>

          <div className="relative h-4 bg-secondary rounded-full overflow-hidden border border-border">
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full bg-destructive"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((oCumScore / targetScore) * 50, 50)}%` }}
              transition={{ duration: 1.2, delay: 1.5 }}
            />
            <motion.div
              className="absolute right-0 top-0 h-full rounded-full gold-gradient"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((pCumScore / targetScore) * 50, 50)}%` }}
              transition={{ duration: 1.2, delay: 1.5 }}
            />
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-accent -translate-x-1/2" />
          </div>
        </motion.div>

        <motion.div
          className="flex gap-3 w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
        >
          {!isGameOver ? (
            <>
              <motion.button
                onClick={handleNextRound}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 gold-gradient text-primary-foreground rounded-xl font-arabic font-bold gold-glow"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <RotateCcw className="w-4 h-4" />
                جولة جديدة
              </motion.button>
              <motion.button
                onClick={handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-destructive/20 border border-destructive/30 text-destructive rounded-xl font-arabic font-bold"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Home className="w-4 h-4" />
                خروج
              </motion.button>
            </>
          ) : (
            <motion.button
              onClick={handleGoHome}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 gold-gradient text-primary-foreground rounded-xl font-arabic font-bold gold-glow"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              لعبة جديدة
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

function CountUp({ to, delay = 0, highlight = false }: { to: number; delay?: number; highlight?: boolean }) {
  return (
    <motion.span
      className={`font-mono font-bold ${highlight ? 'text-primary text-base' : 'text-foreground'}`}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring' }}
    >
      {to}
    </motion.span>
  );
}

function PlayerScore({ name, score, color, isPlayer = false }: { name: string; score: number; color: string; isPlayer?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {!isPlayer && <span className="text-xs font-arabic text-muted-foreground">{name}</span>}
      <div className="flex items-center gap-1">
        <motion.div
          className={`w-2.5 h-2.5 rounded-full ${isPlayer ? 'gold-gradient' : 'bg-destructive'}`}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className={`font-mono font-bold text-lg ${isPlayer ? 'text-primary' : 'text-destructive'}`}>
          {score}
        </span>
      </div>
      {isPlayer && <span className="text-xs font-arabic text-muted-foreground">{name}</span>}
    </div>
  );
}
