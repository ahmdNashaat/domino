import { useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useOnlineGameStore } from '@/store/onlineGameStore';
import { useOnlineStore } from '@/store/onlineStore';
import { useSocket } from '@/hooks/useSocket';
import { Trophy, Home, RotateCcw } from 'lucide-react';
import {
  playWinMusic, playLoseMusic, playDrawMusic,
  playRoundWinJingle, playRoundLoseJingle,
  playScoreRevealSound,
} from '@/utils/soundEffects';
import PageShell from '@/components/PageShell';

export default function OnlineScorePage() {
  const storeVariant = useOnlineStore(s => s.gameVariant);
  const stateVariant = useOnlineGameStore(s => s.variant);
  const isClassic = storeVariant === 'classic' || stateVariant === 'classic';

  if (isClassic) {
    return <OnlineClassicScorePage />;
  }
  return <OnlineKoutchinaScorePage />;
}

function OnlineKoutchinaScorePage() {
  const navigate = useNavigate();
  const phase = useOnlineGameStore(s => s.phase);
  const me = useOnlineGameStore(s => s.me);
  const opponent = useOnlineGameStore(s => s.opponent);
  const targetScore = useOnlineGameStore(s => s.targetScore) || 600;
  const resetOnlineGame = useOnlineGameStore(s => s.resetOnlineGame);
  const { leaveRoom, sendNextRound } = useSocket();

  const isValidPhase = phase === 'round_end' || phase === 'game_over';
  const isGameOver = phase === 'game_over';
  const pCumScore = me?.cumulativeScore ?? 0;
  const oCumScore = opponent?.cumulativeScore ?? 0;
  const pScore = me?.score ?? 0;
  const oScore = opponent?.score ?? 0;
  const playerWon = pCumScore > oCumScore;
  const isDraw = pCumScore === oCumScore;
  const played = useRef(false);
  const pCards = Math.max(0, (me?.winPile?.length ?? 0) - (me?.basraCount ?? 0));
  const oCards = Math.max(0, (opponent?.winPile?.length ?? 0) - (opponent?.basraCount ?? 0));
  const diff = Math.abs(pCards - oCards);
  const diffPoints = diff * 10;
  const pDiffPoints = pCards > oCards ? diffPoints : 0;
  const oDiffPoints = oCards > pCards ? diffPoints : 0;

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
    if (!isValidPhase) {
      navigate('/home', { replace: true });
    }
  }, [isValidPhase, navigate]);

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

  useEffect(() => {
    if (phase === 'playing') {
      navigate('/online/game');
    }
  }, [phase, navigate]);

  if (!isValidPhase) {
    return (
      <PageShell maxWidth="lg" className="bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground font-arabic animate-pulse">جاري التحميل...</p>
      </PageShell>
    );
  }

  const handleGoHome = () => {
    leaveRoom();
    resetOnlineGame();
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
              <p className="text-sm font-arabic font-bold text-primary">{me?.name || 'أنا'}</p>
            </div>
          </div>

          {[
            { label: 'كروت المكسب\n(بدون بصرة)', pVal: pCards, oVal: oCards, delay: 0.4 },
            { label: 'فرق الكروت\n× 10', pVal: pDiffPoints, oVal: oDiffPoints, delay: 0.6 },
            { label: 'البصرة\n× 100', pVal: (me?.basraCount ?? 0) * 100, oVal: (opponent?.basraCount ?? 0) * 100, delay: 0.8, highlight: true },
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
            <PlayerScore name={me?.name || 'أنا'} score={pCumScore} color="primary" isPlayer />
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
          {!isGameOver && (
            <motion.button
              onClick={() => sendNextRound()}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-arabic font-bold hover:bg-primary/90"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RotateCcw className="w-4 h-4" />
              جولة أخرى
            </motion.button>
          )}
          <motion.button
            onClick={handleGoHome}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 gold-gradient text-primary-foreground rounded-xl font-arabic font-bold gold-glow"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Home className="w-4 h-4" />
            {isGameOver ? 'لعبة جديدة' : 'خروج'}
          </motion.button>
        </motion.div>
      </motion.div>
    </PageShell>
  );
}

function OnlineClassicScorePage() {
  const navigate = useNavigate();
  const phase = useOnlineGameStore(s => s.phase);
  const players = useOnlineGameStore(s => s.classicPlayers);
  const targetScore = useOnlineGameStore(s => s.targetScore);
  const myId = useOnlineGameStore(s => s.myPlayerId);
  const resetOnlineGame = useOnlineGameStore(s => s.resetOnlineGame);
  const { leaveRoom, sendNextRound } = useSocket();

  const isGameOver = phase === 'game_over';
  const isValidPhase = phase === 'round_end' || phase === 'game_over';
  const played = useRef(false);

  const maxScore = Math.max(0, ...players.map(p => p.cumulativeScore));
  const winners = players.filter(p => p.cumulativeScore === maxScore);
  const myPlayer = players.find(p => p.id === myId);
  const humanWon = isGameOver && myPlayer && myPlayer.cumulativeScore === maxScore && winners.length === 1;
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
    if (!isValidPhase) {
      navigate('/home', { replace: true });
      return;
    }
  }, [isValidPhase, navigate]);

  useEffect(() => {
    if (played.current || !isValidPhase) return;
    played.current = true;
    const t = setTimeout(() => {
      try {
        if (isGameOver) {
          if (isDraw) playDrawMusic();
          else if (humanWon) playWinMusic();
          else playLoseMusic();
        } else {
          if ((myPlayer?.score ?? 0) > 0) playRoundWinJingle();
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

  useEffect(() => {
    if (phase === 'playing') {
      navigate('/online/game');
    }
  }, [phase, navigate]);

  if (!isValidPhase) {
    return (
      <PageShell maxWidth="lg" className="bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground font-arabic animate-pulse">جاري التحميل...</p>
      </PageShell>
    );
  }

  const handleNextRound = () => {
    sendNextRound();
  };

  const handleGoHome = () => {
    leaveRoom();
    resetOnlineGame();
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
            {players.map((p) => (
              <div key={p.id} className="py-3 text-center">
                <p className={`text-sm font-arabic font-bold ${p.id === myId ? 'text-primary' : 'text-muted-foreground'}`}>
                  {p.name}
                </p>
              </div>
            ))}
          </div>

          <div className="border-b border-border/50" style={{ display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)` }}>
            {players.map((p) => (
              <div key={p.id} className="py-3 text-center">
                <motion.span
                  className={`font-mono font-bold ${p.id === myId ? 'text-primary' : 'text-foreground'}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
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
            {players.map((p) => (
              <div key={p.id} className="py-3 text-center">
                <motion.span
                  className={`text-lg font-mono font-bold ${p.cumulativeScore === maxScore ? 'text-primary' : 'text-foreground'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
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
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-[10px] font-arabic text-muted-foreground w-16 truncate text-left">{p.name}</span>
              <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden border border-border">
                <motion.div
                  className={`h-full rounded-full ${p.id === myId ? 'gold-gradient' : 'bg-accent'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((p.cumulativeScore / targetScore) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 1 }}
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
