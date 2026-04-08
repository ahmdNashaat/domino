import { cn } from '@/lib/utils';

interface FaceDownHandProps {
  count: number;
  orientation?: 'horizontal' | 'vertical';
  maxTiles?: number;
  className?: string;
}

export default function FaceDownHand({
  count,
  orientation = 'horizontal',
  maxTiles = 10,
  className,
}: FaceDownHandProps) {
  const visible = Math.min(count, maxTiles);
  const overflow = Math.max(0, count - visible);
  const isVertical = orientation === 'vertical';

  // Tile face dimensions — portrait shape (like real domino)
  const tileW = 22;
  const tileH = 44;

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        isVertical ? 'flex-col gap-1' : 'flex-row gap-1',
        className
      )}
    >
      {Array.from({ length: visible }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-border/50 shadow-sm diamond-pattern flex-shrink-0"
          style={{
            width: isVertical ? tileH : tileW,   // rotate visually for side players
            height: isVertical ? tileW : tileH,
            background: 'hsl(var(--tile-back))',
          }}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] font-mono text-muted-foreground/60 ml-0.5">+{overflow}</span>
      )}
    </div>
  );
}