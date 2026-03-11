import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  DominoTile,
  isJokerTile,
  tilesEqual,
  isBasra,
  validateCapture,
  validateBonbonaRequest,
} from './koutchinaRules';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
});

// Types
// -----------------------------------------------------------------------------

interface PlayerState {
  id: string;
  name: string;
  hand: DominoTile[];
  winPile: DominoTile[];
  basraCount: number;
  basraTiles: DominoTile[];
  score: number;
  cumulativeScore: number;
  lastCapture: DominoTile | null;
  lastCaptureGroup: DominoTile[];
  captureHistory: DominoTile[][];
}

interface Room {
  code: string;
  players: PlayerState[];
  maxPlayers: number;
  status: 'waiting' | 'playing';
  table: DominoTile[];
  chain: DominoTile[];
  chainEnds: [number, number];
  boneyard: DominoTile[];
  currentPlayerIndex: number;
  targetScore: number;
  timerEnabled: boolean;
  timerSeconds: number;
  roundNumber: number;
  phase: 'waiting' | 'playing' | 'round_end' | 'game_over' | 'blocked';
  activeCardIndex: number;
  variant: 'koutchina' | 'classic';
}

const rooms = new Map<string, Room>();

// Game helpers
// -----------------------------------------------------------------------------
function generateTiles(): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push([i, j]);
    }
  }
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

function tileSum(tile: DominoTile): number {
  return tile[0] + tile[1];
}

function calculateHandScore(hand: DominoTile[]): number {
  return hand.reduce((sum, t) => sum + tileSum(t), 0);
}

function findHighestDouble(hand: DominoTile[]): number {
  let highest = -1;
  for (const t of hand) {
    if (isDouble(t) && t[0] > highest) highest = t[0];
  }
  return highest;
}

function hasPlayableTile(hand: DominoTile[], chainEnds: [number, number]): boolean {
  return hand.some(t => canPlayTile(t, chainEnds));
}

function isGameBlockedMulti(
  hands: DominoTile[][],
  boneyard: DominoTile[],
  chainEnds: [number, number]
): boolean {
  if (boneyard.length > 0) return false;
  return hands.every(hand => !hasPlayableTile(hand, chainEnds));
}

function calculateClassicRoundScoreMulti(
  hands: DominoTile[][],
  finisherIndex: number
): { handScores: number[]; winnerPoints: number; roundWinnerIndex: number } {
  const handScores = hands.map(h => calculateHandScore(h));

  if (finisherIndex >= 0) {
    const winnerPoints = handScores.reduce((s, sc, i) => (i === finisherIndex ? s : s + sc), 0);
    return { handScores, winnerPoints, roundWinnerIndex: finisherIndex };
  }

  const minScore = Math.min(...handScores);
  const minIndices = handScores.map((s, i) => (s === minScore ? i : -1)).filter(i => i >= 0);

  if (minIndices.length > 1) {
    return { handScores, winnerPoints: 0, roundWinnerIndex: -1 };
  }

  const winnerIdx = minIndices[0];
  const winnerPoints =
    handScores.reduce((s, sc, i) => (i === winnerIdx ? s : s + sc), 0) -
    handScores[winnerIdx] * (hands.length - 1);

  return { handScores, winnerPoints: Math.max(0, winnerPoints), roundWinnerIndex: winnerIdx };
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function findRoom(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === socketId)) return room;
  }
}

function createPlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
    hand: [],
    winPile: [],
    basraCount: 0,
    basraTiles: [],
    score: 0,
    cumulativeScore: 0,
    lastCapture: null,
    lastCaptureGroup: [],
    captureHistory: [],
  };
}

function resetPlayerForRound(player: PlayerState, variant: 'koutchina' | 'classic') {
  player.hand = [];
  player.score = 0;

  if (variant === 'koutchina') {
    player.winPile = [];
    player.basraCount = 0;
    player.basraTiles = [];
    player.lastCapture = null;
    player.lastCaptureGroup = [];
    player.captureHistory = [];
  }
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

function buildRoomState(room: Room) {
  return {
    roomCode: room.code,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    maxPlayers: room.maxPlayers,
    status: room.status,
    variant: room.variant,
    targetScore: room.targetScore,
  };
}

function sendRoomState(room: Room) {
  io.to(room.code).emit('room:state', buildRoomState(room));
}

function sendGameState(room: Room, lastEvent?: any) {
  if (room.players.length < 2) return;

  const currentPlayer = room.players[room.currentPlayerIndex];

  if (room.variant === 'classic') {
    const playersSummary = room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      score: p.score,
      cumulativeScore: p.cumulativeScore,
    }));

    room.players.forEach(p => {
      io.to(p.id).emit('game:state', {
        phase: room.phase,
        variant: 'classic',
        table: [],
        chain: room.chain,
        chainEnds: room.chainEnds,
        boneyardCount: room.boneyard.length,
        currentPlayerId: currentPlayer?.id || '',
        activeCardIndex: -1,
        roundNumber: room.roundNumber,
        targetScore: room.targetScore,
        lastEvent: lastEvent || null,
        players: playersSummary,
        myHand: p.hand,
      });
    });

    return;
  }

  const p0 = room.players[0];
  const p1 = room.players[1];
  if (!p0 || !p1) return;

  const currentId = currentPlayer?.id || p0.id;

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

  io.to(p0.id).emit('game:state', state);

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

  room.phase = 'playing';
  room.table = [];
  room.chain = [];
  room.chainEnds = [-1, -1];
  room.boneyard = [];

  room.players.forEach(p => resetPlayerForRound(p, room.variant));

  if (room.variant === 'classic') {
    const tilesPerPlayer = 7;
    room.players.forEach((p, i) => {
      p.hand = tiles.slice(i * tilesPerPlayer, (i + 1) * tilesPerPlayer);
    });
    room.boneyard = tiles.slice(room.players.length * tilesPerPlayer);

    let starterIdx = 0;
    let highestDouble = -1;
    room.players.forEach((p, i) => {
      const hd = findHighestDouble(p.hand);
      if (hd > highestDouble) {
        highestDouble = hd;
        starterIdx = i;
      }
    });
    if (highestDouble < 0) starterIdx = Math.floor(Math.random() * room.players.length);

    room.currentPlayerIndex = starterIdx;
    room.activeCardIndex = -1;
  } else {
    const p0 = room.players[0];
    const p1 = room.players[1];
    if (!p0 || !p1) return;

    p0.hand = tiles.slice(0, 14);
    p1.hand = tiles.slice(14, 28);

    room.currentPlayerIndex = room.roundNumber > 1
      ? (p0.cumulativeScore <= p1.cumulativeScore ? 0 : 1)
      : (Math.random() < 0.5 ? 0 : 1);

    const starter = room.players[room.currentPlayerIndex];
    room.activeCardIndex = starter.hand.length - 1;
  }

  sendGameState(room);
}

function advanceTurnClassic(room: Room) {
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  sendGameState(room);
}

function advanceTurnKoutchina(room: Room) {
  const p0 = room.players[0];
  const p1 = room.players[1];
  if (!p0 || !p1) return;

  if (p0.hand.length === 0 && p1.hand.length === 0) {
    endRound(room);
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
  } else {
    room.currentPlayerIndex = nextIdx;
  }

  const next = room.players[room.currentPlayerIndex];
  room.activeCardIndex = next.hand.length - 1;

  sendGameState(room);
}

function endRound(room: Room, finisherIndex: number = -1) {
  if (room.variant === 'classic') {
    const hands = room.players.map(p => p.hand);
    const roundScore = calculateClassicRoundScoreMulti(hands, finisherIndex);

    room.players.forEach((p, i) => {
      const pts = roundScore.roundWinnerIndex === i ? roundScore.winnerPoints : 0;
      p.score = pts;
      p.cumulativeScore += pts;
    });
  } else {
    const p0 = room.players[0];
    const p1 = room.players[1];
    if (!p0 || !p1) return;

    if (room.table.length > 0) {
      if (p0.lastCapture) {
        p0.winPile.push(...room.table);
      } else {
        p1.winPile.push(...room.table);
      }
      room.table = [];
    }

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

  if (room.players.some(p => p.cumulativeScore >= room.targetScore)) {
    room.phase = 'game_over';
  } else {
    room.phase = 'round_end';
  }

  sendGameState(room, { type: 'round_end' });
}

// Socket events
// -----------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('room:create', (data: { playerName: string; targetScore: number; timerEnabled: boolean; timerSeconds?: number; gameVariant?: string; playerCount?: number }) => {
    const code = generateCode();
    const variant = (data.gameVariant as 'koutchina' | 'classic') || 'koutchina';
    const maxPlayers = variant === 'classic'
      ? Math.max(2, Math.min(4, data.playerCount ?? 2))
      : 2;

    const room: Room = {
      code,
      players: [createPlayer(socket.id, data.playerName)],
      maxPlayers,
      status: 'waiting',
      table: [],
      chain: [],
      chainEnds: [-1, -1],
      boneyard: [],
      currentPlayerIndex: 0,
      targetScore: data.targetScore ?? (variant === 'classic' ? 100 : 600),
      timerEnabled: data.timerEnabled ?? false,
      timerSeconds: data.timerSeconds ?? 30,
      roundNumber: 1,
      phase: 'waiting',
      activeCardIndex: -1,
      variant,
    };

    rooms.set(code, room);
    socket.join(code);

    socket.emit('room:created', { roomCode: code, playerName: data.playerName, playerId: socket.id });
    sendRoomState(room);

    console.log(`[Created] ${code}`);
  });

  socket.on('room:join', (data: { roomCode: string; playerName: string }) => {
    const room = rooms.get(data.roomCode.toUpperCase());
    if (!room) { socket.emit('room:error', { message: 'Room not found' }); return; }
    if (room.status === 'playing') { socket.emit('room:error', { message: 'Room already playing' }); return; }
    if (room.players.length >= room.maxPlayers) { socket.emit('room:error', { message: 'Room is full' }); return; }

    room.players.push(createPlayer(socket.id, data.playerName));
    room.status = room.players.length >= room.maxPlayers ? 'playing' : 'waiting';
    socket.join(room.code);

    const host = room.players[0];
    socket.emit('room:joined', { roomCode: room.code, opponentName: host?.name || 'Opponent', playerId: socket.id });
    socket.to(room.code).emit('room:opponent_joined', { opponentName: data.playerName });

    sendRoomState(room);

    if (room.status === 'playing') {
      room.players.forEach(p => io.to(p.id).emit('game:started', { playerId: p.id }));
      console.log(`[Started] ${room.code}: ${room.players.map(p => p.name).join(' vs ')}`);
      setTimeout(() => startRound(room), 500);
    }
  });

  socket.on('game:action', (data: { type?: string; end?: string; tileIndex?: number; selectedTiles?: DominoTile[]; bonbonaTiles?: DominoTile[]; bonbona?: boolean }) => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== 'playing' || room.players.length < 2) return;

    const currIdx = room.currentPlayerIndex;
    const curr = room.players[currIdx];

    if (curr.id !== socket.id) {
      socket.emit('game:invalid', { message: 'Not your turn' });
      return;
    }

    if (room.variant === 'classic') {
      const actionType = data.type;

      if (actionType === 'play') {
        const tileIndex = typeof data.tileIndex === 'number' ? data.tileIndex : -1;
        if (tileIndex < 0 || tileIndex >= curr.hand.length) {
          socket.emit('game:invalid', { message: 'Invalid tile' });
          return;
        }

        const tile = curr.hand[tileIndex];
        if (!canPlayTile(tile, room.chainEnds)) {
          socket.emit('game:invalid', { message: 'Tile cannot be played' });
          return;
        }

        const playableEnds = getPlayableEnds(tile, room.chainEnds);
        let end = data.end as 'left' | 'right' | undefined;

        if (!end) {
          if (room.chain.length === 0) {
            end = playableEnds[0];
          } else if (playableEnds.length === 1) {
            end = playableEnds[0];
          }
        }

        if (!end || !playableEnds.includes(end)) {
          socket.emit('game:invalid', { message: 'Invalid end' });
          return;
        }

        room.chain = placeTile(room.chain, tile, end);
        room.chainEnds = getChainEnds(room.chain);
        curr.hand.splice(tileIndex, 1);

        sendGameState(room, { type: 'play', playerIndex: currIdx, tile, end });

        if (curr.hand.length === 0) {
          endRound(room, currIdx);
          return;
        }

        if (isGameBlockedMulti(room.players.map(p => p.hand), room.boneyard, room.chainEnds)) {
          room.phase = 'blocked';
          sendGameState(room, { type: 'block', message: 'Game blocked' });
          setTimeout(() => endRound(room, -1), 1000);
          return;
        }

        advanceTurnClassic(room);
        return;
      }

      if (actionType === 'draw') {
        if (room.boneyard.length === 0) {
          socket.emit('game:invalid', { message: 'No tiles to draw' });
          return;
        }
        if (hasPlayableTile(curr.hand, room.chainEnds)) {
          socket.emit('game:invalid', { message: 'You have a playable tile' });
          return;
        }
        const drawn = room.boneyard.pop()!;
        curr.hand.push(drawn);
        sendGameState(room, { type: 'draw', playerIndex: currIdx, count: 1 });
        return;
      }

      if (actionType === 'pass') {
        if (room.boneyard.length > 0) {
          socket.emit('game:invalid', { message: 'Cannot pass while boneyard has tiles' });
          return;
        }
        if (hasPlayableTile(curr.hand, room.chainEnds)) {
          socket.emit('game:invalid', { message: 'You have a playable tile' });
          return;
        }
        sendGameState(room, { type: 'pass', playerIndex: currIdx });

        if (isGameBlockedMulti(room.players.map(p => p.hand), room.boneyard, room.chainEnds)) {
          room.phase = 'blocked';
          sendGameState(room, { type: 'block', message: 'Game blocked' });
          setTimeout(() => endRound(room, -1), 1000);
          return;
        }

        advanceTurnClassic(room);
        return;
      }

      socket.emit('game:invalid', { message: 'Invalid action' });
      return;
    }

    // Koutchina logic
    const active = curr.hand[room.activeCardIndex];
    if (!active) { socket.emit('game:invalid', { message: 'No active tile' }); return; }

    const selected = data.selectedTiles || [];
    const bonbona = data.bonbonaTiles || [];
    const bonbonaRequested = data.bonbona === true || bonbona.length > 0;
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
    } else if (selected.length > 0 || bonbonaRequested) {
      const opp = currIdx === 0 ? room.players[1] : room.players[0];

      if (selected.length > 0) {
        const captureCheck = validateCapture(active, selected, room.table);
        if (!captureCheck.ok) {
          socket.emit('game:invalid', { message: captureCheck.message || 'Invalid capture' });
          return;
        }
      }

      let bonbonaIsBasra = false;
      if (bonbonaRequested) {
        const bonbonaCheck = validateBonbonaRequest(active, opp, bonbona);
        if (!bonbonaCheck.ok) {
          socket.emit('game:invalid', { message: bonbonaCheck.message || 'Invalid bonbona' });
          return;
        }

        bonbonaGroup = bonbonaCheck.group || [];
        bonbonaIsBasra = bonbonaCheck.countsAsBasra === true;
        if (bonbonaIsBasra) {
          opp.basraCount = Math.max(0, opp.basraCount - 1);
        }

        if (bonbonaGroup.length > 0) {
          opp.winPile = opp.winPile.filter(w => !bonbonaGroup.some(bt => tilesEqual(bt, w)));
          opp.basraTiles = opp.basraTiles.filter(w => !bonbonaGroup.some(bt => tilesEqual(bt, w)));
          popCapture(opp);
        }
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

      const isBonbona = bonbonaRequested;
      if (isBonbona) {
        event = bonbonaIsBasra ? { type: 'basra_bonbona' } : { type: 'bonbona' };
      } else if (basra) {
        event = { type: 'basra' };
      } else {
        event = { type: 'capture', tiles: captured };
      }
    } else {
      room.table.push(active);
      event = { type: 'drop', tile: active };
    }

    curr.hand = curr.hand.filter((_, i) => i !== room.activeCardIndex);

    if (curr.hand.length > 0) {
      room.activeCardIndex = curr.hand.length - 1;
    } else {
      room.activeCardIndex = -1;
    }

    sendGameState(room, event);
    setTimeout(() => advanceTurnKoutchina(room), 300);
  });

  socket.on('game:drop', () => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== 'playing' || room.players.length < 2) return;
    if (room.variant !== 'koutchina') return;

    const curr = room.players[room.currentPlayerIndex];
    if (!curr || curr.id !== socket.id) return;

    const active = curr.hand[room.activeCardIndex];
    if (!active) return;

    if (isJokerTile(active) && room.table.length > 0) {
      socket.emit('game:invalid', { message: 'Invalid joker drop' });
      return;
    }

    room.table.push(active);
    curr.hand = curr.hand.filter((_, i) => i !== room.activeCardIndex);

    sendGameState(room, { type: 'drop', tile: active });
    setTimeout(() => advanceTurnKoutchina(room), 300);
  });

  socket.on('game:next_round', () => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== 'round_end') return;
    room.roundNumber++;
    startRound(room);
  });

  socket.on('chat:message', (data: { text: string }) => {
    const room = findRoom(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    room.players.forEach((p: PlayerState) => {
      if (p.id !== socket.id) {
        io.to(p.id).emit('chat:message', { senderName: player.name, text: data.text });
      }
    });
  });

  socket.on('room:leave', () => {
    const room = findRoom(socket.id);
    if (!room) return;
    socket.leave(room.code);

    if (room.status === 'playing') {
      io.to(room.code).emit('game:opponent_disconnected');
      rooms.delete(room.code);
      return;
    }

    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(room.code);
      return;
    }

    sendRoomState(room);
  });

  socket.on('disconnect', () => {
    const room = findRoom(socket.id);
    if (!room) return;

    if (room.status === 'playing') {
      io.to(room.code).emit('game:opponent_disconnected');
      rooms.delete(room.code);
      console.log(`[-] ${socket.id}`);
      return;
    }

    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(room.code);
    } else {
      sendRoomState(room);
    }

    console.log(`[-] ${socket.id}`);
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok', rooms: rooms.size }));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
