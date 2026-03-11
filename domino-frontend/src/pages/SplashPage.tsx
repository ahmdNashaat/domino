import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function StarParticle({ index }: { index: number }) {
  const left = Math.random() * 100;
  const top = Math.random() * 100;
  const size = 1.5 + Math.random() * 3;
  const duration = 2 + Math.random() * 3;
  const delay = Math.random() * 3;

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle, hsl(51, 100%, 70%), hsl(45, 90%, 40%))`,
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.5, 1.2, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export default function SplashPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 2;
      });
    }, 50);

    const timeout = setTimeout(() => {
      navigate('/home');
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center overflow-hidden">
      {/* Radial glow behind tile */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, hsl(45, 90%, 50%) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Star particles */}
      {[...Array(typeof window !== 'undefined' && window.innerWidth < 768 ? 15 : 40)].map((_, i) => (
        <StarParticle key={i} index={i} />
      ))}

      {/* Top decorative line */}
      <motion.div
        className="absolute top-12 flex flex-col items-center gap-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="w-2 h-2 rotate-45 border border-primary/60" />
        <p className="text-xs tracking-[0.4em] text-muted-foreground uppercase font-mono">
          Nashaat Gaming
        </p>
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </motion.div>

      {/* Main content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.2 }}
      >
        {/* Arabic Title */}
        <h1 className="text-5xl md:text-6xl font-bold gold-text font-arabic text-center leading-tight">
          كوتشينة الدومينو
        </h1>

        {/* Decorative separator */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-primary/50" />
          <div className="w-2 h-2 rotate-45 border border-primary/60" />
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-primary/50" />
        </div>

        {/* Domino Tile */}
        <motion.div
          className="relative"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-24 h-48 tile-face rounded-2xl border-2 border-primary/30 flex flex-col items-center justify-center gap-1 gold-glow-strong shadow-2xl">
            {/* Top dots - 6 */}
            <div className="flex flex-col gap-1.5 py-2">
              <div className="flex gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
              </div>
              <div className="flex gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
              </div>
            </div>
            {/* Divider with metal dot */}
            <div className="relative w-16 flex items-center">
              <div className="flex-1 h-[2px] bg-tile-divider" />
              <div className="w-3 h-3 rounded-full bg-gradient-to-b from-muted-foreground/60 to-muted-foreground/30 mx-1 shadow-sm" />
              <div className="flex-1 h-[2px] bg-tile-divider" />
            </div>
            {/* Bottom dots - 6 */}
            <div className="flex flex-col gap-1.5 py-2">
              <div className="flex gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
              </div>
              <div className="flex gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
                <div className="w-3.5 h-3.5 rounded-full bg-tile-dot shadow-inner" />
              </div>
            </div>
          </div>
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl overflow-hidden"
            initial={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
            />
          </motion.div>
        </motion.div>

        {/* English subtitle */}
        <p className="text-sm tracking-[6px] text-primary/60 font-display uppercase">
          Domino Cards
        </p>
      </motion.div>

      {/* Bottom tagline + progress */}
      <motion.div
        className="absolute bottom-16 flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-lg font-arabic text-primary/70 font-semibold">
          تعالى هتنبسط
        </p>
        <div className="w-48">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full gold-gradient rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
