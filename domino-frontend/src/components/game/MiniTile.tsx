import { DominoTile } from '@/types/contracts';
import { cn } from '@/lib/utils';

interface MiniTileProps {
  tile: DominoTile;
  className?: string;
}

export default function MiniTile({ tile, className }: MiniTileProps) {
  return (
    <div
      className={cn(
        'w-6 h-10 rounded-md border border-primary/40 tile-face flex flex-col items-center justify-center text-[10px] font-mono text-foreground shadow-sm',
        className
      )}
    >
      <span>{tile[0]}</span>
      <span className="w-4 h-px bg-[hsl(var(--tile-divider))] my-0.5" />
      <span>{tile[1]}</span>
    </div>
  );
}
