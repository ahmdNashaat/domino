import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DominoTile as DominoTileType } from '@/types/contracts';
import DominoTile from './DominoTile';

interface Props {
  hand: DominoTileType[];
  activeIndex: number;
  isPlayer: boolean;
  label: string;
  nameBadge?: ReactNode;
  onActiveClick?: () => void;
}

export default function PlayerHand({ hand, activeIndex, isPlayer, label, nameBadge, onActiveClick }: Props) {
  // Extract name and count from label like "البوت (11)"
  const match = label.match(/^(.+?)\s*\((\d+)\)$/);
  const name = match ? match[1] : label;
  const count = match ? match[2] : String(hand.length);

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5 mr-1">
        <span className="text-sm font-arabic font-semibold text-foreground">{name}</span>
        {nameBadge}
        <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-primary/20 text-primary text-[11px] font-mono font-bold leading-none">
          {count}
        </span>
      </div>
      <div
        className="flex gap-1 flex-wrap"
        style={{ direction: 'ltr', justifyContent: 'flex-start' }}
      >
        <AnimatePresence mode="popLayout">
          {hand.map((tile, idx) => {
            const isActive = idx === activeIndex;
            const showFace = isActive ? true : (isPlayer ? false : false);

            return (
              <motion.div
                key={`${tile[0]}-${tile[1]}-${idx}`}
                initial={{ opacity: 0, y: isPlayer ? 30 : -30, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, y: isPlayer ? -20 : 20 }}
                transition={{ duration: 0.3 }}
              >
                <DominoTile
                  tile={isActive ? tile : null}
                  size={isActive ? 'lg' : 'md'}
                  state={isActive ? 'active' : 'normal'}
                  rotation={0}
                  onClick={isActive && isPlayer && onActiveClick ? onActiveClick : undefined}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
