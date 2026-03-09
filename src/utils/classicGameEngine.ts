import { DominoTile, ChainEnd, ClassicRoundScore } from '@/types/contracts';

export function generateClassicTiles(): DominoTile[] {
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

export function distributeClassicTilesMulti(tiles: DominoTile[], playerCount: number): { hands: DominoTile[][]; boneyard: DominoTile[] } {
  const tilesPerPlayer = 7;
  const hands: DominoTile[][] = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(tiles.slice(i * tilesPerPlayer, (i + 1) * tilesPerPlayer));
  }
  const boneyard = tiles.slice(playerCount * tilesPerPlayer);
  return { hands, boneyard };
}

// Legacy 2-player compat
export function distributeClassicTiles(tiles: DominoTile[]): { playerHand: DominoTile[]; opponentHand: DominoTile[]; boneyard: DominoTile[] } {
  return {
    playerHand: tiles.slice(0, 7),
    opponentHand: tiles.slice(7, 14),
    boneyard: tiles.slice(14),
  };
}

export function isDouble(tile: DominoTile): boolean {
  return tile[0] === tile[1];
}

export function tileSum(tile: DominoTile): number {
  return tile[0] + tile[1];
}

export function calculateHandScore(hand: DominoTile[]): number {
  return hand.reduce((sum, t) => sum + tileSum(t), 0);
}

export function findHighestDouble(hand: DominoTile[]): number {
  let highest = -1;
  for (let i = 0; i < hand.length; i++) {
    if (isDouble(hand[i]) && hand[i][0] > highest) {
      highest = hand[i][0];
    }
  }
  return highest;
}

export function getChainEnds(chain: DominoTile[]): [number, number] {
  if (chain.length === 0) return [-1, -1];
  const first = chain[0];
  const last = chain[chain.length - 1];
  return [first[0], last[1]];
}

export function canPlayTile(tile: DominoTile, chainEnds: [number, number]): boolean {
  if (chainEnds[0] === -1) return true;
  const [left, right] = chainEnds;
  return tile[0] === left || tile[1] === left || tile[0] === right || tile[1] === right;
}

export function getPlayableEnds(tile: DominoTile, chainEnds: [number, number]): ChainEnd[] {
  if (chainEnds[0] === -1) return ['left'];
  const ends: ChainEnd[] = [];
  const [left, right] = chainEnds;
  if (tile[0] === left || tile[1] === left) ends.push('left');
  if (tile[0] === right || tile[1] === right) ends.push('right');
  return ends;
}

export function placeTile(chain: DominoTile[], tile: DominoTile, end: ChainEnd): DominoTile[] {
  if (chain.length === 0) return [tile];
  const [leftEnd, rightEnd] = getChainEnds(chain);

  if (end === 'left') {
    if (tile[1] === leftEnd) return [tile, ...chain];
    return [[tile[1], tile[0]] as DominoTile, ...chain];
  } else {
    if (tile[0] === rightEnd) return [...chain, tile];
    return [...chain, [tile[1], tile[0]] as DominoTile];
  }
}

export function hasPlayableTile(hand: DominoTile[], chainEnds: [number, number]): boolean {
  return hand.some(t => canPlayTile(t, chainEnds));
}

export function isGameBlockedMulti(
  hands: DominoTile[][],
  boneyard: DominoTile[],
  chainEnds: [number, number]
): boolean {
  if (boneyard.length > 0) return false;
  return hands.every(hand => !hasPlayableTile(hand, chainEnds));
}

// Legacy 2-player compat
export function isGameBlocked(
  playerHand: DominoTile[],
  opponentHand: DominoTile[],
  boneyard: DominoTile[],
  chainEnds: [number, number]
): boolean {
  return isGameBlockedMulti([playerHand, opponentHand], boneyard, chainEnds);
}

export function calculateClassicRoundScoreMulti(
  hands: DominoTile[][],
  finisherIndex: number // -1 if blocked
): ClassicRoundScore {
  const handScores = hands.map(h => calculateHandScore(h));

  if (finisherIndex >= 0) {
    // Player finished - wins sum of all other hands
    const winnerPoints = handScores.reduce((s, sc, i) => i === finisherIndex ? s : s + sc, 0);
    return { handScores, winnerPoints, roundWinnerIndex: finisherIndex };
  }

  // Blocked - lowest score wins difference
  const minScore = Math.min(...handScores);
  const minIndices = handScores.map((s, i) => s === minScore ? i : -1).filter(i => i >= 0);

  if (minIndices.length > 1) {
    return { handScores, winnerPoints: 0, roundWinnerIndex: -1 }; // tie
  }

  const winnerIdx = minIndices[0];
  const winnerPoints = handScores.reduce((s, sc, i) => i === winnerIdx ? s : s + sc, 0) - handScores[winnerIdx] * (hands.length - 1);
  return { handScores, winnerPoints: Math.max(0, winnerPoints), roundWinnerIndex: winnerIdx };
}

// Legacy compat
export function calculateClassicRoundScore(
  playerHand: DominoTile[],
  opponentHand: DominoTile[],
  playerFinished: boolean
): { playerHandScore: number; opponentHandScore: number; winnerPoints: number; roundWinner: 'player' | 'opponent' | 'tie' } {
  const result = calculateClassicRoundScoreMulti(
    [playerHand, opponentHand],
    playerFinished ? 0 : -1
  );
  const winner = result.roundWinnerIndex === 0 ? 'player' : result.roundWinnerIndex === 1 ? 'opponent' : 'tie';
  return {
    playerHandScore: result.handScores[0],
    opponentHandScore: result.handScores[1],
    winnerPoints: result.winnerPoints,
    roundWinner: winner,
  };
}

export function tilesEqual(a: DominoTile, b: DominoTile): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}
