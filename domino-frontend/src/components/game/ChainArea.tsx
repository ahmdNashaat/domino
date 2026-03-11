import { useRef, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DominoTile } from '@/types/contracts';
import { isDouble } from '@/utils/classicGameEngine';

interface ChainAreaProps {
  chain: DominoTile[];
  chainEnds: [number, number];
}

const TILE_W = 48;
const TILE_H = 24;
const DOUBLE_W = 24;
const DOUBLE_H = 48;
const GAP = 2;

function DotPattern({ count }: { count: number }) {
  const positions: Record<number, [number, number][]> = {
    0: [],
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 25], [50, 50], [70, 75]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 25], [70, 25], [50, 50], [30, 75], [70, 75]],
    6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
  };
  const pos = positions[count] || [];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {pos.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={9} className="fill-[hsl(var(--tile-dot))]" />
      ))}
    </svg>
  );
}

interface TilePos {
  x: number;
  y: number;
  tile: DominoTile;
  double: boolean;
}

function calculateSnakePositions(chain: DominoTile[], containerWidth: number): { positions: TilePos[]; totalW: number; totalH: number } {
  if (chain.length === 0) return { positions: [], totalW: 0, totalH: 0 };

  const maxRowWidth = Math.max(containerWidth, 120);
  const positions: TilePos[] = [];

  let curX = 0;
  let direction = 1; // 1=LTR, -1=RTL
  let rowIndex = 0;
  let maxX = 0;

  const rowH = DOUBLE_H;

  for (let i = 0; i < chain.length; i++) {
    const tile = chain[i];
    const dbl = isDouble(tile);
    const tileW = dbl ? DOUBLE_W : TILE_W;
    const tileH = dbl ? DOUBLE_H : TILE_H;

    // Check overflow
    const nextEdge = direction === 1 ? curX + tileW : curX - tileW;
    const wouldOverflow = direction === 1 ? nextEdge > maxRowWidth : nextEdge < 0;

    if (wouldOverflow && i > 0) {
      rowIndex++;
      direction *= -1;
      curX = direction === 1 ? 0 : maxRowWidth;
    }

    let placeX: number;
    if (direction === 1) {
      placeX = curX;
      curX += tileW + GAP;
    } else {
      placeX = curX - tileW;
      curX -= tileW + GAP;
    }

    const placeY = rowIndex * (rowH + GAP) + (rowH - tileH) / 2;

    positions.push({ x: placeX, y: placeY, tile, double: dbl });
    maxX = Math.max(maxX, placeX + tileW);
  }

  const totalH = (rowIndex + 1) * (rowH + GAP);
  return { positions, totalW: maxX, totalH };
}

function ChainTile({ pos, index, isLast }: { pos: TilePos; index: number; isLast: boolean }) {
  const glowClass = isLast ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/20' : '';

  if (pos.double) {
    return (
      <motion.div
        className={`absolute flex flex-col tile-face rounded-md border border-primary/20 shadow-md overflow-hidden ${glowClass}`}
        style={{ left: pos.x, top: pos.y, width: DOUBLE_W, height: DOUBLE_H }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: index * 0.02 }}
      >
        <div className="flex-1 p-0.5"><DotPattern count={pos.tile[0]} /></div>
        <div className="w-4 mx-auto h-px bg-[hsl(var(--tile-divider))]" />
        <div className="flex-1 p-0.5"><DotPattern count={pos.tile[1]} /></div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`absolute flex flex-row tile-face rounded-md border border-primary/20 shadow-md overflow-hidden ${glowClass}`}
      style={{ left: pos.x, top: pos.y, width: TILE_W, height: TILE_H }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: index * 0.02 }}
    >
      <div className="flex-1 p-0.5"><DotPattern count={pos.tile[0]} /></div>
      <div className="h-4 my-auto w-px bg-[hsl(var(--tile-divider))]" />
      <div className="flex-1 p-0.5"><DotPattern count={pos.tile[1]} /></div>
    </motion.div>
  );
}

export default function ChainArea({ chain }: ChainAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 200 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { positions, totalW, totalH } = useMemo(
    () => calculateSnakePositions(chain, dims.w - 16),
    [chain, dims.w]
  );

  const scaleX = totalW > 0 ? dims.w / totalW : 1;
  const scaleY = totalH > 0 ? dims.h / totalH : 1;
  const scale = Math.min(scaleX, scaleY, 2.5);

  if (chain.length === 0) {
    return (
      <div ref={containerRef} className="flex-1 flex items-center justify-center">
        <motion.p
          className="text-muted-foreground font-arabic text-base opacity-50"
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
      className="flex-1 flex items-center justify-center overflow-hidden px-2 py-2"
    >
      <div
        className="relative"
        style={{
          width: totalW,
          height: totalH,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        {positions.map((pos, i) => (
          <ChainTile
            key={`${pos.tile[0]}-${pos.tile[1]}-${i}`}
            pos={pos}
            index={i}
            isLast={i === chain.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
