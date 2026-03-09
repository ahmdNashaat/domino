import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DominoTile as DominoTileType } from '@/types/contracts';
import DominoTile from './DominoTile';
import { tilesEqual } from '@/utils/gameEngine';

interface Props {
  label: string;
  tiles: DominoTileType[];
  isMine: boolean;
  reverse?: boolean;
  selectedBonbonaTiles?: DominoTileType[];
  onTileTap?: (tile: DominoTileType) => void;
}

export default function WinPile({ label, tiles, isMine, reverse = false, selectedBonbonaTiles = [], onTileTap }: Props) {
  const displayTiles = [...tiles].reverse();
  const prevCount = useRef(tiles.length);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (tiles.length > prevCount.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevCount.current = tiles.length;
      return () => clearTimeout(t);
    }
    prevCount.current = tiles.length;
  }, [tiles.length]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col items-start gap-0">
        <span className="text-[10px] font-arabic text-muted-foreground/50 leading-tight">{label}</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={tiles.length}
            className={`font-mono text-xl font-bold leading-none ${flash ? 'gold-text drop-shadow-[0_0_12px_rgba(255,215,0,0.5)]' : 'text-primary'}`}
            initial={flash ? { scale: 1.5, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            {tiles.length}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="max-w-[45vw] overflow-x-auto">
        <div className="flex gap-0.5 items-center py-1" style={{ direction: 'ltr' }}>
          {displayTiles.map((tile, idx) => {
            const selected = selectedBonbonaTiles.some(t => tilesEqual(t, tile));
            return (
              <DominoTile
                key={`pile-${tile[0]}-${tile[1]}-${idx}`}
                tile={tile}
                size="sm"
                state={selected ? 'selected' : 'normal'}
                onClick={!isMine && onTileTap ? () => onTileTap(tile) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
