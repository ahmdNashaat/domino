import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GameVariant } from '@/types/contracts';
import { useGameStore } from '@/store/gameStore';
import { useClassicGameStore } from '@/store/classicGameStore';
import { ArrowRight, Play, ChevronDown } from 'lucide-react';
import PageShell from '@/components/PageShell';

const graveyardLabels: Record<number, string> = {
  2: '14 قطعة',
  3: '7 قطع',
  4: 'بدون مقبرة',
};

export default function RoomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const variant: GameVariant = (searchParams.get('variant') as GameVariant) || 'koutchina';
  const isClassic = variant === 'classic';

  const startKoutchina = useGameStore(s => s.startGame);
  const startClassic = useClassicGameStore(s => s.startGame);

  const { playerName: savedName } = useSettingsStore();
  const [playerCount, setPlayerCount] = useState(2);
  const [targetScore, setTargetScore] = useState<number>(isClassic ? 100 : 600);
  const [customScore, setCustomScore] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleStart = () => {
    const name = savedName.trim() || 'لاعب';
    const score = useCustom ? (parseInt(customScore) || (isClassic ? 100 : 600)) : targetScore;

    if (isClassic) {
      startClassic(name, score, 'hard', 'bot', undefined, playerCount);
      navigate('/classic-game');
    } else {
      startKoutchina(name, score, 'hard', 'bot');
      navigate('/game');
    }
  };

  return (
    <PageShell maxWidth="lg" className="bg-background flex flex-col" dir="rtl">
        <motion.div
          className="flex items-center gap-3 pt-6 pb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button onClick={() => navigate('/mode')} className="w-10 h-10 rounded-full bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold gold-text font-arabic">
              {isClassic ? 'الدومينو الكلاسيكي' : 'كوتشينة الدومينو'}
            </h1>
            <p className="text-xs text-muted-foreground font-arabic">جهّز إعداداتك وانطلق</p>
          </div>
        </motion.div>

        <div className="mt-4 flex flex-col gap-4 pb-4">
          {/* Player Count (classic only) */}
          {isClassic && (
            <motion.div
              className="bg-card border border-border rounded-2xl p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <label className="text-sm font-arabic text-muted-foreground mb-3 block">عدد اللاعبين</label>
              <div className="grid grid-cols-3 gap-3">
                {[2, 3, 4].map(n => (
                  <motion.button
                    key={n}
                    onClick={() => setPlayerCount(n)}
                    className={`py-4 rounded-xl font-mono font-bold text-lg transition-all border flex flex-col items-center gap-1 ${
                      playerCount === n
                        ? 'bg-primary/15 border-primary text-primary gold-glow'
                        : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>{n}</span>
                    <span className="text-[10px] font-arabic opacity-60">
                      {graveyardLabels[n]}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}


          {/* Target Score */}
          <motion.div
            className="bg-card border border-border rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-arabic text-muted-foreground">الهدف:</span>
                <span className="font-mono font-bold text-primary text-lg">
                  {useCustom ? (customScore || '---') : targetScore}
                </span>
              </div>
              <motion.div animate={{ rotate: showAdvanced ? 180 : 0 }}>
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-4"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {(isClassic ? [100, 150] : [600, 1000]).map(score => (
                      <button
                        key={score}
                        onClick={() => { setTargetScore(score); setUseCustom(false); }}
                        className={`py-3 rounded-xl font-mono font-bold text-lg transition-all border ${
                          !useCustom && targetScore === score
                            ? 'bg-primary/15 border-primary text-primary gold-glow'
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
                          ? 'bg-primary/15 border-primary text-primary gold-glow'
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
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors mt-3"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Start Button */}
        <div className="sticky bottom-0 pt-3 pb-5 bg-background/80 backdrop-blur sm:static sm:bg-transparent sm:pt-4">
          <motion.button
            onClick={handleStart}
            className="w-full gold-gradient text-primary-foreground font-arabic font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-3 gold-glow-strong"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Play className="w-6 h-6" />
            <span>ابدأ اللعب</span>
          </motion.button>
        </div>
    </PageShell>
  );
}
