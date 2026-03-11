import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, Trophy, Sparkles, Zap, Users } from 'lucide-react';
import { useStatsStore } from '@/store/statsStore';
import { useSettingsStore } from '@/store/settingsStore';
import PageShell from '@/components/PageShell';

export default function HomePage() {
  const navigate = useNavigate();
  const { wins } = useStatsStore();
  const { playerName, playerAvatar } = useSettingsStore();

  return (
    <PageShell
      maxWidth="full"
      className="bg-gradient-to-br from-background via-secondary to-muted flex flex-col relative overflow-hidden"
      dir="rtl"
    >
        
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-20 right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-32 left-10 w-60 h-60 rounded-full blur-3xl"
            style={{ background: 'hsl(var(--gold-warm) / 0.1)' }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Hexagon SVG pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="hex-home" x="0" y="0" width="56" height="100" patternUnits="userSpaceOnUse">
                <polygon points="28,8 48,20 48,44 28,56 8,44 8,20" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hex-home)" />
          </svg>
        </div>

        {/* Header */}
        <motion.div
          className="relative z-10 py-4 flex items-center justify-between"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          {/* Settings */}
          <motion.button
            onClick={() => navigate('/settings')}
            className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden bg-card/60 backdrop-blur-xl border border-border"
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <Settings className="w-6 h-6 relative z-10 text-primary" />
          </motion.button>

          {/* Player card */}
          <motion.div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl relative overflow-hidden bg-card/60 backdrop-blur-xl border border-border"
            whileHover={{ scale: 1.02 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
            <div className="relative text-left">
              <p className="font-arabic font-bold text-foreground text-sm">{playerName}</p>
              <div className="flex items-center gap-1.5 text-primary">
                <Trophy className="w-3.5 h-3.5" />
                <span className="text-xs font-mono font-semibold">{wins}</span>
              </div>
            </div>
            <div className="relative w-11 h-11 rounded-xl gold-gradient flex items-center justify-center shadow-lg text-xl">
              {playerAvatar}
            </div>
          </motion.div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-start pb-10 pt-4 relative z-10">
          
          {/* Domino Tiles */}
          <motion.div
            className="mb-8"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          >
            <div className="relative flex items-center gap-4">
              {/* Left Domino - 4|6 */}
              <motion.div
                className="w-20 h-36 rounded-2xl shadow-2xl relative border-2 border-border"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--tile-face)), hsl(var(--tile-face) / 0.85))',
                  transformStyle: 'preserve-3d',
                }}
                animate={{ rotateY: [0, 10, 0], y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="relative h-full flex flex-col p-2">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(var(--tile-dot))' }} />
                      ))}
                    </div>
                  </div>
                  <div className="h-px mx-2" style={{ background: 'hsl(var(--tile-divider))' }} />
                  <div className="flex-1 flex items-center justify-center">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-full" style={{ background: 'hsl(var(--tile-dot))' }} />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right Domino - 2|1 */}
              <motion.div
                className="w-20 h-36 rounded-2xl shadow-2xl relative border-2 border-border"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--tile-face)), hsl(var(--tile-face) / 0.9))',
                  transformStyle: 'preserve-3d',
                }}
                animate={{ rotateY: [0, -10, 0], y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <div className="relative h-full flex flex-col p-2">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-2">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(var(--tile-dot))' }} />
                      ))}
                    </div>
                  </div>
                  <div className="h-px mx-2" style={{ background: 'hsl(var(--tile-divider))' }} />
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(var(--tile-dot))' }} />
                  </div>
                </div>
              </motion.div>

              {/* Glow behind tiles */}
              <div className="absolute inset-0 -z-10 blur-2xl bg-primary/20 scale-150" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h1
              className="text-5xl font-bold mb-2 text-transparent bg-clip-text font-arabic"
              style={{
                backgroundImage: 'linear-gradient(to left, hsl(var(--primary)), hsl(var(--gold-warm)), hsl(var(--gold-dark)))',
                backgroundSize: '200% auto',
              }}
            >
              قاعـدة دومينو
            </h1>
            <motion.p
              className="font-arabic text-sm text-primary"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              تعالي اشبشاي
            </motion.p>
          </motion.div>

          {/* Action Buttons */}
          <div className="w-full max-w-md space-y-4">
            {/* Offline */}
            <motion.button
              onClick={() => navigate('/mode')}
              className="w-full relative overflow-hidden rounded-3xl p-6 group gold-gradient"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 25 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Shimmer */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative flex items-center justify-between">
                <div className="text-right flex-1">
                  <h3 className="text-2xl font-bold text-primary-foreground mb-1 font-arabic">أوفلاين</h3>
                  <p className="text-sm text-primary-foreground/80 font-medium font-arabic">العب ضد البوت أو مع صديق على نفس الجهاز</p>
                </div>
                <motion.div
                  className="w-14 h-14 rounded-2xl bg-primary-foreground/10 flex items-center justify-center"
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <Zap className="w-7 h-7 text-primary-foreground" fill="currentColor" />
                </motion.div>
              </div>
              <motion.div
                className="absolute top-4 right-4"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-4 h-4 text-primary-foreground/60" />
              </motion.div>
            </motion.button>

            {/* Online */}
            <motion.button
              onClick={() => navigate('/online')}
              className="w-full relative overflow-hidden rounded-3xl p-6 group bg-card/60 backdrop-blur-xl border-2 border-border"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, type: 'spring', stiffness: 200, damping: 25 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative flex items-center justify-between">
                <div className="text-right flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-1 font-arabic">
                    مع أصدقاء <span className="text-lg text-primary">(أونلاين)</span>
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium font-arabic">أنشئ غرفة والعب عبر الإنترنت</p>
                </div>
                <motion.div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/20 border border-border"
                  whileHover={{ rotate: -360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <Users className="w-7 h-7 text-primary" />
                </motion.div>
              </div>
            </motion.button>
          </div>

          {/* Footer */}
          <motion.p
            className="mt-8 text-xs text-center font-arabic text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            اختر نمط اللعب للبدء
          </motion.p>
        </div>
    </PageShell>
  );
}
