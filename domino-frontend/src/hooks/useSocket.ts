import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOnlineStore } from '@/store/onlineStore';
import { useOnlineGameStore, ServerGameState } from '@/store/onlineGameStore';
import { useChatStore } from '@/store/chatStore';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

let socketInstance: Socket | null = null;

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(BACKEND_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['polling', 'websocket'],
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socket = getSocket();
  const initialized = useRef(false);
  const listenersAdded = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!socket.connected) socket.connect();

    // Only add listeners once per socket instance
    if (!listenersAdded.current) {
      listenersAdded.current = true;

      // Remove any existing listeners to prevent duplicates
      socket.removeAllListeners('connect');
      socket.removeAllListeners('disconnect');
      socket.removeAllListeners('room:created');
      socket.removeAllListeners('room:joined');
      socket.removeAllListeners('room:error');
      socket.removeAllListeners('room:rejoined');
      socket.removeAllListeners('room:opponent_joined');
      socket.removeAllListeners('room:state');
      socket.removeAllListeners('game:started');
      socket.removeAllListeners('game:state');
      socket.removeAllListeners('game:event');
      socket.removeAllListeners('game:invalid');
      socket.removeAllListeners('game:opponent_disconnected');
      socket.removeAllListeners('game:opponent_reconnected');
      socket.removeAllListeners('game:bot_activated');
      socket.removeAllListeners('chat:message');

      socket.on('connect', () => {
        useOnlineStore.getState().setConnected(true);
      });

      socket.on('disconnect', () => {
        const s = useOnlineStore.getState();
        s.setConnected(false);
        if (s.roomStatus === 'playing') {
          s.setRoomStatus('disconnected');
          const code = s.lastRoomCode?.trim() || '';
          const validCode = code.length === 6;
          s.setReconnectAvailable(validCode && !!s.lastPlayerId);
        }
      });

      socket.on('room:created', (data: { roomCode: string; playerName: string; playerId: string }) => {
        const s = useOnlineStore.getState();
        s.setRoomCode(data.roomCode);
        s.setRoomStatus('waiting');
        s.setIsHost(true);
        s.setOpponentConnected(true);
        s.setBotReplacingOpponent(false);
        s.setReconnectAvailable(false);
        s.setLastRoomCode(data.roomCode);
        s.setLastPlayerId(data.playerId || null);
        if (data.playerId) {
          useOnlineGameStore.getState().setMyPlayerId(data.playerId);
        }
      });

      socket.on('room:joined', (data: { roomCode: string; opponentName: string; playerId: string }) => {
        const s = useOnlineStore.getState();
        s.setRoomCode(data.roomCode);
        s.setOpponentName(data.opponentName);
        s.setRoomStatus('waiting');
        s.setOpponentConnected(true);
        s.setBotReplacingOpponent(false);
        s.setReconnectAvailable(false);
        s.setLastRoomCode(data.roomCode);
        s.setLastPlayerId(data.playerId || null);
        if (data.playerId) {
          useOnlineGameStore.getState().setMyPlayerId(data.playerId);
        }
      });

      socket.on('room:error', (data: { message: string }) => {
        const s = useOnlineStore.getState();
        s.setError(data.message);
        if (s.reconnectAvailable || s.roomStatus === 'disconnected') {
          const lower = (data.message || '').toLowerCase();
          if (lower.includes('not found') || data.message.includes('لم يتم') || data.message.includes('لم تعد')) {
            s.clearReconnectInfo();
          } else {
            s.setReconnectAvailable(false);
          }
        }
        if (s.roomStatus === 'disconnected') {
          s.setRoomStatus('idle');
          useOnlineGameStore.getState().resetOnlineGame();
        }
      });

      socket.on('room:opponent_joined', (data: { opponentName: string }) => {
        useOnlineStore.getState().setOpponentName(data.opponentName);
        useOnlineStore.getState().setOpponentConnected(true);
        useOnlineStore.getState().setBotReplacingOpponent(false);
      });

      socket.on('room:state', (data: { roomCode: string; players: { id: string; name: string }[]; maxPlayers: number; status: any; variant: any }) => {
        useOnlineStore.getState().applyRoomState({
          roomCode: data.roomCode,
          players: data.players,
          maxPlayers: data.maxPlayers,
          status: data.status,
          variant: data.variant,
        });
      });

      socket.on('game:started', (data: { playerId: string }) => {
        useOnlineStore.getState().setRoomStatus('playing');
        useOnlineStore.getState().setOpponentConnected(true);
        useOnlineStore.getState().setBotReplacingOpponent(false);
        useOnlineStore.getState().setReconnectAvailable(false);
        if (data.playerId) {
          useOnlineGameStore.getState().setMyPlayerId(data.playerId);
          useOnlineStore.getState().setLastPlayerId(data.playerId);
        }
      });

      socket.on('room:rejoined', (data: { roomCode: string; playerId: string }) => {
        const s = useOnlineStore.getState();
        s.setRoomCode(data.roomCode);
        s.setRoomStatus('playing');
        s.setOpponentConnected(true);
        s.setBotReplacingOpponent(false);
        s.setReconnectAvailable(false);
        s.setLastRoomCode(data.roomCode);
        s.setLastPlayerId(data.playerId || null);
        if (data.playerId) {
          useOnlineGameStore.getState().setMyPlayerId(data.playerId);
        }
      });

      // Full state sync from server after every action
      socket.on('game:state', (data: ServerGameState) => {
        useOnlineGameStore.getState().applyServerState(data);
      });

      // Game events (basra, bonbona, etc.)
      socket.on('game:event', (data: { event: any }) => {
        useOnlineGameStore.getState().setEvent(data.event);
      });

      // Validation error from server
      socket.on('game:invalid', (data: { message: string }) => {
        useOnlineGameStore.getState().setEvent({ type: 'invalid', message: data.message });
      });

      socket.on('game:opponent_disconnected', (data?: { gracePeriodSeconds?: number }) => {
        const s = useOnlineStore.getState();
        s.setOpponentConnected(false);
        s.setBotReplacingOpponent(false);
        if (!data || typeof data.gracePeriodSeconds !== 'number') {
          s.setRoomStatus('disconnected');
        }
      });

      socket.on('game:opponent_reconnected', () => {
        useOnlineStore.getState().setOpponentConnected(true);
        useOnlineStore.getState().setBotReplacingOpponent(false);
      });

      socket.on('game:bot_activated', () => {
        const s = useOnlineStore.getState();
        s.setOpponentConnected(false);
        s.setBotReplacingOpponent(true);
      });

      socket.on('chat:message', (data: { senderName: string; text: string }) => {
        useChatStore.getState().addMessage({
          id: `${Date.now()}-${Math.random()}`,
          sender: 'opponent',
          senderName: data.senderName,
          text: data.text,
          timestamp: Date.now(),
        });
      });
    }
  }, []);

  const createRoom = useCallback((
    playerName: string,
    targetScore: number,
    timerEnabled: boolean,
    timerSeconds?: number,
    gameVariant: string = 'koutchina',
    playerCount?: number
  ) => {
    useOnlineStore.getState().setRoomStatus('creating');
    useOnlineStore.getState().setGameVariant(gameVariant as any);
    socket.emit('room:create', { playerName, targetScore, timerEnabled, timerSeconds, gameVariant, playerCount });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    useOnlineStore.getState().setRoomStatus('joining');
    socket.emit('room:join', { roomCode, playerName });
  }, []);

  const rejoinRoom = useCallback((roomCode: string, playerName: string, originalPlayerId: string) => {
    useOnlineStore.getState().setRoomStatus('joining');
    socket.emit('room:rejoin', { roomCode, playerName, originalPlayerId });
  }, []);

  const sendAction = useCallback((data: { type?: string; end?: string; tileIndex?: number; selectedTiles?: [number, number][]; bonbonaTiles?: [number, number][]; bonbona?: boolean }) => {
    socket.emit('game:action', data);
  }, []);

  const sendDrop = useCallback(() => {
    socket.emit('game:drop');
  }, []);

  const sendChat = useCallback((text: string) => {
    socket.emit('chat:message', { text });
    const myName = useOnlineStore.getState().playerName || 'أنا';
    useChatStore.getState().addMessage({
      id: `${Date.now()}-${Math.random()}`,
      sender: 'me',
      senderName: myName,
      text,
      timestamp: Date.now(),
    });
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit('room:leave');
    useOnlineStore.getState().resetRoom();
    useOnlineStore.getState().clearReconnectInfo();
    useOnlineGameStore.getState().resetOnlineGame();
    useChatStore.getState().clearMessages();
  }, []);

  const sendNextRound = useCallback(() => {
    socket.emit('game:next_round');
  }, []);

  return { createRoom, joinRoom, rejoinRoom, sendAction, sendDrop, sendChat, leaveRoom, sendNextRound, socket };
}
