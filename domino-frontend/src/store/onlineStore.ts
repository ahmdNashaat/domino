import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  opponentConnected: boolean;
  botReplacingOpponent: boolean;
  lastRoomCode: string | null;
  lastPlayerId: string | null;
  reconnectAvailable: boolean;
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
  setOpponentConnected: (v: boolean) => void;
  setBotReplacingOpponent: (v: boolean) => void;
  setLastRoomCode: (code: string | null) => void;
  setLastPlayerId: (id: string | null) => void;
  setReconnectAvailable: (v: boolean) => void;
  clearReconnectInfo: () => void;
  setError: (msg: string) => void;
  setPlayerName: (name: string) => void;
  setIsHost: (v: boolean) => void;
  setGameVariant: (v: GameVariant) => void;
  setRoomPlayers: (players: RoomPlayer[]) => void;
  setMaxPlayers: (n: number) => void;
  applyRoomState: (data: { roomCode: string; players: RoomPlayer[]; maxPlayers: number; status: RoomStatus; variant: GameVariant }) => void;
  resetRoom: () => void;
}

export const useOnlineStore = create<OnlineState>()(
  persist(
    (set) => ({
      connected: false,
      roomCode: null,
      roomStatus: 'idle',
      playerName: '',
      opponentName: null,
      opponentConnected: true,
      botReplacingOpponent: false,
      lastRoomCode: null,
      lastPlayerId: null,
      reconnectAvailable: false,
      error: null,
      isHost: false,
      gameVariant: 'koutchina',
      roomPlayers: [],
      maxPlayers: 2,

      setConnected: (v) => set({ connected: v }),
      setRoomCode: (code) => set({ roomCode: code, error: null }),
      setRoomStatus: (status) => set({ roomStatus: status }),
      setOpponentName: (name) => set({ opponentName: name }),
      setOpponentConnected: (v) => set({ opponentConnected: v }),
      setBotReplacingOpponent: (v) => set({ botReplacingOpponent: v }),
      setLastRoomCode: (code) => set({ lastRoomCode: code }),
      setLastPlayerId: (id) => set({ lastPlayerId: id }),
      setReconnectAvailable: (v) => set({ reconnectAvailable: v }),
      clearReconnectInfo: () => set({ lastRoomCode: null, lastPlayerId: null, reconnectAvailable: false }),
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
        opponentConnected: true,
        botReplacingOpponent: false,
        reconnectAvailable: false,
        error: null,
        isHost: false,
        gameVariant: 'koutchina',
        roomPlayers: [],
        maxPlayers: 2,
      }),
    }),
    {
      name: 'domino-online-session',
      partialize: (state) => ({
        lastRoomCode: state.lastRoomCode,
        lastPlayerId: state.lastPlayerId,
      }),
    }
  )
);
