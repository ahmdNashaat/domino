import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import PageShell from '@/components/PageShell';

const modes = [
  {
    key: 'koutchina',
    title: 'كوتشينة الدومينو',
    emoji: '🃏',
    desc: 'اسحب واجمع - لعبة سريعة ومبتكرة',
    features: ['28 قطعة', 'بصرة وينونة', '2 لاعبين'],
  },
  {
    key: 'classic',
    title: 'الدومينو الكلاسيكي',
    emoji: '🎲',
    desc: 'طابق الأرقام وتخلص من قطعك',
    features: ['28 قطعة', 'سلسلة ومقبرة', '2-4 لاعبين'],
  },
];

export default function ModePage() {
  const navigate = useNavigate();

  return (
    <PageShell maxWidth="lg" className="bg-background flex flex-col" dir="rtl">
        <motion.div
          className="flex items-center gap-3 pt-6 pb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => navigate('/home')}
            className="w-10 h-10 rounded-full bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold gold-text font-arabic">اختر نوع اللعبة</h1>
            <p className="text-xs text-muted-foreground font-arabic">اختر المود اللي يعجبك</p>
          </div>
        </motion.div>

        <div className="mt-4 flex flex-col gap-4 pb-6">
          {modes.map((mode, i) => (
            <motion.button
              key={mode.key}
              className="w-full bg-card border-2 border-primary/60 rounded-2xl p-6 text-right relative overflow-hidden group hover:border-primary transition-all"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.15 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/room?variant=${mode.key}`)}
            >
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-4xl flex-shrink-0">
                  {mode.emoji}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold font-arabic text-foreground">{mode.title}</h2>
                  <p className="text-sm font-arabic text-muted-foreground mt-1.5">{mode.desc}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {mode.features.map(f => (
                      <span key={f} className="text-[11px] font-arabic px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
    </PageShell>
  );
}
