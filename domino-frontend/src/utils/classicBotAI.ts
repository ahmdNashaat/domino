import { DominoTile, BotDifficulty, ChainEnd } from '@/types/contracts';
import { canPlayTile, getPlayableEnds, isDouble, tileSum } from './classicGameEngine';

export interface ClassicBotDecision {
  action: 'play' | 'draw' | 'pass';
  tileIndex?: number;
  end?: ChainEnd;
}

export function makeClassicBotDecision(
  hand: DominoTile[],
  chainEnds: [number, number],
  boneyardCount: number,
  difficulty: BotDifficulty
): ClassicBotDecision {
  const playable = hand
    .map((tile, index) => ({ tile, index, ends: getPlayableEnds(tile, chainEnds) }))
    .filter(p => p.ends.length > 0);

  if (playable.length === 0) {
    if (boneyardCount > 0) return { action: 'draw' };
    return { action: 'pass' };
  }

  if (difficulty === 'easy') {
    return easyPlay(playable);
  } else if (difficulty === 'medium') {
    return mediumPlay(playable);
  } else {
    return hardPlay(playable, hand, chainEnds);
  }
}

function easyPlay(playable: { tile: DominoTile; index: number; ends: ChainEnd[] }[]): ClassicBotDecision {
  const pick = playable[Math.floor(Math.random() * playable.length)];
  return { action: 'play', tileIndex: pick.index, end: pick.ends[0] };
}

function mediumPlay(playable: { tile: DominoTile; index: number; ends: ChainEnd[] }[]): ClassicBotDecision {
  // Prefer doubles first, then highest value
  const doubles = playable.filter(p => isDouble(p.tile));
  if (doubles.length > 0) {
    doubles.sort((a, b) => tileSum(b.tile) - tileSum(a.tile));
    return { action: 'play', tileIndex: doubles[0].index, end: doubles[0].ends[0] };
  }

  playable.sort((a, b) => tileSum(b.tile) - tileSum(a.tile));
  return { action: 'play', tileIndex: playable[0].index, end: playable[0].ends[0] };
}

function hardPlay(
  playable: { tile: DominoTile; index: number; ends: ChainEnd[] }[],
  hand: DominoTile[],
  chainEnds: [number, number]
): ClassicBotDecision {
  // Count how many tiles in hand share each number
  const numberCount: Record<number, number> = {};
  for (const tile of hand) {
    numberCount[tile[0]] = (numberCount[tile[0]] || 0) + 1;
    numberCount[tile[1]] = (numberCount[tile[1]] || 0) + 1;
  }

  // Score each play: prefer tiles that expose numbers we have many of
  let bestScore = -Infinity;
  let bestPlay: { tile: DominoTile; index: number; end: ChainEnd } | null = null;

  for (const p of playable) {
    for (const end of p.ends) {
      // After playing, what number would be exposed?
      let exposedNumber: number;
      if (end === 'left') {
        exposedNumber = p.tile[0] === chainEnds[0] ? p.tile[1] : p.tile[0];
      } else {
        exposedNumber = p.tile[1] === chainEnds[1] ? p.tile[0] : p.tile[1];
      }

      let score = tileSum(p.tile); // prefer high value tiles
      score += (numberCount[exposedNumber] || 0) * 3; // expose numbers we have
      if (isDouble(p.tile)) score += 5; // play doubles early

      if (score > bestScore) {
        bestScore = score;
        bestPlay = { tile: p.tile, index: p.index, end };
      }
    }
  }

  if (bestPlay) {
    return { action: 'play', tileIndex: bestPlay.index, end: bestPlay.end };
  }

  return { action: 'play', tileIndex: playable[0].index, end: playable[0].ends[0] };
}

export function getClassicBotDelay(difficulty: BotDifficulty): number {
  switch (difficulty) {
    case 'easy': return 600 + Math.random() * 400;
    case 'medium': return 800 + Math.random() * 600;
    case 'hard': return 1000 + Math.random() * 800;
  }
}
