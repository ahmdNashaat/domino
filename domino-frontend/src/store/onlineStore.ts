import { create } from 'zustand';
import type { GameVariant } from '@/types/contracts';

export type RoomStatus = 'idle' | 'creating' | 'waiting' | 'joining' | 'playing' | 'disconnected';

export interface RoomPlayer {
  id: string;
  name: string;
}

interface OnlineState {
  connected: boolean;
  roomCode: string | null;
  roomStatus: RoomStatus;
  playerName: string;
  opponentName: string | null;
  error: string | null;
  isHost: boolean;
  gameVariant: GameVariant;
  roomPlayers: RoomPlayer[];
  maxPlayers: number;

  // Actions
  setConnected: (v: boolean) => void;
  setRoomCode: (code: string) => void;
  setRoomStatus: (status: RoomStatus) => void;
  setOpponentName: (name: string) => void;
  setError: (msg: string) => void;
  setPlayerName: (name: string) => void;
  setIsHost: (v: boolean) => void;
  setGameVariant: (v: GameVariant) => void;
  setRoomPlayers: (players: RoomPlayer[]) => void;
  setMaxPlayers: (n: number) => void;
  applyRoomState: (data: { roomCode: string; players: RoomPlayer[]; maxPlayers: number; status: RoomStatus; variant: GameVariant }) => void;
  resetRoom: () => void;
}

export const useOnlineStore = create<OnlineState>((set) => ({
  connected: false,
  roomCode: null,
  roomStatus: 'idle',
  playerName: '',
  opponentName: null,
  error: null,
  isHost: false,
  gameVariant: 'koutchina',
  roomPlayers: [],
  maxPlayers: 2,

  setConnected: (v) => set({ connected: v }),
  setRoomCode: (code) => set({ roomCode: code, error: null }),
  setRoomStatus: (status) => set({ roomStatus: status }),
  setOpponentName: (name) => set({ opponentName: name }),
  setError: (msg) => set({ error: msg }),
  setPlayerName: (name) => set({ playerName: name }),
  setIsHost: (v) => set({ isHost: v }),
  setGameVariant: (v) => set({ gameVariant: v }),
  setRoomPlayers: (players) => set({ roomPlayers: players }),
  setMaxPlayers: (n) => set({ maxPlayers: n }),
  applyRoomState: (data) => set({
    roomCode: data.roomCode,
    roomPlayers: data.players,
    maxPlayers: data.maxPlayers,
    roomStatus: data.status,
    gameVariant: data.variant,
    error: null,
  }),
  resetRoom: () => set({
    roomCode: null,
    roomStatus: 'idle',
    opponentName: null,
    error: null,
    isHost: false,
    gameVariant: 'koutchina',
    roomPlayers: [],
    maxPlayers: 2,
  }),
}));
