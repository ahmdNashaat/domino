import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useOnlineStore } from '@/store/onlineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { ArrowRight, Copy, Check, Wifi, WifiOff, Globe, Plus, DoorOpen, ChevronDown, Settings2, Delete } from 'lucide-react';
import type { GameVariant } from '@/types/contracts';
import PageShell from '@/components/PageShell';

type Mode = 'choose' | 'create' | 'join';
type Tab = 'create' | 'join';

export default function OnlineRoomPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('choose');
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const { playerName: savedName } = useSettingsStore();
  const [roomCodeDigits, setRoomCodeDigits] = useState<string[]>(Array(6).fill(''));
  const [targetScore, setTargetScore] = useState<number>(600);
  const [customScore, setCustomScore] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gameVariant, setGameVariant] = useState<GameVariant>('koutchina');
  const [playerCount, setPlayerCount] = useState(2);

  const { createRoom, joinRoom, leaveRoom } = useSocket();
  const { connected, roomCode, roomStatus, error, roomPlayers, maxPlayers } = useOnlineStore();

  const scoreOptions = gameVariant === 'koutchina' ? [600, 1000] : [100, 150];
  const defaultScore = gameVariant === 'koutchina' ? 600 : 100;

  const handleCopy = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreate = () => {
    const name = savedName.trim() || 'لاعب';
    const score = useCustom ? (parseInt(customScore) || defaultScore) : targetScore;
    useOnlineStore.getState().setPlayerName(name);
    const count = gameVariant === 'classic' ? playerCount : undefined;
    createRoom(name, score, false, undefined, gameVariant, count);
  };

  const handleJoin = () => {
    const name = savedName.trim() || 'لاعب';
    const code = roomCodeDigits.join('');
    if (code.length < 6) return;
    useOnlineStore.getState().setPlayerName(name);
    joinRoom(code.toUpperCase(), name);
  };

  const handleNumPad = (digit: string) => {
    const idx = roomCodeDigits.findIndex(d => d === '');
    if (idx !== -1) {
      const next = [...roomCodeDigits];
      next[idx] = digit;
      setRoomCodeDigits(next);
    }
  };

  const handleBackspace = () => {
    const lastIdx = roomCodeDigits.reduce((acc, d, i) => (d !== '' ? i : acc), -1);
    if (lastIdx !== -1) {
      const next = [...roomCodeDigits];
      next[lastIdx] = '';
      setRoomCodeDigits(next);
    }
  };

  const handleBack = () => {
    if (roomStatus === 'waiting' || roomStatus === 'creating') {
      leaveRoom();
    }
    if (mode !== 'choose') {
      setMode('choose');
    } else {
      navigate('/home');
    }
  };

  // ── Playing — redirect via useEffect ──────────────────────────────
  useEffect(() => {
    if (roomStatus === 'playing') {
      navigate('/online/game');
    }
  }, [roomStatus, navigate]);

  // ── Waiting for players ──────────────────────────────
  if (roomStatus === 'waiting' && roomCode) {
    const remaining = Math.max(0, maxPlayers - roomPlayers.length);
    return (
      <PageShell
        maxWidth="lg"
        className="bg-background flex flex-col items-center justify-center relative overflow-hidden"
        dir="rtl"
      >
        {/* Star particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/40"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}

        <motion.div
          className="w-full max-w-md flex flex-col items-center gap-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <motion.button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-secondary/80 border border-border flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowRight className="w-5 h-5 text-foreground" />
            </motion.button>
            <h2 className="text-2xl font-bold gold-text font-arabic flex-1 text-center">الغرف</h2>
            <div className="w-10" />
          </div>

          {/* Room Code Card */}
          <div className="w-full bg-card/80 border border-border rounded-2xl p-6 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground font-arabic mb-4">شارك هذا الكود مع أصدقائك</p>
            <div className="flex justify-center gap-2 mb-4" dir="ltr">
              {roomCode.split('').map((char, i) => (
                <motion.div
                  key={i}
                  className="w-12 h-14 rounded-lg border-2 border-primary/40 bg-secondary flex items-center justify-center"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <span className="text-2xl font-mono font-bold text-primary">{char}</span>
                </motion.div>
              ))}
            </div>
            <motion.button
              onClick={handleCopy}
              className="px-5 py-2 bg-secondary border border-border rounded-xl text-muted-foreground hover:text-foreground transition-all font-arabic flex items-center gap-2 mx-auto text-sm"
              whileTap={{ scale: 0.95 }}
            >
              {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
              {copied ? 'تم النسخ!' : 'نسخ الكود'}
            </motion.button>

            <div className="mt-6 text-right">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-arabic mb-2">
                <span>اللاعبين</span>
                <span className="font-mono">{roomPlayers.length}/{maxPlayers}</span>
              </div>
              <div className="flex flex-col gap-2">
                {roomPlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-secondary/70 border border-border rounded-xl">
                    <span className="font-arabic text-foreground">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">متصل</span>
                  </div>
                ))}
                {Array.from({ length: remaining }).map((_, i) => (
                  <div key={`slot-${i}`} className="px-3 py-2 bg-secondary/30 border border-dashed border-border rounded-xl text-xs font-arabic text-muted-foreground">
                    في انتظار لاعب...
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Waiting indicator */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.3, 1], scale: [1, 0.7, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground font-arabic">في انتظار اكتمال اللاعبين</p>
          </div>
        </motion.div>
      </PageShell>
    );
  }

  // (playing redirect handled by useEffect above)

  // ── Disconnected ──────────────────────────────
  if (roomStatus === 'disconnected') {
    return (
      <PageShell maxWidth="lg" className="bg-background flex items-center justify-center" dir="rtl">
        <motion.div className="w-full max-w-md flex flex-col items-center gap-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <WifiOff className="w-16 h-16 text-destructive" />
          <h2 className="text-2xl font-bold text-destructive font-arabic">الخصم قطع الاتصال</h2>
          <motion.button
            onClick={() => { leaveRoom(); navigate('/home'); }}
            className="px-8 py-3 gold-gradient text-primary-foreground rounded-xl font-arabic font-bold"
            whileTap={{ scale: 0.95 }}
          >
            رجوع للرئيسية
          </motion.button>
        </motion.div>
      </PageShell>
    );
  }

  // ── Main Room UI with Tabs ──────────────────────────────
  return (
    <PageShell
      maxWidth="lg"
      className="bg-background flex flex-col items-center relative overflow-hidden"
      dir="rtl"
    >
      {/* Stars */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/30"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 }}
        />
      ))}

      <motion.div
        className="w-full max-w-md flex flex-col gap-5 relative z-10 mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => navigate('/home')}
            className="w-10 h-10 rounded-full bg-secondary/80 border border-border flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ArrowRight className="w-5 h-5 text-foreground" />
          </motion.button>
          <h1 className="text-2xl font-bold gold-text font-arabic flex-1 text-center">الغرف</h1>
          <div className="w-10" />
        </div>

        {/* Connection status */}
        <div className="flex justify-center">
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs text-accent font-arabic px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
              <Wifi className="w-3 h-3" /> متصل
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-destructive font-arabic px-3 py-1 rounded-full bg-destructive/10 border border-destructive/20">
              <WifiOff className="w-3 h-3" /> غير متصل
            </span>
          )}
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/60 rounded-2xl border border-border">
          <motion.button
            onClick={() => setActiveTab('join')}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-arabic font-bold transition-all ${
              activeTab === 'join'
                ? 'bg-card border border-primary/30 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            <DoorOpen className="w-5 h-5" />
            انضمام لغرفة
          </motion.button>
          <motion.button
            onClick={() => setActiveTab('create')}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-arabic font-bold transition-all ${
              activeTab === 'create'
                ? 'bg-card border border-primary/30 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-5 h-5 text-primary" />
            إنشاء غرفة
          </motion.button>
        </div>


        <AnimatePresence mode="wait">
          {activeTab === 'create' ? (
            <motion.div
              key="create"
              className="flex flex-col gap-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Game variant selector */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-arabic text-muted-foreground">نوع اللعبة</label>
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    onClick={() => { setGameVariant('koutchina'); setTargetScore(600); setUseCustom(false); setPlayerCount(2); }}
                    className={`py-3.5 rounded-xl font-arabic font-bold text-base transition-all border flex items-center justify-center gap-2 ${
                      gameVariant === 'koutchina'
                        ? 'bg-primary/15 border-primary/50 text-primary'
                        : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
                    }`}
                    whileTap={{ scale: 0.96 }}
                  >
                    🃏 كوتشينة
                  </motion.button>
                  <motion.button
                    onClick={() => { setGameVariant('classic'); setTargetScore(100); setUseCustom(false); setPlayerCount(2); }}
                    className={`py-3.5 rounded-xl font-arabic font-bold text-base transition-all border flex items-center justify-center gap-2 ${
                      gameVariant === 'classic'
                        ? 'bg-primary/15 border-primary/50 text-primary'
                        : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
                    }`}
                    whileTap={{ scale: 0.96 }}
                  >
                    🎲 كلاسيكي
                  </motion.button>
                </div>
              </div>

              {gameVariant === 'classic' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-arabic text-muted-foreground">عدد اللاعبين</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 4].map(n => (
                      <motion.button
                        key={n}
                        onClick={() => setPlayerCount(n)}
                        className={`py-3 rounded-xl font-mono font-bold text-lg transition-all border ${
                          playerCount === n
                            ? 'bg-primary/15 border-primary/50 text-primary'
                            : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
                        }`}
                        whileTap={{ scale: 0.96 }}
                      >
                        {n}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Game settings collapsible */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-card/80 border border-border rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  <span className="font-arabic font-bold text-foreground">إعدادات اللعبة</span>
                </div>
                <motion.div animate={{ rotate: showSettings ? 180 : 0 }}>
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2 pb-2">
                      <label className="text-sm font-arabic text-muted-foreground">الهدف</label>
                      <div className="grid grid-cols-3 gap-2">
                        {scoreOptions.map(score => (
                          <button
                            key={score}
                            onClick={() => { setTargetScore(score); setUseCustom(false); }}
                            className={`py-3 rounded-xl font-mono font-bold text-lg transition-all border ${
                              !useCustom && targetScore === score
                                ? 'bg-primary/15 border-primary/50 text-primary'
                                : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
                            }`}
                          >
                            {score}
                          </button>
                        ))}
                        <button
                          onClick={() => setUseCustom(true)}
                          className={`py-3 rounded-xl font-arabic text-sm transition-all border ${
                            useCustom
                              ? 'bg-primary/15 border-primary/50 text-primary'
                              : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
                          }`}
                        >
                          يدوي
                        </button>
                      </div>
                      {useCustom && (
                        <input
                          type="number"
                          value={customScore}
                          onChange={e => setCustomScore(e.target.value)}
                          placeholder="ادخل الهدف..."
                          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors"
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && <p className="text-sm text-destructive font-arabic text-center">{error}</p>}

              <motion.button
                onClick={handleCreate}
                disabled={!connected}
                className="w-full gold-gradient text-primary-foreground font-arabic font-bold text-lg py-4 rounded-xl gold-glow-strong disabled:opacity-40"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ابدأ
              </motion.button>

              {!connected && (
                <p className="text-xs text-destructive font-arabic text-center">⚠️ غير متصل بالسيرفر</p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="join"
              className="flex flex-col gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Code input display */}
              <div className="w-full bg-card/80 border border-border rounded-2xl p-5 backdrop-blur-sm">
                <p className="text-sm text-muted-foreground font-arabic text-center mb-4">أدخل كود الغرفة</p>
                <input
                  value={roomCodeDigits.join('')}
                  onChange={e => {
                    const val = e.target.value.toUpperCase().slice(0, 6);
                    const arr = val.split('');
                    while (arr.length < 6) arr.push('');
                    setRoomCodeDigits(arr);
                  }}
                  placeholder="XXXXXX"
                  maxLength={6}
                  autoCapitalize="characters"
                  className="w-full text-center text-4xl font-mono font-bold tracking-[0.5em] py-4 bg-secondary border-2 border-primary/30 rounded-xl text-primary focus:outline-none focus:border-primary/60 transition-colors uppercase placeholder:text-muted-foreground/30 placeholder:tracking-[0.5em]"
                  dir="ltr"
                />
              </div>

              {error && <p className="text-sm text-destructive font-arabic text-center">{error}</p>}

              <motion.button
                onClick={handleJoin}
                disabled={!connected || roomCodeDigits.filter(d => d !== '').length < 6}
                className="w-full gold-gradient text-primary-foreground font-arabic font-bold text-lg py-4 rounded-xl gold-glow-strong disabled:opacity-40"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ابدأ
              </motion.button>

              {!connected && (
                <p className="text-xs text-destructive font-arabic text-center">⚠️ غير متصل بالسيرفر</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground font-arabic mt-2">في انتظار اكتمال اللاعبين</p>
      </motion.div>
    </PageShell>
  );
}
