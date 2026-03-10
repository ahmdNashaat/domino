import { motion } from 'framer-motion';
import { DominoTile as DominoTileType, TileState, TileSize } from '@/types/contracts';
import { isBlankTile } from '@/utils/gameEngine';
import { cn } from '@/lib/utils';

// Pip positions on a 3x3 grid (col, row) — 0-indexed
const PIP_MAP: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

interface Props {
  tile: DominoTileType | null;
  size: TileSize;
  state?: TileState;
  onClick?: () => void;
  className?: string;
  rotation?: number;
  highlight?: boolean;
}

const sizeMap = {
  sm: { w: 40, h: 80, pip: 6, grid: 24, radius: 6 },
  md: { w: 52, h: 104, pip: 8, grid: 32, radius: 8 },
  lg: { w: 68, h: 136, pip: 10, grid: 42, radius: 10 },
};

function PipDot({ col, row, pipSize, gridSize }: { col: number; row: number; pipSize: number; gridSize: number }) {
  const cellSize = gridSize / 3;
  const cx = cellSize * col + cellSize / 2;
  const cy = cellSize * row + cellSize / 2;

  return (
    <div
      className="absolute rounded-full"
      style={{
        width: pipSize,
        height: pipSize,
        left: cx - pipSize / 2,
        top: cy - pipSize / 2,
        background: 'hsl(var(--tile-dot))',
        boxShadow: `inset 0 ${pipSize * 0.15}px ${pipSize * 0.2}px rgba(0,0,0,0.35)`,
      }}
    />
  );
}

function TileHalf({ value, dims }: { value: number; dims: typeof sizeMap.lg }) {
  const pips = PIP_MAP[value] || [];
  const padding = dims.w * 0.12;
  const gridSize = dims.w - padding * 2;

  return (
    <div className="relative flex-1" style={{ margin: padding }}>
      {pips.map(([col, row], i) => (
        <PipDot key={i} col={col} row={row} pipSize={dims.pip} gridSize={gridSize} />
      ))}
    </div>
  );
}

const stateStyles = {
  normal: 'border-transparent',
  active: 'animate-pulse-gold border-gold-bright',
  selected: 'border-emerald ring-2 ring-emerald/40',
  capturable: 'border-emerald/50',
  frozen: 'opacity-60 border-muted',
};

export default function DominoTile({ tile, size, state = 'normal', onClick, className, rotation = 0, highlight = false }: Props) {
  const dims = sizeMap[size];
  const isFaceDown = tile === null;

  if (isFaceDown) {
    return (
      <motion.div
        className={cn(
          'tile-back diamond-pattern rounded-lg border-2 cursor-default flex items-center justify-center',
          className
        )}
        style={{
          width: dims.w, height: dims.h, borderRadius: dims.radius, rotate: rotation,
          borderColor: 'hsl(var(--tile-back-border) / 0.5)',
        }}
        whileHover={{ scale: 1.02 }}
      >
        <div className="w-3 h-3 border-2 rotate-45" style={{ borderColor: 'hsl(var(--tile-back-border) / 0.6)' }} />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        'tile-face cursor-pointer relative flex flex-col overflow-hidden border-2',
        stateStyles[state],
        state === 'frozen' && 'cursor-not-allowed',
        className
      )}
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: dims.radius,
        rotate: rotation,
        boxShadow: '0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
      onClick={state !== 'frozen' ? onClick : undefined}
      whileHover={state !== 'frozen' ? { scale: 1.08, y: -4 } : {}}
      whileTap={state !== 'frozen' ? { scale: 0.95 } : {}}
      layout
    >
      <TileHalf value={tile[0]} dims={dims} />
      {/* Divider line with center pin */}
      <div className="relative flex items-center mx-[10%]">
        <div className="flex-1 h-[2px] rounded-full" style={{ background: 'hsl(var(--tile-divider))' }} />
        <div
          className="rounded-full shrink-0"
          style={{
            width: dims.pip * 0.6,
            height: dims.pip * 0.6,
            background: 'hsl(var(--tile-divider) / 0.7)',
            border: '1px solid hsl(var(--tile-divider))',
            margin: '0 2px',
          }}
        />
        <div className="flex-1 h-[2px] rounded-full" style={{ background: 'hsl(var(--tile-divider))' }} />
      </div>
      <TileHalf value={tile[1]} dims={dims} />
      {highlight && (
        <div className="absolute top-1 right-1 text-yellow-400 text-lg pointer-events-none">★</div>
      )}
    </motion.div>
  );
}
