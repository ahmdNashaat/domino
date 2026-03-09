import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// ── Types ──────────────────────────────────────────────────────
type DominoTile = [number, number];

interface PlayerState {
  id: string;
  name: string;
  hand: DominoTile[];
  winPile: DominoTile[];
  basraCount: number;
  score: number;
  cumulativeScore: number;
  lastCapture: DominoTile | null;
  lastCaptureGroup: DominoTile[];
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

// ── Game Engine ────────────────────────────────────────────────
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
  if (a === 1 && b === 0) return 11;
  return a + b;
}

function getTileTableValue(tile: DominoTile): number {
  const [a, b] = tile;
  if (a === 0 && b === 0) return 0;
  return a + b;
}

function isBlank(tile: DominoTile): boolean {
  return tile[0] === 0 && tile[1] === 0;
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

function getTileTableValue(tile: DominoTile): number {
  const [a, b] = tile;
  if (a === 0 && b === 0) return 0;
  return a + b;
}

function canPartitionCapture(targetValue: number, selectedTiles: DominoTile[]): boolean {
  if (selectedTiles.length === 0) return false;
  
  // Separate blanket tiles (they don't affect sums, captured للwalad for free)
  const nonBlank = selectedTiles.filter(t => !isBlank(t));
  
  // If only blanket tiles selected, that's valid
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

function canCapture(active: DominoTile, selected: DominoTile[], table: DominoTile[]): boolean {
  if (selected.length === 0) return false;
  // selected must all be on table
  for (const s of selected) {
    if (!table.some(t => tilesEqual(t, s))) return false;
    if (isBlank(s)) return false; // blank frozen
  }
  const activeVal = getTileHandValue(active);
  // Use partition capture logic instead of simple sum
  return canPartitionCapture(activeVal, selected);
}

function isBasra(table: DominoTile[], selected: DominoTile[], active: DominoTile): boolean {
  if (active[0] === 1 && active[1] === 1) return false;
  return selected.length === table.length && table.every(t => selected.some(s => tilesEqual(t, s)));
}

function checkBonbona(activeTile: DominoTile, opponentLastCaptureGroup: DominoTile[]): boolean {
  if (opponentLastCaptureGroup.length === 0) return false;
  if (activeTile[0] === 1 && activeTile[1] === 1) return false; // No bonbona with joker
  
  const activeValue = getTileHandValue(activeTile);
  
  // bonbona is valid if the opponent's entire last capture group sums to the same value
  const lastCaptureValue = opponentLastCaptureGroup.reduce((sum, t) => sum + getTileTableValue(t), 0);
  return lastCaptureValue === activeValue;
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function findRoom(socketId: string): Room | undefined {
  for (const room of rooms.values())
    if (room.players.some((p: PlayerState) => p.id === socketId)) return room;
}

function createPlayer(id: string, name: string): PlayerState {
  return { id, name, hand: [], winPile: [], basraCount: 0, score: 0, cumulativeScore: 0, lastCapture: null, lastCaptureGroup: [] };
}

// ── Send state to both players ─────────────────────────────────
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
    myScore: p0.score,
    myCumulativeScore: p0.cumulativeScore,
    myName: p0.name,
    myLastCapture: p0.lastCapture,
    myLastCaptureGroup: p0.lastCaptureGroup,
    opponentHandCount: p1.hand.length,
    opponentWinPile: p1.winPile,
    opponentBasraCount: p1.basraCount,
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
    myScore: p1.score,
    myCumulativeScore: p1.cumulativeScore,
    myName: p1.name,
    myLastCapture: p1.lastCapture,
    myLastCaptureGroup: p1.lastCaptureGroup,
    opponentHandCount: p0.hand.length,
    opponentWinPile: p0.winPile,
    opponentBasraCount: p0.basraCount,
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
  room.activeCardIndex = p0.hand.length - 1; // rightmost = active
  room.currentPlayerIndex = Math.random() < 0.5 ? 0 : 1;

  sendGameState(room);
}

function advanceTurn(room: Room) {
  const [p0, p1] = room.players as [PlayerState, PlayerState];
  const curr = room.currentPlayerIndex === 0 ? p0 : p1;

  // لو الإيد فاضية → نهاية الجولة
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
      sendGameState(room, { type: 'block', message: 'اللعبة متوقفة' });
      setTimeout(() => endRound(room), 1000);
      return;
    }
  }

  // انتقل للاعب التاني
  room.currentPlayerIndex = room.currentPlayerIndex === 0 ? 1 : 0;
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
    // الأوراق المتبقية على الطاولة تروح لآخر من أخد
    // (بسيط: روح لـ p0 لو winPile أكبر)
    const lastCapturer = p0.winPile.length >= p1.winPile.length ? p0 : p1;
    lastCapturer.winPile.push(...room.table);
    room.table = [];

    // احسب النقاط
    const score0 = p0.winPile.reduce((s, t) => s + getTileTableValue(t), 0) + p0.basraCount * 100;
    const score1 = p1.winPile.reduce((s, t) => s + getTileTableValue(t), 0) + p1.basraCount * 100;
    p0.score = score0;
    p1.score = score1;
    p0.cumulativeScore += score0;
    p1.cumulativeScore += score1;
  }

  // هل انتهت اللعبة؟
  if (p0.cumulativeScore >= room.targetScore || p1.cumulativeScore >= room.targetScore) {
    room.phase = 'game_over';
  } else {
    room.phase = 'round_end';
  }

  sendGameState(room, { type: 'round_end' });
}

// ── Socket Events ──────────────────────────────────────────────
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
    if (!room) { socket.emit('room:error', { message: 'الغرفة غير موجودة' }); return; }
    if (room.status === 'playing') { socket.emit('room:error', { message: 'اللعبة بدأت بالفعل' }); return; }
    if (room.players.length >= 2) { socket.emit('room:error', { message: 'الغرفة ممتلئة' }); return; }

    (room.players as PlayerState[]).push(createPlayer(socket.id, data.playerName));
    room.status = 'playing';
    socket.join(room.code);

    const [p0, p1] = room.players as [PlayerState, PlayerState];

    socket.emit('room:joined', { roomCode: room.code, opponentName: p0.name, playerId: socket.id });
    socket.to(room.code).emit('room:opponent_joined', { opponentName: data.playerName });

    io.to(p0.id).emit('game:started', { playerId: p0.id, opponentName: p1.name });
    io.to(p1.id).emit('game:started', { playerId: p1.id, opponentName: p0.name });

    console.log(`[Started] ${room.code}: ${p0.name} vs ${p1.name}`);

    // ابدأ الجولة الأولى
    setTimeout(() => startRound(room), 500);
  });

  socket.on('game:action', (data: { type?: string; end?: string; selectedTiles?: DominoTile[]; bonbonaTiles?: DominoTile[] }) => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== 'playing' || room.players.length < 2) return;

    const [p0, p1] = room.players as [PlayerState, PlayerState];
    const currIdx = room.currentPlayerIndex;
    const curr = currIdx === 0 ? p0 : p1;

    if (curr.id !== socket.id) {
      socket.emit('game:invalid', { message: 'مش دورك!' });
      return;
    }

    const active = curr.hand[room.activeCardIndex];
    if (!active) { socket.emit('game:invalid', { message: 'مفيش كارت نشط' }); return; }

    if (room.variant === 'classic') {
      const actionType = data.type;
      if (actionType === 'play') {
        const end = data.end as 'left' | 'right';
        if (!end) {
          socket.emit('game:invalid', { message: 'end مطلوب' });
          return;
        }
        // Check if can play
        const canPlay = canPlayTile(active, room.chainEnds);
        if (!canPlay) {
          socket.emit('game:invalid', { message: 'مش ممكن تلعب الكارت ده' });
          return;
        }
        const playableEnds = getPlayableEnds(active, room.chainEnds);
        if (!playableEnds.includes(end)) {
          socket.emit('game:invalid', { message: 'مش ممكن تلعب في النهاية دي' });
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
          socket.emit('game:invalid', { message: 'البونيارد فاضي' });
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
        socket.emit('game:invalid', { message: 'action غير صحيح' });
      }
    } else {
      // Koutchina logic
      const selected = data.selectedTiles || [];
      const bonbona = data.bonbonaTiles || [];

      let event: any = null;

      if (active[0] === 1 && active[1] === 1) {
        // Joker يكسح كل الطاولة
        const swept = [...room.table];
        curr.winPile.push(active, ...swept);
        curr.lastCaptureGroup = [active, ...swept];
        curr.lastCapture = active;
        room.table = [];
        event = { type: 'joker', tile: active, tilesSwept: swept };
      } else if (selected.length > 0) {
        // Get opponent player
        const opp = currIdx === 0 ? p1 : p0;
        
        // Validate capture
        if (!canCapture(active, selected, room.table)) {
          socket.emit('game:invalid', { message: 'الاختيار غير صحيح' });
          return;
        }

        const basra = isBasra(room.table, selected, active);
        const captured = [active, ...selected];

        // Bonbona - can take opponent's last capture if it matches this card's value
        if (bonbona.length > 0 && checkBonbona(active, opp.lastCaptureGroup)) {
          // Verify that bonbona tiles match the opponent's last capture group exactly
          const validBonbona = bonbona.filter(b => 
            opp.lastCaptureGroup.some(w => tilesEqual(w, b))
          );
          if (validBonbona.length > 0 && validBonbona.length === opp.lastCaptureGroup.length) {
            // Remove entire last capture group from opponent
            opp.lastCaptureGroup = [];
            opp.lastCapture = null;
            opp.winPile = opp.winPile.filter(w => !validBonbona.some(b => tilesEqual(b, w)));
            captured.push(...validBonbona);
            event = { type: 'bonbona' };
          }
        }

        curr.winPile.push(...captured);
        curr.lastCaptureGroup = captured;
        curr.lastCapture = active;
        room.table = room.table.filter(t => !selected.some(s => tilesEqual(s, t)));

        if (basra) {
          curr.basraCount++;
          event = { type: 'basra', tile: active, tiles: selected };
        } else if (!event) {
          event = { type: 'capture', tile: active, tiles: selected };
        }
      } else {
        // Drop — رمي على الطاولة
        room.table.push(active);
        event = { type: 'drop', tile: active };
      }

      // شيل الكارت من الإيد
      curr.hand = curr.hand.filter((_, i) => i !== room.activeCardIndex);

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

    room.table.push(active);
    curr.hand = curr.hand.filter((_, i) => i !== room.activeCardIndex);

    sendGameState(room, { type: 'drop', tile: active });
    setTimeout(() => advanceTurn(room), 300);
  });

  socket.on('game:next_round', () => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== 'round_end') return;
    const [p0, p1] = room.players as [PlayerState, PlayerState];
    p0.hand = []; p0.winPile = []; p0.basraCount = 0; p0.score = 0; p0.lastCapture = null; p0.lastCaptureGroup = [];
    p1.hand = []; p1.winPile = []; p1.basraCount = 0; p1.score = 0; p1.lastCapture = null; p1.lastCaptureGroup = [];
    room.roundNumber++;
    startRound(room);
  });

  socket.on('chat:message', (data: { text: string }) => {
    const room = findRoom(socket.id);
    if (!room) return;
    const player = (room.players as PlayerState[]).find(p => p.id === socket.id);
    socket.to(room.code).emit('chat:message', { senderName: player?.name ?? 'لاعب', text: data.text });
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