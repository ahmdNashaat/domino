import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { DominoTile } from '@/types/contracts';
import MiniTile from './MiniTile';

interface ActionBadgeProps {
  action: 'play' | 'draw' | 'pass' | null;
  lastPlayedTile?: DominoTile;
  className?: string;
}

export default function ActionBadge({ action, lastPlayedTile, className }: ActionBadgeProps) {
  return (
    <AnimatePresence>
      {action && (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {action === 'play' && lastPlayedTile ? (
            <MiniTile tile={lastPlayedTile} />
          ) : (
            <Badge variant="secondary" className="font-arabic text-[10px]">
              {action === 'draw' ? '📥 سحب' : '⏭ مرر'}
            </Badge>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
