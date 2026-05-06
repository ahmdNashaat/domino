import { forwardRef, MouseEvent } from 'react';
import { DominoTile } from '@/types/contracts';
import { cn } from '@/lib/utils';
import FaceDownHand from './FaceDownHand';
import ActionBadge from './ActionBadge';

interface ClassicPlayerZoneProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  avatar: string;
  name: string;
  cardCount: number;
  isCurrentTurn: boolean;
  lastAction: 'play' | 'draw' | 'pass' | null;
  lastPlayedTile?: DominoTile;
  showHand?: boolean;
}

const ClassicPlayerZone = forwardRef<HTMLDivElement, ClassicPlayerZoneProps>(
  function ClassicPlayerZone(
    { position, avatar, name, cardCount, isCurrentTurn, lastAction, lastPlayedTile, showHand = true },
    ref
  ) {
    const isSide = position === 'left' || position === 'right';
    const isTop = position === 'top';

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
    };

    return (
      <div
        ref={ref}
        onClick={handleClick}
        className={cn(
          'relative flex items-center gap-2 px-3 py-2 rounded-2xl',
          'bg-secondary/40 border border-border/60 backdrop-blur-sm',
          // Side players: compact column
          isSide && 'flex-col w-20 py-3',
          // Top/bottom players: row
          !isSide && 'flex-col items-center min-w-[120px]',
        )}
      >
        {/* Action badge */}
        <ActionBadge
          action={lastAction}
          lastPlayedTile={lastPlayedTile}
          className="absolute -top-6 left-1/2 -translate-x-1/2 z-10"
        />

        {/* Avatar + info */}
        <div className={cn('flex items-center gap-2', isSide && 'flex-col gap-1')}>
          {/* Avatar */}
          <div
            className={cn(
              'rounded-full flex items-center justify-center text-xl',
              'bg-secondary/70 border-2 transition-colors',
              isCurrentTurn
                ? 'border-yellow-400 shadow-[0_0_12px_hsl(50_100%_50%/0.5)]'
                : 'border-transparent',
              isSide ? 'w-9 h-9 text-lg' : 'w-10 h-10',
            )}
            style={isCurrentTurn ? { animation: 'turn-pulse 1.5s ease-in-out infinite' } : {}}
          >
            {avatar}
          </div>

          {/* Name + count */}
          <div className="flex flex-col items-center leading-none gap-0.5">
            <span
              className={cn(
                'font-arabic text-muted-foreground truncate',
                isSide ? 'text-[9px] max-w-[60px]' : 'text-[10px] max-w-[100px]',
              )}
            >
              {name}
            </span>
            <span
              className={cn(
                'font-mono font-bold',
                isSide ? 'text-xl' : 'text-2xl',
                isCurrentTurn ? 'text-yellow-400' : 'text-foreground',
              )}
            >
              {cardCount}
            </span>
          </div>
        </div>

        {/* Face-down hand */}
        {showHand && cardCount > 0 && (
          <FaceDownHand
            count={cardCount}
            orientation={isSide ? 'vertical' : 'horizontal'}
            maxTiles={isSide ? 7 : 10}
          />
        )}
      </div>
    );
  }
);

export default ClassicPlayerZone;
