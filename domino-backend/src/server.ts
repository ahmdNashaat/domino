import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

type DominoTile = [number, number];

interface Player { id: string; name: string; }
interface Room {
  code: string;
  players: Player[];
  status: 'waiting' | 'playing';
  targetScore: number;
  timerEnabled: boolean;
  timerSeconds: number;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function findPlayerRoom(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === socketId)) return room;
  }
}

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('room:create', (data: {
    playerName: string;
    targetScore: 600 | 1000;
    timerEnabled: boolean;
    timerSeconds?: number;
  }) => {
    const code = generateCode();
    rooms.set(code, {
      code,
      players: [{ id: socket.id, name: data.playerName }],
      status: 'waiting',
      targetScore: data.targetScore,
      timerEnabled: data.timerEnabled,
      timerSeconds: data.timerSeconds ?? 30,
    });
    socket.join(code);
    socket.emit('room:created', { roomCode: code });
    console.log(`[Room Created] ${code}`);
  });

  socket.on('room:join', (data: { roomCode: string; playerName: string }) => {
    const room = rooms.get(data.roomCode.toUpperCase());

    if (!room) {
      socket.emit('room:error', { message: 'الغرفة غير موجودة' });
      return;
    }
    if (room.status === 'playing') {
      socket.emit('room:error', { message: 'اللعبة بدأت بالفعل' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('room:error', { message: 'الغرفة ممتلئة' });
      return;
    }

    room.players.push({ id: socket.id, name: data.playerName });
    room.status = 'playing';
    socket.join(room.code);

    socket.to(room.code).emit('room:opponent_joined', {
      opponentName: data.playerName
    });

    const firstPlayerId = room.players[Math.random() < 0.5 ? 0 : 1].id;

    io.to(room.code).emit('game:started', {
      firstPlayerId,
      player0Name: room.players[0].name,
      player1Name: room.players[1].name,
      targetScore: room.targetScore,
      timerEnabled: room.timerEnabled,
      timerSeconds: room.timerSeconds,
    });

    console.log(`[Game Started] ${room.code}: ${room.players[0].name} vs ${room.players[1].name}`);
  });

  socket.on('game:action', (data: { selectedTableTiles: DominoTile[] }) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:opponent_action', data);
  });

  socket.on('game:drop', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:opponent_drop');
  });

  socket.on('room:leave', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:opponent_disconnected');
    rooms.delete(room.code);
  });

  socket.on('disconnect', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:opponent_disconnected');
    rooms.delete(room.code);
    console.log(`[-] ${socket.id}`);
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok', rooms: rooms.size }));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});