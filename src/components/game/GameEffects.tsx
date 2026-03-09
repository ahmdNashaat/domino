import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameEvent, DominoTile } from '@/types/contracts';
import {
  playBasraSound, playJokerSound, playBonbonaSound, playInvalidSound,
  playOpponentBasraSound, playCaptureSound,
} from '@/utils/soundEffects';

interface Props {
  event: GameEvent | null;
  onComplete?: () => void;
  isOpponentEvent?: boolean;
}

function FlyingTile({ tile, index, isMyEvent }: { tile: DominoTile; index: number; isMyEvent: boolean }) {
  // Fly from center to bottom (player) or top (opponent)
  const targetY = isMyEvent ? 280 : -280;
  const spreadX = (index - 2) * 35;

  return (
    <motion.div
      className="absolute w-8 h-14 rounded-md border border-primary/40 bg-card shadow-lg flex flex-col items-center justify-center gap-0.5 overflow-hidden"
      initial={{ opacity: 1, scale: 1, x: spreadX * 0.3, y: 0, rotate: 0 }}
      animate={{
        opacity: [1, 1, 0.6, 0],
        scale: [1, 0.9, 0.6, 0.3],
        x: spreadX,
        y: targetY,
        rotate: isMyEvent ? 15 + index * 8 : -15 - index * 8,
      }}
      transition={{
        duration: 0.7,
        delay: index * 0.06,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <span className="text-[8px] font-bold text-primary">{tile[0]}</span>
      <div className="w-5 h-px bg-primary/30" />
      <span className="text-[8px] font-bold text-primary">{tile[1]}</span>
    </motion.div>
  );
}

function DroppingTile({ tile, isMyEvent }: { tile: DominoTile; isMyEvent: boolean }) {
  if (!tile) return null;
  // Fly from hand (bottom for player, top for opponent) to center (table)
  const startY = isMyEvent ? 200 : -200;

  return (
    <motion.div
      className="fixed inset-0 z-45 pointer-events-none flex items-center justify-center"
    >
      <motion.div
        className="w-10 h-16 rounded-lg border-2 border-primary/50 bg-card shadow-xl flex flex-col items-center justify-center gap-0.5"
        initial={{ opacity: 1, scale: 0.7, y: startY, rotate: isMyEvent ? -10 : 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          duration: 0.45,
          ease: [0.34, 1.56, 0.64, 1], // spring-like overshoot
        }}
      >
        <span className="text-xs font-bold text-primary">{tile[0]}</span>
        <div className="w-6 h-px bg-primary/30" />
        <span className="text-xs font-bold text-primary">{tile[1]}</span>
      </motion.div>
    </motion.div>
  );
}

function FlyingTiles({ tiles, isMyEvent }: { tiles: DominoTile[]; isMyEvent: boolean }) {
  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
      {tiles.slice(0, 8).map((tile, i) => (
        <FlyingTile key={`fly-${i}`} tile={tile} index={i} isMyEvent={isMyEvent} />
      ))}
    </div>
  );
}

export default function GameEffects({ event, onComplete, isOpponentEvent = false }: Props) {
  useEffect(() => {
    if (!event) return;
    switch (event.type) {
      case 'basra':
        isOpponentEvent ? playOpponentBasraSound() : playBasraSound();
        break;
      case 'joker': playJokerSound(); break;
      case 'bonbona': playBonbonaSound(); break;
      case 'invalid': playInvalidSound(); break;
      case 'capture': playCaptureSound(); break;
    }
  }, [event, isOpponentEvent]);

  if (!event) return null;

  const isMyEvent = event.type !== 'invalid' && 'playerId' in event && event.playerId === 'player';

  // Get captured tiles for flying animation
  const capturedTiles: DominoTile[] =
    event.type === 'capture' ? event.tiles :
    event.type === 'joker' ? event.tilesSwept :
    [];

  return (
    <AnimatePresence>
      {event.type === 'drop' && (
        <motion.div key="drop-anim" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DroppingTile tile={event.tile} isMyEvent={isMyEvent} />
        </motion.div>
      )}

      {(event.type === 'capture' || event.type === 'joker') && capturedTiles.length > 0 && (
        <motion.div key="fly-anim" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FlyingTiles tiles={capturedTiles} isMyEvent={isMyEvent} />
        </motion.div>
      )}

      {event.type === 'basra' && (
        <motion.div
          key="basra-anim"
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 border-4 border-primary rounded-full animate-ring-burst" />
          <motion.div
            className="text-center"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <p className="text-6xl font-bold gold-text font-arabic">✦ بصرة! ✦</p>
            <p className="text-lg text-primary/80 font-arabic mt-2">+100 نقطة</p>
          </motion.div>
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`basra-p-${i}`}
              className="absolute w-2 h-2 bg-primary rounded-full"
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: Math.cos((i / 12) * Math.PI * 2) * 200,
                y: Math.sin((i / 12) * Math.PI * 2) * 200,
                opacity: 0,
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          ))}
        </motion.div>
      )}

      {event.type === 'bonbona' && (
        <motion.div
          key="bonbona-anim"
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-accent/15"
            initial={{ scale: 0 }}
            animate={{ scale: 2 }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            className="text-center"
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 180 }}
          >
            <p className="text-5xl font-bold text-accent font-arabic">💎 بونبونة!</p>
            <p className="text-sm text-accent/70 font-arabic mt-2">
              {isMyEvent ? 'سرقت من الخصم!' : 'الخصم سرق منك!'}
            </p>
          </motion.div>
        </motion.div>
      )}

      {event.type === 'joker' && (
        <motion.div
          key="joker-anim"
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-violet/20"
            initial={{ x: '100%' }}
            animate={{ x: '-100%' }}
            transition={{ duration: 0.8 }}
          />
          <motion.div
            initial={{ scale: 0, rotate: 180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: -180 }}
            transition={{ type: 'spring', stiffness: 150 }}
          >
            <p className="text-6xl font-bold text-violet font-arabic">🃏 جوكر!</p>
          </motion.div>
        </motion.div>
      )}

      {event.type === 'capture' && (
        <motion.div
          key="capture-anim"
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="text-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-2xl font-bold text-primary/80 font-arabic">
              {isMyEvent ? '🂠 أكلت!' : '🂠 الخصم أكل!'}
            </p>
          </motion.div>
        </motion.div>
      )}

      {event.type === 'invalid' && (
        <motion.div
          key="invalid-anim"
          className="fixed top-20 left-1/2 z-50 -translate-x-1/2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-lg font-arabic text-sm backdrop-blur-sm">
            {event.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
