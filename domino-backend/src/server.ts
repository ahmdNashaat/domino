import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// -- Types ------------------------------------------------------
type DominoTile = [number, number];

interface PlayerState {
  id: string;
  name: string;
  hand: DominoTile[];
  winPile: DominoTile[];
  basraCount: number;
  basraTiles: DominoTile[]; // tiles that triggered a basra for highlighting
  score: number;
  cumulativeScore: number;
  lastCapture: DominoTile | null;
  lastCaptureGroup: DominoTile[];
  captureHistory: DominoTile[][];
}

interface Room {
  code: string;
  players: [PlayerState, PlayerState] | [PlayerState] | [];
  status: 'waiting' | 'playing';
  table: DominoTile[];
  chain: DominoTile[]; // for classic
  chainEnds: [number, number]; // for classic
  boneyard: DominoTile[]; // for classic
  currentPlayerIndex: 0 | 1;
  targetScore: number;
  timerEnabled: boolean;
  timerSeconds: number;
  roundNumber: number;
  phase: 'waiting' | 'playing' | 'round_end' | 'game_over' | 'blocked';
  activeCardIndex: number;
  variant: 'koutchina' | 'classic';
}

const rooms = new Map<string, Room>();

// -- Game Engine ------------------------------------------------
function generateTiles(): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let i = 0; i <= 6; i++)
    for (let j = i; j <= 6; j++)
      tiles.push([i, j]);
  return tiles;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getTileHandValue(tile: DominoTile): number {
  const [a, b] = tile;
  if (a === 0 && b === 0) return 12;
  if ((a === 1 && b === 0) || (a === 0 && b === 1)) return 11;
  if (a === 1 && b === 1) return 0; // Joker - special
  return a + b;
}

function getTileTableValue(tile: DominoTile): number {
  const [a, b] = tile;
  if (a === 0 && b === 0) return 0;
  if ((a === 1 && b === 0) || (a === 0 && b === 1)) return 1; // ????? = 1 ??? ???????
  return a + b;
}

function isBlank(tile: DominoTile): boolean {
  return tile[0] === 0 && tile[1] === 0;
}

function isJokerTile(tile: DominoTile): boolean {
  return tile[0] === 1 && tile[1] === 1;
}

function isWaladTile(tile: DominoTile): boolean {
  return (tile[0] === 1 && tile[1] === 0) || (tile[0] === 0 && tile[1] === 1);
}

function tilesEqual(a: DominoTile, b: DominoTile): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

function isDouble(tile: DominoTile): boolean {
  return tile[0] === tile[1];
}

function getChainEnds(chain: DominoTile[]): [number, number] {
  if (chain.length === 0) return [-1, -1];
  const first = chain[0];
  const last = chain[chain.length - 1];
  return [first[0], last[1]];
}

function canPlayTile(tile: DominoTile, chainEnds: [number, number]): boolean {
  if (chainEnds[0] === -1) return true;
  const [left, right] = chainEnds;
  return tile[0] === left || tile[1] === left || tile[0] === right || tile[1] === right;
}

function getPlayableEnds(tile: DominoTile, chainEnds: [number, number]): ('left' | 'right')[] {
  if (chainEnds[0] === -1) return ['left'];
  const ends: ('left' | 'right')[] = [];
  const [left, right] = chainEnds;
  if (tile[0] === left || tile[1] === left) ends.push('left');
  if (tile[0] === right || tile[1] === right) ends.push('right');
  return ends;
}

function placeTile(chain: DominoTile[], tile: DominoTile, end: 'left' | 'right'): DominoTile[] {
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

function canCapture(active: DominoTile, selected: DominoTile[], table: DominoTile[]): boolean {
  if (selected.length === 0) return false;
  // selected must all be on table
  for (const s of selected) {
    if (!table.some(t => tilesEqual(t, s))) return false;
  }
  // Blanket tiles can only be captured by ?????
  const hasBlank = selected.some(t => isBlank(t));
  if (hasBlank && !isWaladTile(active)) return false;

  const nonBlank = selected.filter(t => !isBlank(t));
  if (nonBlank.length === 0) return true;

  const activeVal = getTileHandValue(active);
  // Use partition capture logic instead of simple sum
  return canPartitionCapture(activeVal, selected);
}

function isBasra(table: DominoTile[], selected: DominoTile[], active: DominoTile): boolean {
  if (isJokerTile(active)) return false;
  // No basra if blanket is on the table
  if (table.some(t => isBlank(t))) return false;
  return table.length > 0 && selected.length === table.length && table.every(t => selected.some(s => tilesEqual(t, s)));
}

function checkBonbona(activeTile: DominoTile, opponentWinPile: DominoTile[]): boolean {
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

function canPartitionCapture(targetValue: number, selectedTiles: DominoTile[]): boolean {
  if (selectedTiles.length === 0) return false;
  
  // Separate blanket tiles (they don't affect sums, captured for free by ?????)
  const nonBlank = selectedTiles.filter(t => !isBlank(t));
  
  // If only blanket tiles selected (by ?????), that's valid
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

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function findRoom(socketId: string): Room | undefined {
  for (const room of rooms.values())
    if (room.players.some((p: PlayerState) => p.id === socketId)) return room;
}

function createPlayer(id: string, name: string): PlayerState {
  return { id, name, hand: [], winPile: [], basraCount: 0, basraTiles: [], score: 0, cumulativeScore: 0, lastCapture: null, lastCaptureGroup: [], captureHistory: [] };
}

function pushCapture(player: PlayerState, group: DominoTile[]) {
  player.captureHistory.push(group);
  player.lastCaptureGroup = group;
  player.lastCapture = group.length > 0 ? group[group.length - 1] : null;
}

function popCapture(player: PlayerState) {
  if (player.captureHistory.length > 0) {
    player.captureHistory.pop();
  }
  const lastGroup = player.captureHistory[player.captureHistory.length - 1] || [];
  player.lastCaptureGroup = lastGroup;
  player.lastCapture = lastGroup.length > 0 ? lastGroup[lastGroup.length - 1] : null;
}

// -- Send state to both players ---------------------------------
function sendGameState(room: Room, lastEvent?: any) {
  if (room.players.length < 2) return;
  const [p0, p1] = room.players as [PlayerState, PlayerState];
  const currentId = room.currentPlayerIndex === 0 ? p0.id : p1.id;

  const state = {
    phase: room.phase,
    table: room.table,
    chain: room.chain,
    chainEnds: room.chainEnds,
    boneyard: room.boneyard,
    variant: room.variant,
    currentPlayerId: currentId,
    activeCardIndex: room.activeCardIndex,
    roundNumber: room.roundNumber,
    targetScore: room.targetScore,
    lastEvent: lastEvent || null,
    myHand: p0.hand,
    myWinPile: p0.winPile,
    myBasraCount: p0.basraCount,
    myBasraTiles: p0.basraTiles,
    myScore: p0.score,
    myCumulativeScore: p0.cumulativeScore,
    myName: p0.name,
    myLastCapture: p0.lastCapture,
    myLastCaptureGroup: p0.lastCaptureGroup,
    opponentHandCount: p1.hand.length,
    opponentWinPile: p1.winPile,
    opponentBasraCount: p1.basraCount,
    opponentBasraTiles: p1.basraTiles,
    opponentScore: p1.score,
    opponentCumulativeScore: p1.cumulativeScore,
    opponentName: p1.name,
    opponentLastCapture: p1.lastCapture,
    opponentLastCaptureGroup: p1.lastCaptureGroup,
  };

  // To player 0
  io.to(p0.id).emit('game:state', state);

  // To player 1
  io.to(p1.id).emit('game:state', {
    ...state,
    myHand: p1.hand,
    myWinPile: p1.winPile,
    myBasraCount: p1.basraCount,
    myBasraTiles: p1.basraTiles,
    myScore: p1.score,
    myCumulativeScore: p1.cumulativeScore,
    myName: p1.name,
    myLastCapture: p1.lastCapture,
    myLastCaptureGroup: p1.lastCaptureGroup,
    opponentHandCount: p0.hand.length,
    opponentWinPile: p0.winPile,
    opponentBasraCount: p0.basraCount,
    opponentBasraTiles: p0.basraTiles,
    opponentScore: p0.score,
    opponentCumulativeScore: p0.cumulativeScore,
    opponentName: p0.name,
    opponentLastCapture: p0.lastCapture,
    opponentLastCaptureGroup: p0.lastCaptureGroup,
  });
}

function startRound(room: Room) {
  const tiles = shuffle(generateTiles());
  const [p0, p1] = room.players as [PlayerState, PlayerState];

  if (room.variant === 'classic') {
    p0.hand = tiles.slice(0, 7);
    p1.hand = tiles.slice(7, 14);
    room.boneyard = tiles.slice(14);
    room.chain = [];
    room.chainEnds = [-1, -1];
  } else {
    p0.hand = tiles.slice(0, 14);
    p1.hand = tiles.slice(14, 28);
    room.table = [];
  }
  room.phase = 'playing';
  if (room.variant === 'classic') {
    room.currentPlayerIndex = Math.random() < 0.5 ? 0 : 1;
  } else {
    room.currentPlayerIndex = room.roundNumber > 1
      ? (p0.cumulativeScore <= p1.cumulativeScore ? 0 : 1)
      : (Math.random() < 0.5 ? 0 : 1);
  }
  const starter = room.currentPlayerIndex === 0 ? p0 : p1;
  room.activeCardIndex = starter.hand.length - 1; // rightmost = active

  sendGameState(room);
}

function advanceTurn(room: Room) {
  const [p0, p1] = room.players as [PlayerState, PlayerState];
  const curr = room.currentPlayerIndex === 0 ? p0 : p1;

  // ?? ????? ????? ? ????? ??????
  if (p0.hand.length === 0 && p1.hand.length === 0) {
    endRound(room);
    return;
  }

  if (room.variant === 'classic') {
    // Check if current player can play
    const active = curr.hand[room.activeCardIndex];
    if (active && canPlayTile(active, room.chainEnds)) {
      // Can play, continue
    } else if (room.boneyard.length > 0) {
      // Can draw, continue
    } else {
      // Can't play or draw, pass
      // For simplicity, end round if blocked
      room.phase = 'blocked';
      sendGameState(room, { type: 'block', message: '?????? ??????' });
      setTimeout(() => endRound(room), 1000);
      return;
    }
  }

  // ????? ????? ??????
  if (room.variant === 'classic') {
    room.currentPlayerIndex = room.currentPlayerIndex === 0 ? 1 : 0;
    const next = room.currentPlayerIndex === 0 ? p0 : p1;
    room.activeCardIndex = next.hand.length - 1;
    sendGameState(room);
    return;
  }

  const nextIdx = room.currentPlayerIndex === 0 ? 1 : 0;
  const nextHand = nextIdx === 0 ? p0.hand : p1.hand;
  if (nextHand.length === 0) {
    const otherHand = nextIdx === 0 ? p1.hand : p0.hand;
    if (otherHand.length === 0) {
      endRound(room);
      return;
    }
    // stay with current player
  } else {
    room.currentPlayerIndex = nextIdx;
  }
  const next = room.currentPlayerIndex === 0 ? p0 : p1;
  room.activeCardIndex = next.hand.length - 1;

  sendGameState(room);
}

function endRound(room: Room) {
  const [p0, p1] = room.players as [PlayerState, PlayerState];

  if (room.variant === 'classic') {
    // Calculate scores: negative points for remaining tiles
    const score0 = -p0.hand.reduce((s, t) => s + t[0] + t[1], 0);
    const score1 = -p1.hand.reduce((s, t) => s + t[0] + t[1], 0);
    p0.score = score0;
    p1.score = score1;
    p0.cumulativeScore += score0;
    p1.cumulativeScore += score1;
  } else {
    // Koutchina rules: remaining tiles on table go to the player who made the last capture
    if (room.table.length > 0) {
      // Check who made the last capture
      if (p0.lastCapture) {
        // p0 made the last capture
        p0.winPile.push(...room.table);
      } else {
        // p1 made the last capture (or both made no capture, but that's invalid in real game)
        p1.winPile.push(...room.table);
      }
      room.table = [];
    }

    // Calculate round scores based on cards difference and basras
    const p0Cards = Math.max(0, p0.winPile.length - p0.basraCount);
    const p1Cards = Math.max(0, p1.winPile.length - p1.basraCount);
    const diff = Math.abs(p0Cards - p1Cards);
    const diffPoints = diff * 10;
    const score0 = (p0Cards > p1Cards ? diffPoints : 0) + p0.basraCount * 100;
    const score1 = (p1Cards > p0Cards ? diffPoints : 0) + p1.basraCount * 100;
    p0.score = score0;
    p1.score = score1;
    p0.cumulativeScore += score0;
    p1.cumulativeScore += score1;
  }

  // Is game over?
  if (p0.cumulativeScore >= room.targetScore || p1.cumulativeScore >= room.targetScore) {
    room.phase = 'game_over';
  } else {
    room.phase = 'round_end';
  }

  sendGameState(room, { type: 'round_end' });
}

// -- Socket Events ----------------------------------------------
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('room:create', (data: { playerName: string; targetScore: number; timerEnabled: boolean; timerSeconds?: number; gameVariant?: string }) => {
    const code = generateCode();
    const room: Room = {
      code, players: [createPlayer(socket.id, data.playerName)],
      status: 'waiting', table: [], chain: [], chainEnds: [-1, -1], boneyard: [],
      currentPlayerIndex: 0,
      targetScore: data.targetScore ?? 600,
      timerEnabled: data.timerEnabled ?? false,
      timerSeconds: data.timerSeconds ?? 30,
      roundNumber: 1, phase: 'waiting', activeCardIndex: -1,
      variant: (data.gameVariant as 'koutchina' | 'classic') || 'koutchina',
    };
    rooms.set(code, room);
    socket.join(code);
    socket.emit('room:created', { roomCode: code, playerName: data.playerName, playerId: socket.id });
    console.log(`[Created] ${code}`);
  });

  socket.on('room:join', (data: { roomCode: string; playerName: string }) => {
    const room = rooms.get(data.roomCode.toUpperCase());
    if (!room) { socket.emit('room:error', { message: '?????? ??? ??????' }); return; }
    if (room.status === 'playing') { socket.emit('room:error', { message: '?????? ???? ??????' }); return; }
    if (room.players.length >= 2) { socket.emit('room:error', { message: '?????? ??????' }); return; }

    (room.players as PlayerState[]).push(createPlayer(socket.id, data.playerName));
    room.status = 'playing';
    socket.join(room.code);

    const [p0, p1] = room.players as [PlayerState, PlayerState];

    socket.emit('room:joined', { roomCode: room.code, opponentName: p0.name, playerId: socket.id });
    socket.to(room.code).emit('room:opponent_joined', { opponentName: data.playerName });

    io.to(p0.id).emit('game:started', { playerId: p0.id, opponentName: p1.name });
    io.to(p1.id).emit('game:started', { playerId: p1.id, opponentName: p0.name });

    console.log(`[Started] ${room.code}: ${p0.name} vs ${p1.name}`);

    // ???? ?????? ??????
    setTimeout(() => startRound(room), 500);
  });

  socket.on('game:action', (data: { type?: string; end?: string; selectedTiles?: DominoTile[]; bonbonaTiles?: DominoTile[] }) => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== 'playing' || room.players.length < 2) return;

    const [p0, p1] = room.players as [PlayerState, PlayerState];
    const currIdx = room.currentPlayerIndex;
    const curr = currIdx === 0 ? p0 : p1;

    if (curr.id !== socket.id) {
      socket.emit('game:invalid', { message: '?? ????!' });
      return;
    }

    const active = curr.hand[room.activeCardIndex];
    if (!active) { socket.emit('game:invalid', { message: '???? ???? ???' }); return; }

    if (room.variant === 'classic') {
      const actionType = data.type;
      if (actionType === 'play') {
        const end = data.end as 'left' | 'right';
        if (!end) {
          socket.emit('game:invalid', { message: 'end ?????' });
          return;
        }
        // Check if can play
        const canPlay = canPlayTile(active, room.chainEnds);
        if (!canPlay) {
          socket.emit('game:invalid', { message: '?? ???? ???? ?????? ??' });
          return;
        }
        const playableEnds = getPlayableEnds(active, room.chainEnds);
        if (!playableEnds.includes(end)) {
          socket.emit('game:invalid', { message: '?? ???? ???? ?? ??????? ??' });
          return;
        }
        // Play the tile
        room.chain = placeTile(room.chain, active, end);
        room.chainEnds = getChainEnds(room.chain);
        curr.hand.splice(room.activeCardIndex, 1);
        if (curr.hand.length > 0) {
          room.activeCardIndex = curr.hand.length - 1;
        } else {
          room.activeCardIndex = -1;
        }
        sendGameState(room, { type: 'play', tile: active, end });
        setTimeout(() => advanceTurn(room), 300);
      } else if (actionType === 'draw') {
        if (room.boneyard.length === 0) {
          socket.emit('game:invalid', { message: '????????? ????' });
          return;
        }
        const drawn = room.boneyard.pop()!;
        curr.hand.push(drawn);
        room.activeCardIndex = curr.hand.length - 1;
        sendGameState(room, { type: 'draw', count: 1 });
        // Turn continues
      } else if (actionType === 'pass') {
        // Pass
        sendGameState(room, { type: 'pass' });
        setTimeout(() => advanceTurn(room), 300);
      } else {
        socket.emit('game:invalid', { message: 'action ??? ????' });
      }
    } else {
      // Koutchina logic
      const selected = data.selectedTiles || [];
      const bonbona = data.bonbonaTiles || [];
      let bonbonaGroup = bonbona;

      let event: any = null;

      if (isJokerTile(active)) {
        if (room.table.length === 0) {
          room.table.push(active);
          event = { type: 'drop', tile: active };
        } else {
          const swept = [...room.table];
          const captureGroup = [...swept, active];
          curr.winPile.push(...captureGroup);
          pushCapture(curr, captureGroup);
          room.table = [];
          event = { type: 'joker', tilesSwept: swept };
        }
      } else if (selected.length > 0 || bonbona.length > 0) {
        // Get opponent player
        const opp = currIdx === 0 ? p1 : p0;

        // Validate table capture (only if selecting from table)
        if (selected.length > 0 && !canCapture(active, selected, room.table)) {
          socket.emit('game:invalid', { message: '???????? ?? ????? ??? ????' });
          return;
        }

        // Bonbona validation
        let bonbonaIsBasra = false;
        if (bonbona.length > 0) {
          if (!opp.winPile || opp.winPile.length === 0) {
            socket.emit('game:invalid', { message: '????????? ??? ?????' });
            return;
          }
          if (!checkBonbona(active, opp.winPile)) {
            socket.emit('game:invalid', { message: '????????? ??? ?????' });
            return;
          }
          // Verify that bonbona selection is from opponent's last capture group
          const lastTile = opp.winPile[opp.winPile.length - 1];
          const lastGroup = opp.lastCaptureGroup || [];
          if (lastGroup.length === 0 || !lastGroup.some(t => tilesEqual(t, lastTile))) {
            socket.emit('game:invalid', { message: '????????? ??? ?????' });
            return;
          }
          const validSelection = bonbona.every(bt => lastGroup.some(t => tilesEqual(t, bt)));
          if (!validSelection) {
            socket.emit('game:invalid', { message: '????? ?? ??? ???? ????? ???' });
            return;
          }
          bonbonaGroup = lastGroup;
          // Bonbona counts as basra only if opponent's last win tile was a basra tile
          bonbonaIsBasra = opp.basraTiles.some(t => tilesEqual(t, lastTile));
          if (bonbonaIsBasra) {
            opp.basraCount = Math.max(0, opp.basraCount - 1);
          }

          // Remove the last tile from opponent
          opp.winPile = opp.winPile.filter(w => !bonbonaGroup.some(bt => tilesEqual(bt, w)));
          opp.basraTiles = opp.basraTiles.filter(w => !bonbonaGroup.some(bt => tilesEqual(bt, w)));
          popCapture(opp);
        }

        const basra = selected.length > 0 && isBasra(room.table, selected, active);
        const captured = [...selected, ...bonbonaGroup, active];

        curr.winPile.push(...captured);
        pushCapture(curr, captured);
        room.table = room.table.filter(t => !selected.some(s => tilesEqual(s, t)));

        if (basra || bonbonaIsBasra) {
          curr.basraCount++;
          curr.basraTiles.push(active);
        }

        const isBonbona = bonbona.length > 0;
        if (isBonbona) {
          event = bonbonaIsBasra ? { type: 'basra_bonbona' } : { type: 'bonbona' };
        } else if (basra) {
          event = { type: 'basra' };
        } else {
          event = { type: 'capture', tiles: captured };
        }
      } else {
        // Drop — ??? ??? ???????
        room.table.push(active);
        event = { type: 'drop', tile: active };
      }

      // ??? ?????? ?? ?????
      curr.hand = curr.hand.filter((_, i) => i !== room.activeCardIndex);
      
      // Update active card index
      if (curr.hand.length > 0) {
        room.activeCardIndex = curr.hand.length - 1;
      } else {
        room.activeCardIndex = -1;
      }

      sendGameState(room, event);
      setTimeout(() => advanceTurn(room), 300);
    }
  });

  socket.on('game:drop', () => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== 'playing' || room.players.length < 2) return;
    const [p0, p1] = room.players as [PlayerState, PlayerState];
    const curr = room.currentPlayerIndex === 0 ? p0 : p1;
    if (curr.id !== socket.id) return;

    const active = curr.hand[room.activeCardIndex];
    if (!active) return;

    if (isJokerTile(active) && room.table.length > 0) {
      socket.emit('game:invalid', { message: '?????? ???? ???? ???????' });
      return;
    }

    room.table.push(active);
    curr.hand = curr.hand.filter((_, i) => i !== room.activeCardIndex);

    sendGameState(room, { type: 'drop', tile: active });
    setTimeout(() => advanceTurn(room), 300);
  });

  socket.on('game:next_round', () => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== 'round_end') return;
    const [p0, p1] = room.players as [PlayerState, PlayerState];
    p0.hand = []; p0.winPile = []; p0.basraCount = 0; p0.basraTiles = []; p0.score = 0; p0.lastCapture = null; p0.lastCaptureGroup = []; p0.captureHistory = [];
    p1.hand = []; p1.winPile = []; p1.basraCount = 0; p1.basraTiles = []; p1.score = 0; p1.lastCapture = null; p1.lastCaptureGroup = []; p1.captureHistory = [];
    room.roundNumber++;
    startRound(room);
  });

  socket.on('chat:message', (data: { text: string }) => {
    const room = findRoom(socket.id);
    if (!room) return;
    const player = (room.players as PlayerState[]).find(p => p.id === socket.id);
    if (!player) return;

    // Send to all players in the room except the sender
    room.players.forEach((p: PlayerState) => {
      if (p.id !== socket.id) {
        io.to(p.id).emit('chat:message', { senderName: player.name, text: data.text });
      }
    });
  });

  socket.on('room:leave', () => {
    const room = findRoom(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:opponent_disconnected');
    rooms.delete(room.code);
  });

  socket.on('disconnect', () => {
    const room = findRoom(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:opponent_disconnected');
    rooms.delete(room.code);
    console.log(`[-] ${socket.id}`);
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok', rooms: rooms.size }));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));













