import { useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useClassicGameStore } from '@/store/classicGameStore';
import { Home, RotateCcw } from 'lucide-react';
import {
  playWinMusic, playLoseMusic, playDrawMusic,
  playRoundWinJingle, playRoundLoseJingle,
  playScoreRevealSound,
} from '@/utils/soundEffects';
import PageShell from '@/components/PageShell';

export default function ClassicScorePage() {
  const navigate = useNavigate();
  const phase = useClassicGameStore(s => s.phase);
  const players = useClassicGameStore(s => s.players);
  const targetScore = useClassicGameStore(s => s.targetScore);
  const nextRound = useClassicGameStore(s => s.nextRound);
  const resetGame = useClassicGameStore(s => s.resetGame);
  const roundNumber = useClassicGameStore(s => s.roundNumber);

  const isGameOver = phase === 'game_over';
  const played = useRef(false);

  const humanPlayer = players[0];
  const maxScore = Math.max(...players.map(p => p.cumulativeScore));
  const winners = players.filter(p => p.cumulativeScore === maxScore);
  const humanWon = isGameOver && humanPlayer && humanPlayer.cumulativeScore === maxScore && winners.length === 1;
  const isDraw = isGameOver && winners.length > 1;

  const circles = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      w: 10 + Math.random() * 14,
      left: `${10 + Math.random() * 80}%`,
      top: `${10 + Math.random() * 80}%`,
      bg: ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--destructive))'][i % 3],
      dur: 2 + Math.random() * 2,
    })),
  []);

  useEffect(() => {
    if (phase === 'idle') {
      navigate('/home', { replace: true });
      return;
    }
  }, [phase, navigate]);

  useEffect(() => {
    if (played.current) return;
    if (phase !== 'round_end' && phase !== 'game_over') return;
    played.current = true;
    const t = setTimeout(() => {
      try {
        if (isGameOver) {
          if (isDraw) playDrawMusic();
          else if (humanWon) playWinMusic();
          else playLoseMusic();
        } else {
          if ((humanPlayer?.score ?? 0) > 0) playRoundWinJingle();
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
  }, [phase]);

  if (phase === 'idle' || !players || players.length === 0) return null;

  const handleNextRound = () => {
    nextRound();
    navigate('/classic-game');
  };

  const handleGoHome = () => {
    resetGame();
    navigate('/home');
  };

  return (
    <PageShell
      maxWidth="lg"
      className="bg-background flex items-center justify-center relative overflow-hidden"
      dir="rtl"
    >
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
          <p className="text-xs font-arabic text-muted-foreground">الدومينو الكلاسيكي</p>
          {isGameOver ? (
            <motion.h1
              className={`text-3xl font-bold font-arabic ${humanWon ? 'gold-text' : 'text-muted-foreground'}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {isDraw ? '🤝 تعادل!' : humanWon ? '🎉 مبروك الفوز!' : `🏆 ${winners[0]?.name} فاز!`}
            </motion.h1>
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
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)` }} className="border-b border-border">
            {players.map((p, i) => (
              <div key={i} className="py-3 text-center">
                <p className={`text-sm font-arabic font-bold ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {p.name}
                </p>
              </div>
            ))}
          </div>

          <div className="border-b border-border/50" style={{ display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)` }}>
            {players.map((p, i) => (
              <div key={i} className="py-3 text-center">
                <motion.span
                  className={`font-mono font-bold ${i === 0 ? 'text-primary' : 'text-foreground'}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  +{p.score}
                </motion.span>
              </div>
            ))}
          </div>

          <div className="py-1 text-center border-b border-border/30">
            <p className="text-[10px] font-arabic text-muted-foreground">نقاط الجولة ↑ · المجموع ↓</p>
          </div>

          <div className="bg-secondary/30" style={{ display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)` }}>
            {players.map((p, i) => (
              <div key={i} className="py-3 text-center">
                <motion.span
                  className={`text-lg font-mono font-bold ${p.cumulativeScore === maxScore ? 'text-primary' : 'text-foreground'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                >
                  {p.cumulativeScore}
                </motion.span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="w-full flex flex-col gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p className="text-xs font-arabic text-muted-foreground text-center">الهدف: {targetScore}</p>
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-arabic text-muted-foreground w-16 truncate text-left">{p.name}</span>
              <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden border border-border">
                <motion.div
                  className={`h-full rounded-full ${i === 0 ? 'gold-gradient' : 'bg-accent'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((p.cumulativeScore / targetScore) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 1 + i * 0.15 }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{p.cumulativeScore}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          className="flex gap-3 w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
        >
          {!isGameOver ? (
            <>
              <motion.button
                onClick={handleNextRound}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 gold-gradient text-primary-foreground rounded-xl font-arabic font-bold gold-glow"
                whileTap={{ scale: 0.98 }}
              >
                <RotateCcw className="w-4 h-4" />
                جولة جديدة
              </motion.button>
              <motion.button
                onClick={handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-destructive/20 border border-destructive/30 text-destructive rounded-xl font-arabic font-bold"
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
              whileTap={{ scale: 0.98 }}
            >
              لعبة جديدة
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
