export type DominoTile = [number, number];

export function getTileHandValue(tile: DominoTile): number {
  const [a, b] = tile;
  if (a === 0 && b === 0) return 12;
  if ((a === 1 && b === 0) || (a === 0 && b === 1)) return 11;
  if (a === 1 && b === 1) return 0; // Joker
  return a + b;
}

export function getTileTableValue(tile: DominoTile): number {
  const [a, b] = tile;
  if (a === 0 && b === 0) return 0;
  if ((a === 1 && b === 0) || (a === 0 && b === 1)) return 1;
  return a + b;
}

export function isBlank(tile: DominoTile): boolean {
  return tile[0] === 0 && tile[1] === 0;
}

export function isJokerTile(tile: DominoTile): boolean {
  return tile[0] === 1 && tile[1] === 1;
}

export function isWaladTile(tile: DominoTile): boolean {
  return (tile[0] === 1 && tile[1] === 0) || (tile[0] === 0 && tile[1] === 1);
}

export function tilesEqual(a: DominoTile, b: DominoTile): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

export function canPartitionCapture(targetValue: number, selectedTiles: DominoTile[]): boolean {
  if (selectedTiles.length === 0) return false;
  const nonBlank = selectedTiles.filter(t => !isBlank(t));
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

export function isBasra(table: DominoTile[], selected: DominoTile[], active: DominoTile): boolean {
  if (isJokerTile(active)) return false;
  if (table.some(t => isBlank(t))) return false;
  return table.length > 0 && selected.length === table.length && table.every(t => selected.some(s => tilesEqual(t, s)));
}

export function checkBonbona(activeTile: DominoTile, opponentWinPile: DominoTile[]): boolean {
  if (isJokerTile(activeTile)) return false;
  if (!opponentWinPile || opponentWinPile.length === 0) return false;

  const lastTile = opponentWinPile[opponentWinPile.length - 1];
  if (isJokerTile(lastTile)) return false;

  const activeValue = getTileHandValue(activeTile);
  const lastTileValue = getTileTableValue(lastTile);
  return activeValue === lastTileValue;
}

export function validateCapture(active: DominoTile, selected: DominoTile[], table: DominoTile[]) {
  if (selected.length === 0) {
    return { ok: false, message: 'اختار أوراق من الطاولة' };
  }

  for (const s of selected) {
    if (!table.some(t => tilesEqual(t, s))) {
      return { ok: false, message: 'اختار أوراق من الطاولة' };
    }
  }

  const hasBlank = selected.some(t => isBlank(t));
  if (hasBlank && !isWaladTile(active)) {
    return { ok: false, message: 'البلاطة لا يأخذها غير الولد' };
  }

  const nonBlank = selected.filter(t => !isBlank(t));
  if (nonBlank.length === 0) {
    return { ok: true };
  }

  const activeVal = getTileHandValue(active);
  if (!canPartitionCapture(activeVal, selected)) {
    return { ok: false, message: `لا يمكن تقسيم الأوراق المختارة لمجموعات بقيمة ${activeVal}` };
  }

  return { ok: true };
}

export interface BonbonaValidation {
  ok: boolean;
  message?: string;
  group?: DominoTile[];
  lastTile?: DominoTile | null;
  countsAsBasra?: boolean;
}

export interface BonbonaOpponentState {
  winPile: DominoTile[];
  basraTiles: DominoTile[];
  lastCaptureGroup: DominoTile[];
}

export function validateBonbonaRequest(
  activeTile: DominoTile,
  opponent: BonbonaOpponentState,
  selectedBonbonaTiles: DominoTile[]
): BonbonaValidation {
  if (!opponent.winPile || opponent.winPile.length === 0) {
    return { ok: false, message: 'الخصم لسه ما كسبش حاجة' };
  }
  if (isJokerTile(activeTile)) {
    return { ok: false, message: 'الجوكر ما فيهش بونبونة' };
  }

  const lastTile = opponent.winPile[opponent.winPile.length - 1];
  if (isJokerTile(lastTile)) {
    return { ok: false, message: 'الجوكر ما فيهش بونبونة' };
  }

  const lastGroup = opponent.lastCaptureGroup || [];
  if (lastGroup.length === 0 || !lastGroup.some(t => tilesEqual(t, lastTile))) {
    return { ok: false, message: 'البونبونة غير صحيحة' };
  }

  if (selectedBonbonaTiles.length > 0) {
    const validSelection = selectedBonbonaTiles.every(bt => lastGroup.some(t => tilesEqual(t, bt)));
    if (!validSelection) {
      return { ok: false, message: 'اختار من آخر مكسب الخصم فقط' };
    }
  }

  const lastTileValue = getTileTableValue(lastTile);
  if (getTileHandValue(activeTile) !== lastTileValue) {
    return { ok: false, message: 'قيمة كارتك لا تساوي قيمة آخر أكل الخصم' };
  }

  const countsAsBasra = opponent.basraTiles.some(t => tilesEqual(t, lastTile));
  return { ok: true, group: lastGroup, lastTile, countsAsBasra };
}
