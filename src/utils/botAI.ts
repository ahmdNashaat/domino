import { DominoTile, BotDifficulty } from '@/types/contracts';
import { findAllCaptures, getTileHandValue, isJokerTile, getTileTableValue, tilesEqual, checkBonbona, isBasra } from './gameEngine';

export interface BotDecision {
  selected: DominoTile[];
  drop: boolean;
  bonbona: boolean;
  bonbonaTiles: DominoTile[];
}

export function makeBotDecision(
  activeTile: DominoTile,
  table: DominoTile[],
  difficulty: BotDifficulty,
  opponentLastCapture: DominoTile | null,
  opponentLastCaptureGroup: DominoTile[] = []
): BotDecision {
  const base = { bonbona: false, bonbonaTiles: [] as DominoTile[] };

  // Check bonbona opportunity
  const canBonbona = checkBonbona(activeTile, opponentWinPile);
  let bonbonaResult = { bonbona: false, bonbonaTiles: [] as DominoTile[] };

    if (canBonbona && opponentWinPile.length > 0) {
      // Difficulty affects bonbona awareness
      const bonbonaChance = difficulty === 'hard' ? 1.0 : difficulty === 'medium' ? 0.5 : 0.15;
      if (Math.random() < bonbonaChance) {
        bonbonaResult = { bonbona: true, bonbonaTiles: [opponentWinPile[opponentWinPile.length - 1]] };
      }
    }

  // Joker on empty table → drop it
  if (isJokerTile(activeTile) && table.length === 0) {
    return { selected: [], drop: true, ...base };
  }
  // Joker sweeps all
  if (isJokerTile(activeTile)) {
    return { selected: table, drop: false, ...base };
  }

  const handValue = getTileHandValue(activeTile);
  const allCaptures = findAllCaptures(handValue, table);

  // Easy: 30% miss rate
  if (difficulty === 'easy') {
    if (Math.random() < 0.3 || allCaptures.length === 0) {
      return { selected: [], drop: true, ...bonbonaResult };
    }
    const idx = Math.floor(Math.random() * allCaptures.length);
    return { selected: allCaptures[idx], drop: false, ...bonbonaResult };
  }

  // Medium: pick best capture (most cards)
  if (difficulty === 'medium') {
    if (allCaptures.length === 0) {
      // Even with no table capture, can still do bonbona + drop
      if (bonbonaResult.bonbona) {
        return { selected: [], drop: true, ...bonbonaResult };
      }
      return { selected: [], drop: true, ...base };
    }
    const best = allCaptures.reduce((a, b) => a.length >= b.length ? a : b);
    return { selected: best, drop: false, ...bonbonaResult };
  }

  // Hard: pick capture that maximizes points, check basra
  if (allCaptures.length === 0) {
    if (bonbonaResult.bonbona) {
      return { selected: [], drop: true, ...bonbonaResult };
    }
    return { selected: [], drop: true, ...base };
  }

  // Prefer basra (taking all non-frozen tiles)
  const nonFrozen = table.filter(t => !(t[0] === 0 && t[1] === 0));
  const basraCapture = allCaptures.find(c => c.length === nonFrozen.length);
  if (basraCapture) {
    return { selected: basraCapture, drop: false, ...bonbonaResult };
  }

  // Otherwise pick highest value capture
  const best = allCaptures.reduce((a, b) => {
    const aVal = a.reduce((s, t) => s + getTileTableValue(t), 0);
    const bVal = b.reduce((s, t) => s + getTileTableValue(t), 0);
    return aVal >= bVal ? a : b;
  });

  return { selected: best, drop: false, ...bonbonaResult };
}

export function getBotDelay(d: BotDifficulty): number {
  switch (d) {
    case 'easy': return 1000 + Math.random() * 2000;
    case 'medium': return 800 + Math.random() * 1200;
    case 'hard': return 500 + Math.random() * 1000;
  }
}
