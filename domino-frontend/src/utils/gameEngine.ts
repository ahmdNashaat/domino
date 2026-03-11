import { DominoTile, RoundScore } from '@/types/contracts';

export function generateTiles(): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push([i, j]);
    }
  }
  return tiles;
}

export function shuffleTiles(tiles: DominoTile[]): DominoTile[] {
  const arr = [...tiles];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function distributeTiles(tiles: DominoTile[]): [DominoTile[], DominoTile[]] {
  return [tiles.slice(0, 14), tiles.slice(14, 28)];
}

export function getTileHandValue(tile: DominoTile): number {
  if (tile[0] === 0 && tile[1] === 0) return 12;
  if ((tile[0] === 1 && tile[1] === 0) || (tile[0] === 0 && tile[1] === 1)) return 11;
  if (tile[0] === 1 && tile[1] === 1) return 0; // Joker - special
  return tile[0] + tile[1];
}

export function getTileTableValue(tile: DominoTile): number {
  if (tile[0] === 0 && tile[1] === 0) return 0;
  if ((tile[0] === 1 && tile[1] === 0) || (tile[0] === 0 && tile[1] === 1)) return 1;
  return tile[0] + tile[1];
}

export function isBlankTile(t: DominoTile): boolean {
  return t[0] === 0 && t[1] === 0;
}

export function isJokerTile(t: DominoTile): boolean {
  return t[0] === 1 && t[1] === 1;
}

/** الولد - can capture البلاطة */
export function isWaladTile(t: DominoTile): boolean {
  return (t[0] === 1 && t[1] === 0) || (t[0] === 0 && t[1] === 1);
}

export function tilesEqual(a: DominoTile, b: DominoTile): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

export function canCapture(activeHandValue: number, selectedTableTiles: DominoTile[]): boolean {
  const tableSum = selectedTableTiles.reduce((sum, t) => sum + getTileTableValue(t), 0);
  return tableSum === activeHandValue;
}

/**
 * Check if selected tiles can be partitioned into groups where each group sums to the target value.
 * Blanket tiles (value 0) are excluded from sum checks - they're captured for free by الولد.
 */
export function canPartitionCapture(targetValue: number, selectedTiles: DominoTile[]): boolean {
  if (selectedTiles.length === 0) return false;
  
  // Separate blanket tiles (they don't affect sums, captured for free by الولد)
  const nonBlank = selectedTiles.filter(t => !isBlankTile(t));
  
  // If only blanket tiles selected (by الولد), that's valid
  if (nonBlank.length === 0) return true;
  
  const values = nonBlank.map(t => getTileTableValue(t));
  return partitionHelper(values, targetValue, 0);
}

function partitionHelper(values: number[], target: number, index: number): boolean {
  if (index === values.length) return true;
  
  const remaining = values.slice(index);
  const subsets = findSubsetsThatSum(remaining, target);
  
  for (const subset of subsets) {
    const leftover = [...remaining];
    for (const idx of subset.sort((a, b) => b - a)) {
      leftover.splice(idx, 1);
    }
    if (leftover.length === 0 || partitionHelper(leftover, target, 0)) {
      return true;
    }
  }
  
  return false;
}

function findSubsetsThatSum(values: number[], target: number): number[][] {
  const results: number[][] = [];
  
  function bt(start: number, current: number[], currentSum: number) {
    if (currentSum === target && current.length > 0) {
      results.push([...current]);
      return;
    }
    if (currentSum > target) return;
    for (let i = start; i < values.length; i++) {
      current.push(i);
      bt(i + 1, current, currentSum + values[i]);
      current.pop();
    }
  }
  
  bt(0, [], 0);
  return results;
}

export function findAllCaptures(activeHandValue: number, table: DominoTile[]): DominoTile[][] {
  const nonFrozen = table.filter(t => !isBlankTile(t));
  const results: DominoTile[][] = [];

  function backtrack(start: number, current: DominoTile[], currentSum: number) {
    if (currentSum === activeHandValue && current.length > 0) {
      results.push([...current]);
    }
    if (currentSum >= activeHandValue) return;
    for (let i = start; i < nonFrozen.length; i++) {
      const val = getTileTableValue(nonFrozen[i]);
      current.push(nonFrozen[i]);
      backtrack(i + 1, current, currentSum + val);
      current.pop();
    }
  }

  backtrack(0, [], 0);
  return results;
}

/** No basra if blanket [0,0] is on the table */
export function isBasra(table: DominoTile[], selectedTableTiles: DominoTile[], activeTile: DominoTile): boolean {
  if (isJokerTile(activeTile)) return false;
  // No basra if blanket is on the table
  if (table.some(t => isBlankTile(t))) return false;
  return selectedTableTiles.length === table.length && table.length > 0;
}

export function checkBonbona(activeTile: DominoTile, opponentWinPile: DominoTile[]): boolean {
  // No bonbona for joker
  if (isJokerTile(activeTile)) return false;
  
  // No win pile or empty
  if (!opponentWinPile || opponentWinPile.length === 0) return false;
  
  // Bonbona: active tile value must equal the LAST SINGLE TILE value captured by opponent
  const lastTile = opponentWinPile[opponentWinPile.length - 1];
  if (isJokerTile(lastTile)) return false;
  const activeValue = getTileHandValue(activeTile);
  const lastTileValue = getTileTableValue(lastTile);
  
  return activeValue === lastTileValue;
}

export function calculateRoundScore(
  playerWinPile: DominoTile[],
  opponentWinPile: DominoTile[],
  playerBasras: number,
  opponentBasras: number
): RoundScore {
  const pCards = Math.max(0, playerWinPile.length - playerBasras);
  const oCards = Math.max(0, opponentWinPile.length - opponentBasras);
  const diff = Math.abs(pCards - oCards);
  const diffPoints = diff * 10;
  const pDiffPoints = pCards > oCards ? diffPoints : 0;
  const oDiffPoints = oCards > pCards ? diffPoints : 0;
  const pBasraPoints = playerBasras * 100;
  const oBasraPoints = opponentBasras * 100;
  const playerPoints = pDiffPoints + pBasraPoints;
  const opponentPoints = oDiffPoints + oBasraPoints;

  return {
    playerCards: pCards,
    opponentCards: oCards,
    playerBasras: playerBasras,
    opponentBasras: opponentBasras,
    playerPoints,
    opponentPoints,
    diff,
    roundWinner: playerPoints > opponentPoints ? 'player' : opponentPoints > playerPoints ? 'opponent' : 'tie',
  };
}
