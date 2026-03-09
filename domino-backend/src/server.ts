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
    targetScore: number;
    timerEnabled: boolean;
    timerSeconds?: number;
    gameVariant?: string;
  }) => {
    const code = generateCode();
    rooms.set(code, {
      code,
      players: [{ id: socket.id, name: data.playerName }],
      status: 'waiting',
      targetScore: data.targetScore ?? 600,
      timerEnabled: data.timerEnabled ?? false,
      timerSeconds: data.timerSeconds ?? 30,
    });
    socket.join(code);
    // ✅ أضف playerId
    socket.emit('room:created', {
      roomCode: code,
      playerName: data.playerName,
      playerId: socket.id,
    });
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

    const p0 = room.players[0];
    const p1 = room.players[1];

    // ✅ أضف playerId في room:joined
    socket.emit('room:joined', {
      roomCode: room.code,
      opponentName: p0.name,
      playerId: socket.id,
    });

    // ✅ ابلّغ اللاعب الأول بالخصم
    socket.to(room.code).emit('room:opponent_joined', {
      opponentName: data.playerName,
    });

    // ✅ ابعت لكل لاعب playerId الخاص بيه
    io.to(p0.id).emit('game:started', {
      playerId: p0.id,
      opponentName: p1.name,
      targetScore: room.targetScore,
      timerEnabled: room.timerEnabled,
      timerSeconds: room.timerSeconds,
    });

    io.to(p1.id).emit('game:started', {
      playerId: p1.id,
      opponentName: p0.name,
      targetScore: room.targetScore,
      timerEnabled: room.timerEnabled,
      timerSeconds: room.timerSeconds,
    });

    console.log(`[Game Started] ${room.code}: ${p0.name} vs ${p1.name}`);
  });

  socket.on('game:action', (data: { selectedTiles: DominoTile[] }) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:opponent_action', data);
  });

  socket.on('game:drop', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    socket.to(room.code).emit('game:opponent_drop');
  });

  socket.on('chat:message', (data: { text: string }) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    socket.to(room.code).emit('chat:message', {
      senderName: player?.name ?? 'لاعب',
      text: data.text,
    });
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