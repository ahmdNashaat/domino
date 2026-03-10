import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DominoTile as DominoTileType } from '@/types/contracts';
import DominoTile from './DominoTile';
import { isBlankTile, tilesEqual } from '@/utils/gameEngine';
import { Check, ArrowDown } from 'lucide-react';

interface Props {
  tiles: DominoTileType[];
  selectedTiles: DominoTileType[];
  canSelect: boolean;
  onToggleTile: (tile: DominoTileType) => void;
  invalidPulse: boolean;
  isWaladActive?: boolean;
  showConfirm?: boolean;
  onConfirm?: () => void;
  activeValue?: number;
  isJoker?: boolean;
  tableEmpty?: boolean;
  canAct?: boolean;
  onDrop?: () => void;
}

export default function TableArea({
  tiles,
  selectedTiles,
  canSelect,
  onToggleTile,
  invalidPulse,
  isWaladActive = false,
  showConfirm = false,
  onConfirm,
  activeValue = 0,
  isJoker = false,
  tableEmpty = false,
  canAct = false,
  onDrop,
}: Props) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`felt-bg rounded-2xl p-4 min-h-[160px] flex flex-col items-center justify-center transition-all relative ${
        invalidPulse ? 'animate-shake border-destructive' : ''
      }`}
    >
      {/* Value hint - redesigned */}
      {canAct && activeValue > 0 && (
        <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background/30 backdrop-blur-sm">
            {isJoker ? (
              <span className="text-xs font-arabic text-foreground/50">
                {tableEmpty ? '🃏 جوكر — اضغط عليه لرميه' : '🃏 جوكر — يكسح الكل'}
              </span>
            ) : (
              <>
                <span className="text-[10px] font-arabic text-foreground/40">قيمة</span>
                <span className="font-mono text-lg font-bold text-primary leading-none">{activeValue}</span>
              </>
            )}
          </div>
        </div>
      )}

      {tiles.length === 0 ? (
        <p className="text-muted-foreground/30 font-arabic text-sm">الطاولة فاضية</p>
      ) : (
        <div ref={tableContainerRef} className="flex-1 w-full overflow-hidden flex items-center justify-center py-2">
          <div className="flex gap-2 flex-wrap justify-center">
            <AnimatePresence>
              {tiles.map((tile, idx) => {
                const blank = isBlankTile(tile);
                const frozen = blank && !isWaladActive;
                const selected = selectedTiles.some(t => tilesEqual(t, tile));

                return (
                  <motion.div
                    key={`table-${tile[0]}-${tile[1]}-${idx}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0, y: -30 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <DominoTile
                      tile={tile}
                      size="md"
                      state={frozen ? 'frozen' : selected ? 'selected' : 'normal'}
                      onClick={canSelect && !frozen ? () => onToggleTile(tile) : undefined}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-3">
        <AnimatePresence>
          {showConfirm && onConfirm && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={onConfirm}
              className="flex items-center gap-2 px-6 py-2.5 gold-gradient text-primary-foreground rounded-xl text-base font-arabic font-bold gold-glow shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
            >
              <Check className="w-5 h-5" />
              تأكيد الأكل
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {canAct && !showConfirm && !isJoker && onDrop && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={onDrop}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted/60 border border-border/50 text-foreground/70 text-sm font-arabic font-semibold hover:bg-muted hover:text-foreground transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
            >
              <ArrowDown className="w-4 h-4" />
              رمي ↵
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
