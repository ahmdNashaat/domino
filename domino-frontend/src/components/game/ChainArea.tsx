import { useRef, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DominoTile } from '@/types/contracts';
import { isDouble } from '@/utils/classicGameEngine';

interface ChainAreaProps {
  chain: DominoTile[];
  chainEnds: [number, number];
  highlightEnds?: boolean;
  onLeftEndClick?: () => void;   // click on first tile → left end
  onRightEndClick?: () => void;  // click on last tile  → right end
}

const GAP = 5;
const MAX_BASE = 38;
const MIN_BASE = 14;

function DotPattern({ count }: { count: number }) {
  const positions: Record<number, [number, number][]> = {
    0: [],
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 25], [72, 25], [50, 50], [28, 75], [72, 75]],
    6: [[28, 18], [72, 18], [28, 50], [72, 50], [28, 82], [72, 82]],
  };
  const pos = positions[Math.min(count, 6)] || [];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {pos.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={11} className="fill-[hsl(var(--tile-dot))]" />
      ))}
    </svg>
  );
}

function ChainTile({
  tile,
  index,
  highlight,
  base,
  onClick,
}: {
  tile: DominoTile;
  index: number;
  highlight: boolean;
  base: number;
  onClick?: () => void;
}) {
  const double = isDouble(tile);
  const glowStyle: React.CSSProperties = highlight
    ? {
        boxShadow: '0 0 0 2.5px hsl(160 100% 39%), 0 0 14px hsl(160 100% 39% / 0.55)',
        cursor: onClick ? 'pointer' : 'default',
      }
    : {};

  const dividerThick = Math.max(1.5, base * 0.04);
  const pulseClass = highlight && onClick ? 'animate-pulse' : '';

  if (double) {
    const W = base;
    const H = base * 2;
    const dividerW = Math.max(2, W * 0.7);
    return (
      <motion.div
        className={`flex-shrink-0 tile-face rounded-md border border-primary/25 shadow-md overflow-hidden flex flex-col ${pulseClass}`}
        style={{ width: W, height: H, ...glowStyle }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22, delay: index * 0.025 }}
        onClick={onClick}
        whileTap={onClick ? { scale: 0.93 } : {}}
      >
        <div className="flex-1 p-[1px]"><DotPattern count={tile[0]} /></div>
        <div className="mx-auto bg-[hsl(var(--tile-divider))]" style={{ width: dividerW, height: dividerThick }} />
        <div className="flex-1 p-[1px]"><DotPattern count={tile[1]} /></div>
      </motion.div>
    );
  }

  const W = base * 2;
  const H = base;
  const dividerH = Math.max(2, H * 0.65);
  return (
    <motion.div
      className={`flex-shrink-0 tile-face rounded-md border border-primary/25 shadow-md overflow-hidden flex flex-row ${pulseClass}`}
      style={{ width: W, height: H, ...glowStyle }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 22, delay: index * 0.025 }}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.93 } : {}}
    >
      <div className="flex-1 p-[1px]"><DotPattern count={tile[0]} /></div>
      <div className="my-auto bg-[hsl(var(--tile-divider))]" style={{ width: dividerThick, height: dividerH }} />
      <div className="flex-1 p-[1px]"><DotPattern count={tile[1]} /></div>
    </motion.div>
  );
}

export default function ChainArea({
  chain,
  highlightEnds = false,
  onLeftEndClick,
  onRightEndClick,
}: ChainAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(700);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const base = useMemo(() => {
    if (chain.length === 0) return MAX_BASE;
    const available = containerW - 24;
    const doubleCount = chain.filter(isDouble).length;
    const normalCount = chain.length - doubleCount;
    const totalGaps = GAP * (chain.length - 1);
    const slots = normalCount * 2 + doubleCount;
    const raw = slots > 0 ? (available - totalGaps) / slots : MAX_BASE;
    return Math.max(MIN_BASE, Math.min(MAX_BASE, raw));
  }, [chain, containerW]);

  if (chain.length === 0) {
    return (
      <div ref={containerRef} className="flex-1 flex items-center justify-center">
        <motion.p
          className="text-muted-foreground font-arabic text-base opacity-50 select-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ضع أول قطعة
        </motion.p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className="flex-1 flex items-center justify-center overflow-hidden px-3"
    >
      {/* Hint label when ends are highlighted */}
      {highlightEnds && (onLeftEndClick || onRightEndClick) && (
        <motion.p
          className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] font-arabic text-emerald-400 bg-card/80 px-3 py-1 rounded-full border border-emerald-400/30 pointer-events-none z-10"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          اضغط على الطرف المطلوب 🟢
        </motion.p>
      )}

      <div
        className="flex flex-row items-center justify-center"
        style={{ gap: GAP, flexWrap: 'nowrap' }}
      >
        {chain.map((tile, i) => {
          const isFirst = i === 0;
          const isLast = i === chain.length - 1;
          const isEnd = isFirst || isLast;
          const clickHandler = highlightEnds && isEnd
            ? isFirst ? onLeftEndClick : onRightEndClick
            : undefined;

          return (
            <ChainTile
              key={`${tile[0]}-${tile[1]}-${i}`}
              tile={tile}
              index={i}
              base={base}
              highlight={highlightEnds && isEnd}
              onClick={clickHandler}
            />
          );
        })}
      </div>
    </div>
  );
}