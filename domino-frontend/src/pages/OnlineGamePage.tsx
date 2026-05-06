import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useOnlineGameStore } from '@/store/onlineGameStore';
import { useOnlineStore } from '@/store/onlineStore';
import { useBackButtonStore } from '@/store/backButtonStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSocket } from '@/hooks/useSocket';
import PlayerHand from '@/components/game/PlayerHand';
import TableArea from '@/components/game/TableArea';
import ChainArea from '@/components/game/ChainArea';
import WinPile from '@/components/game/WinPile';
import GameEffects from '@/components/game/GameEffects';
import GameTopBar from '@/components/game/GameTopBar';
import ChatPanel from '@/components/game/ChatPanel';
import ClassicPlayerZone from '@/components/game/ClassicPlayerZone';
import { getTileHandValue, isJokerTile, isWaladTile } from '@/utils/gameEngine';
import { canPlayTile, getPlayableEnds, hasPlayableTile } from '@/utils/classicGameEngine';
import { playDropSound, playCaptureSound, playSelectSound } from '@/utils/soundEffects';
import { useIsMobile } from '@/hooks/use-mobile';
import { ArrowLeft, ArrowRight, Layers, SkipForward, LogOut, WifiOff } from 'lucide-react';
import { clearScoreSnapshot, saveScoreSnapshot } from '@/utils/scoreSnapshot';
import type { DominoTile } from '@/types/contracts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BOT_AVATARS = ['🦁', '🐉', '⚡', '🎯'];

type PlayerActionState = {
  action: 'play' | 'draw' | 'pass' | null;
  tile?: DominoTile;
};

type DrawAnim = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  key: number;
};

function DotPattern({ count }: { count: number }) {
  const positions: Record<number, [number, number][]> = {
    0: [],
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 25], [50, 50], [70, 75]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 25], [70, 25], [50, 50], [30, 75], [70, 75]],
    6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
  };
  const pos = positions[count] || [];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {pos.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={9} className="fill-[hsl(var(--tile-dot))]" />
      ))}
    </svg>
  );
}

function TurnTimer({
  deadline,
  durationSeconds,
  size = 42,
}: {
  deadline: number | null;
  durationSeconds: number;
  size?: number;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!deadline || durationSeconds <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [deadline, durationSeconds]);

  if (!deadline || durationSeconds <= 0) return null;

  const remainingMs = Math.max(0, deadline - now);
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progress = Math.max(0, Math.min(1, remainingMs / (durationSeconds * 1000)));
  const stroke = Math.max(2.5, Math.round(size * 0.1));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const ringColor = progress > 0.6
    ? 'hsl(142 70% 45%)'
    : progress > 0.3
      ? 'hsl(45 90% 55%)'
      : 'hsl(0 80% 55%)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          fill="transparent"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          animate={{ strokeDashoffset: dashOffset, stroke: ringColor }}
          transition={{ duration: 0.2, ease: 'linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-mono font-bold text-foreground">{remainingSeconds}</span>
      </div>
    </div>
  );
}

function OpponentConnectionBanner({ offsetClass = 'top-16' }: { offsetClass?: string }) {
  const opponentConnected = useOnlineStore(s => s.opponentConnected);
  const botReplacingOpponent = useOnlineStore(s => s.botReplacingOpponent);
  const [showReconnected, setShowReconnected] = useState(false);
  const prevRef = useRef(opponentConnected);

  useEffect(() => {
    if (botReplacingOpponent) {
      setShowReconnected(false);
      prevRef.current = opponentConnected;
      return;
    }

    if (prevRef.current && !opponentConnected) {
      setShowReconnected(false);
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (!prevRef.current && opponentConnected) {
      setShowReconnected(true);
      timeoutId = setTimeout(() => setShowReconnected(false), 2000);
    }

    prevRef.current = opponentConnected;

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [opponentConnected, botReplacingOpponent]);

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 z-40 ${offsetClass}`}>
      <AnimatePresence>
        {botReplacingOpponent && (
          <motion.div
            key="bot-active"
            className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-arabic shadow-lg border border-primary/30"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            🤖 البوت يلعب مكان خصمك مؤقتاً
          </motion.div>
        )}
        {!botReplacingOpponent && !opponentConnected && (
          <motion.div
            key="disconnected"
            className="px-4 py-2 rounded-xl bg-destructive/90 text-destructive-foreground text-sm font-arabic shadow-lg"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            خصمك انقطع — في انتظار عودته
          </motion.div>
        )}
        {!botReplacingOpponent && opponentConnected && showReconnected && (
          <motion.div
            key="reconnected"
            className="px-4 py-2 rounded-xl bg-accent/20 text-accent text-sm font-arabic shadow-lg"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            خصمك عاد
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReconnectOverlay({
  open,
  roomCode,
  onRejoin,
  onLeave,
}: {
  open: boolean;
  roomCode: string;
  onRejoin: () => void;
  onLeave: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md mx-4 bg-card/90 border border-border rounded-3xl p-6 text-center shadow-2xl"
            initial={{ scale: 0.9, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 10, opacity: 0 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto mb-4">
              <WifiOff className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground font-arabic mb-2">انقطع الاتصال</h2>
            <p className="text-sm text-muted-foreground font-arabic mb-4">
              مازال صديقك يلعب — هل تريد العودة؟
            </p>
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="text-xs text-muted-foreground font-arabic">رمز الغرفة</span>
              <span className="text-sm font-mono font-bold text-primary">{roomCode}</span>
            </div>
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={onRejoin}
                className="w-full py-3.5 rounded-2xl gold-gradient text-primary-foreground font-arabic font-bold text-lg"
                whileTap={{ scale: 0.97 }}
              >
                ادخل الغرفة مرة أخرى
              </motion.button>
              <motion.button
                onClick={onLeave}
                className="w-full py-3 rounded-2xl border border-border text-muted-foreground font-arabic"
                whileTap={{ scale: 0.97 }}
              >
                مغادرة اللعبة
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ExitConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? null : onCancel())}>
      <AlertDialogContent dir="rtl" className="font-arabic">
        <AlertDialogHeader className="text-center sm:text-right">
          <AlertDialogTitle className="font-arabic">تأكيد الخروج</AlertDialogTitle>
          <AlertDialogDescription className="font-arabic">
            هل تريد الخروج من اللعبة؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center sm:space-x-reverse sm:space-x-2">
          <AlertDialogCancel onClick={onCancel} className="font-arabic">
            إلغاء
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="font-arabic">
            خروج
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ──────────────────────────────────────────────
//          الدالة الجديدة المضافة
// ──────────────────────────────────────────────
function needsEndChoice(
  tile: DominoTile,
  chainEnds: [number, number],
  chainLength: number
): boolean {
  if (chainLength === 0) return false;
  const ends = getPlayableEnds(tile, chainEnds);
  if (ends.length < 2) return false;
  if (chainEnds[0] === chainEnds[1]) return false;
  return true;
}

// ──────────────────────────────────────────────
//          المكون الرئيسي
// ──────────────────────────────────────────────
export default function OnlineGamePage() {
  const navigate = useNavigate();
  const state = useOnlineGameStore();
  const { connected, gameVariant } = useOnlineStore();
  const roomStatus = useOnlineStore(s => s.roomStatus);
  const setShowExitConfirm = useBackButtonStore(s => s.setShowExitConfirm);
  const isClassic = gameVariant === 'classic' || state.variant === 'classic';
  const redirectRef = useRef(false);
  const idleRedirectRef = useRef(false);
  const phaseTerminal = state.phase === 'round_end' || state.phase === 'game_over';

  useEffect(() => {
    if (state.phase === 'idle' && !state.myPlayerId) {
      if (!idleRedirectRef.current) {
        idleRedirectRef.current = true;
        navigate('/online', { replace: true });
      }
      return;
    }
    idleRedirectRef.current = false;
  }, [state.phase, state.myPlayerId, navigate]);

  useEffect(() => {
    if (roomStatus === 'idle') {
      navigate('/online', { replace: true });
    }
  }, [roomStatus, navigate]);

  useEffect(() => {
    setShowExitConfirm(false);
  }, [setShowExitConfirm]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      setShowExitConfirm(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      setShowExitConfirm(true);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [setShowExitConfirm]);

  useEffect(() => {
    if (!phaseTerminal) {
      redirectRef.current = false;
      return;
    }
    if (redirectRef.current) return;
    redirectRef.current = true;

    const snapshot = isClassic
      ? {
          variant: 'classic' as const,
          phase: state.phase === 'game_over' ? 'game_over' : 'round_end',
          classicPlayers: state.classicPlayers,
          myPlayerId: state.myPlayerId,
          targetScore: state.targetScore,
          roundNumber: state.roundNumber,
        }
      : {
          variant: 'koutchina' as const,
          phase: state.phase === 'game_over' ? 'game_over' : 'round_end',
          me: state.me,
          opponent: state.opponent,
          targetScore: state.targetScore,
          roundNumber: state.roundNumber,
        };

    saveScoreSnapshot('scoreSnapshot:online', snapshot);
    navigate('/online/score', { state: { lastRoundSummary: snapshot }, replace: true });
  }, [
    phaseTerminal,
    isClassic,
    state.phase,
    state.classicPlayers,
    state.myPlayerId,
    state.targetScore,
    state.roundNumber,
    state.me,
    state.opponent,
    navigate,
  ]);

  if (phaseTerminal || (state.phase === 'idle' && !state.myPlayerId)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground font-arabic">جاري عرض نتيجة الجولة...</p>
      </div>
    );
  }

  if (isClassic) {
    return <OnlineClassicGame connected={connected} />;
  }

  return <OnlineKoutchinaGame connected={connected} />;
}

function OnlineKoutchinaGame({ connected }: { connected: boolean }) {
  const navigate = useNavigate();
  const state = useOnlineGameStore();
  const {
    opponentConnected,
    botReplacingOpponent,
    roomStatus,
    reconnectAvailable,
    lastRoomCode,
    lastPlayerId,
    playerName,
  } = useOnlineStore(s => ({
    opponentConnected: s.opponentConnected,
    botReplacingOpponent: s.botReplacingOpponent,
    roomStatus: s.roomStatus,
    reconnectAvailable: s.reconnectAvailable,
    lastRoomCode: s.lastRoomCode,
    lastPlayerId: s.lastPlayerId,
    playerName: s.playerName,
  }));
  const { sendAction, sendDrop, leaveRoom, rejoinRoom } = useSocket();
  const [invalidPulse, setInvalidPulse] = useState(false);
  const showExitConfirm = useBackButtonStore(s => s.showExitConfirm);
  const setShowExitConfirm = useBackButtonStore(s => s.setShowExitConfirm);

  useEffect(() => {
    if (state.lastEvent?.type === 'invalid') {
      setInvalidPulse(true);
      const t = setTimeout(() => setInvalidPulse(false), 500);
      return () => clearTimeout(t);
    }
  }, [state.lastEvent]);

  useEffect(() => {
    if (state.lastEvent && state.lastEvent.type !== 'invalid') {
      const t = setTimeout(() => state.clearEvent(), 2000);
      return () => clearTimeout(t);
    }
  }, [state.lastEvent]);

  const activeTile = state.me.hand[state.activeCardIndex];
  const isJoker = activeTile ? isJokerTile(activeTile) : false;
  const isWalad = activeTile ? isWaladTile(activeTile) : false;
  const activeValue = activeTile ? getTileHandValue(activeTile) : 0;
  const canAct = state.isMyTurn && state.phase === 'playing';
  const showTimer = state.timerEnabled && !!state.turnDeadline && state.phase === 'playing';
  const showOpponentTimer = showTimer && !state.isMyTurn;
  const showMyTimer = showTimer && state.isMyTurn;

  const handleActiveCardClick = useCallback(() => {
    if (!canAct || !activeTile) return;
    if (isJoker && state.table.length > 0) {
      playCaptureSound();
      sendAction({ selectedTiles: state.table.map(t => t as [number, number]) });
      state.clearSelections();
      return;
    }
    playDropSound();
    sendAction({ selectedTiles: [] });
    state.clearSelections();
  }, [canAct, activeTile, isJoker, state.table, sendAction]);

  const handleConfirm = useCallback(() => {
    if (!canAct) return;
    const hasSelection = state.selectedTableTiles.length > 0 || state.selectedBonbonaTiles.length > 0;
    if (!hasSelection) return;
    playCaptureSound();
    const bonbonaRequested = state.selectedBonbonaTiles.length > 0;
    sendAction({
      selectedTiles: state.selectedTableTiles as [number, number][],
      bonbonaTiles: state.selectedBonbonaTiles as [number, number][],
      bonbona: bonbonaRequested,
    });
    state.clearSelections();
  }, [canAct, state.selectedTableTiles, state.selectedBonbonaTiles, sendAction]);

  const handleExit = useCallback(() => {
    setShowExitConfirm(false);
    clearScoreSnapshot('scoreSnapshot:online');
    leaveRoom();
    state.resetOnlineGame();
    navigate('/home');
  }, [leaveRoom, navigate, setShowExitConfirm]);

  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false);
  }, [setShowExitConfirm]);

  const normalizedLastRoomCode = (lastRoomCode || '').trim().toUpperCase();
  const hasReconnectInfo = /^[A-Z0-9]{6}$/.test(normalizedLastRoomCode) && !!lastPlayerId;
  const showReconnectOverlay = (roomStatus === 'disconnected' || roomStatus === 'joining') && reconnectAvailable && hasReconnectInfo;

  const handleRejoin = useCallback(() => {
    if (!hasReconnectInfo || !lastPlayerId) return;
    const name = playerName.trim() || 'لاعب';
    useOnlineStore.getState().setPlayerName(name);
    rejoinRoom(normalizedLastRoomCode, name, lastPlayerId);
  }, [hasReconnectInfo, lastPlayerId, playerName, normalizedLastRoomCode, rejoinRoom]);

  const opponentFakeHand: [number, number][] = Array.from(
    { length: state.opponent.handCount },
    () => [0, 0] as [number, number]
  );

  const opponentStatusBadge = (
    <span className={`flex items-center gap-1 text-[10px] font-arabic px-1.5 py-0.5 rounded-full border ${
      opponentConnected
        ? 'bg-accent/10 border-accent/20 text-accent'
        : 'bg-destructive/10 border-destructive/20 text-destructive'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${opponentConnected ? 'bg-accent' : 'bg-destructive animate-pulse'}`} />
      {opponentConnected ? 'متصل' : 'منقطع'}
    </span>
  );
  const botBadge = botReplacingOpponent ? (
    <span className="flex items-center gap-1 text-[10px] font-arabic px-1.5 py-0.5 rounded-full border bg-primary/10 border-primary/30 text-primary">
      🤖 بوت
    </span>
  ) : null;

  let statusText: string | undefined;
  let statusPulse = false;
  if (!state.isMyTurn && state.phase === 'playing') {
    statusText = 'دور الخصم...';
    statusPulse = true;
  } else if (state.isMyTurn && state.phase === 'playing') {
    statusText = 'دورك! 🎯';
  }

  const showConfirm = canAct && (state.selectedTableTiles.length > 0 || state.selectedBonbonaTiles.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative" dir="rtl">
      <GameEffects event={state.lastEvent as any} />
      <ChatPanel />
      <OpponentConnectionBanner />
      <ReconnectOverlay
        open={showReconnectOverlay}
        roomCode={normalizedLastRoomCode}
        onRejoin={handleRejoin}
        onLeave={handleExit}
      />
      <ExitConfirmDialog
        open={showExitConfirm}
        onConfirm={handleExit}
        onCancel={handleCancelExit}
      />

      <GameTopBar
        player={{ name: state.me.name, score: state.me.cumulativeScore }}
        opponent={{ name: state.opponent.name, score: state.opponent.cumulativeScore }}
        roundNumber={state.roundNumber}
        statusText={statusText}
        statusPulse={statusPulse}
        onExit={handleExit}
        isOnline
        connected={connected}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Opponent row */}
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="flex-shrink-0">
            <WinPile
              label={`مكسب ${state.opponent.name}`}
              tiles={state.opponent.winPile}
              isMine={false}
              reverse={false}
              selectedBonbonaTiles={state.selectedBonbonaTiles}
              basraTiles={state.opponent.basraTiles}
              onTileTap={canAct ? (tile) => { playSelectSound(); state.selectBonbonaTile(tile); } : undefined}
            />
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <PlayerHand
                hand={opponentFakeHand}
                activeIndex={-1}
                isPlayer={false}
                label={`${state.opponent.name} (${state.opponent.handCount})`}
                nameBadge={(
                  <div className="flex items-center gap-1">
                    {opponentStatusBadge}
                    {botBadge}
                  </div>
                )}
              />
              {showOpponentTimer && (
                <TurnTimer deadline={state.turnDeadline} durationSeconds={state.timerSeconds} />
              )}
            </div>
          </div>
        </div>

        {/* Table/Chain */}
        <div className="flex-1 flex flex-col justify-center px-3 py-2 gap-2">
          <TableArea
            tiles={state.table}
            selectedTiles={state.selectedTableTiles}
            canSelect={canAct && !isJoker}
            onToggleTile={(tile) => { playSelectSound(); state.selectTableTile(tile); }}
            invalidPulse={invalidPulse}
            isWaladActive={isWalad}
            showConfirm={showConfirm}
            onConfirm={handleConfirm}
            activeValue={activeValue}
            isJoker={isJoker}
            tableEmpty={state.table.length === 0}
            canAct={canAct}
            onDrop={canAct ? handleActiveCardClick : undefined}
          />
        </div>

        {/* Player row */}
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex-shrink-0">
            <WinPile
              label="مكسبي"
              tiles={state.me.winPile}
              isMine={true}
              reverse={false}
              basraTiles={state.me.basraTiles}
            />
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <PlayerHand
                hand={state.me.hand}
                activeIndex={state.isMyTurn ? state.activeCardIndex : -1}
                isPlayer={true}
                label={`${state.me.name} (${state.me.hand.length})`}
                onActiveClick={state.isMyTurn ? handleActiveCardClick : undefined}
              />
              {showMyTimer && (
                <TurnTimer deadline={state.turnDeadline} durationSeconds={state.timerSeconds} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnlineClassicGame({ connected }: { connected: boolean }) {
  const navigate = useNavigate();
  const state = useOnlineGameStore();
  const {
    opponentConnected,
    botReplacingOpponent,
    roomStatus,
    reconnectAvailable,
    lastRoomCode,
    lastPlayerId,
    playerName,
  } = useOnlineStore(s => ({
    opponentConnected: s.opponentConnected,
    botReplacingOpponent: s.botReplacingOpponent,
    roomStatus: s.roomStatus,
    reconnectAvailable: s.reconnectAvailable,
    lastRoomCode: s.lastRoomCode,
    lastPlayerId: s.lastPlayerId,
    playerName: s.playerName,
  }));
  const { sendAction, leaveRoom, rejoinRoom } = useSocket();
  const [showEndChoice, setShowEndChoice] = useState(false);
  const [pendingTileIndex, setPendingTileIndex] = useState<number | null>(null);
  const { playerAvatar } = useSettingsStore();
  const isMobile = useIsMobile();
  const [actionMap, setActionMap] = useState<Record<string, PlayerActionState>>({});
  const [drawAnim, setDrawAnim] = useState<DrawAnim | null>(null);
  const actionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const boneyardRef = useRef<HTMLDivElement>(null);
  const topZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const bottomZoneRef = useRef<HTMLDivElement>(null);
  const showExitConfirm = useBackButtonStore(s => s.showExitConfirm);
  const setShowExitConfirm = useBackButtonStore(s => s.setShowExitConfirm);

  useEffect(() => {
    if (state.lastEvent?.type === 'invalid') {
      const t = setTimeout(() => state.clearEvent(), 2000);
      return () => clearTimeout(t);
    }
  }, [state.lastEvent]);

  useEffect(() => {
    if (state.lastEvent && state.lastEvent.type !== 'invalid') {
      const t = setTimeout(() => state.clearEvent(), 1500);
      return () => clearTimeout(t);
    }
  }, [state.lastEvent]);

  useEffect(() => {
    const event = state.lastEvent;
    if (!event || event.type === 'invalid' || event.type === 'block') return;
    if (event.type !== 'play' && event.type !== 'draw' && event.type !== 'pass') return;

    const player = state.classicPlayers[event.playerIndex];
    if (!player) return;
    const playerId = player.id;

    setActionMap(prev => ({
      ...prev,
      [playerId]: {
        action: event.type,
        tile: event.type === 'play' ? event.tile : undefined,
      },
    }));

    if (actionTimers.current[playerId]) {
      clearTimeout(actionTimers.current[playerId]);
    }
    actionTimers.current[playerId] = setTimeout(() => {
      setActionMap(prev => ({
        ...prev,
        [playerId]: { action: null },
      }));
    }, 2000);
  }, [state.lastEvent, state.classicPlayers]);

  useEffect(() => {
    return () => {
      Object.values(actionTimers.current).forEach((timer) => clearTimeout(timer));
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setShowEndChoice(false);
    setPendingTileIndex(null);
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, [state.roundNumber]);

  const currentPlayer = state.classicPlayers.find(p => p.id === state.currentPlayerId);
  const isMyTurn = state.isMyTurn && state.phase === 'playing';
  const myHand = state.myHandClassic;
  const canDraw = isMyTurn && state.boneyardCount > 0 && !hasPlayableTile(myHand, state.chainEnds);
  const canPass = isMyTurn && state.boneyardCount === 0 && !hasPlayableTile(myHand, state.chainEnds);
  const showTimer = state.timerEnabled && !!state.turnDeadline && state.phase === 'playing' && state.classicPlayers.length === 2;

  let statusText: string | undefined;
  let statusPulse = false;
  if (state.phase === 'playing' && currentPlayer) {
    if (currentPlayer.id === state.myPlayerId) {
      statusText = 'دورك!';
    } else {
      statusText = `دور ${currentPlayer.name}`;
      statusPulse = true;
    }
  }

  const playerCount = state.classicPlayers.length;
  const myIndex = state.classicPlayers.findIndex(p => p.id === state.myPlayerId);
  const rotatedPlayers = useMemo(() => {
    if (playerCount === 0) return [];
    const start = myIndex >= 0 ? myIndex : 0;
    return [...state.classicPlayers.slice(start), ...state.classicPlayers.slice(0, start)];
  }, [state.classicPlayers, playerCount, myIndex]);

  const bottomSeat = rotatedPlayers[0];
  const bottomSeatIndex = bottomSeat ? 0 : null;

  const rightSeat = !isMobile && playerCount >= 3 ? rotatedPlayers[1] : null;
  const rightSeatIndex = !isMobile && rightSeat ? 1 : null;
  const topSeat = !isMobile ? (playerCount === 2 ? rotatedPlayers[1] : rotatedPlayers[2] || null) : null;
  const topSeatIndex = !isMobile && topSeat ? (playerCount === 2 ? 1 : 2) : null;
  const leftSeat = !isMobile && playerCount >= 4 ? rotatedPlayers[3] : null;
  const leftSeatIndex = !isMobile && leftSeat ? 3 : null;

  const topBots = isMobile ? rotatedPlayers.slice(1) : [];

  const getCardCount = (seat: { id: string; handCount: number } | null) =>
    seat ? (seat.id === state.myPlayerId ? myHand.length : seat.handCount) : 0;

  const getAction = (seat: { id: string } | null) => (seat ? actionMap[seat.id] : undefined);
  const seatById = useMemo(() => {
    const map: Record<string, 'bottom' | 'right' | 'top' | 'left'> = {};
    if (bottomSeat) map[bottomSeat.id] = 'bottom';
    if (isMobile) {
      topBots.forEach(seat => {
        if (seat) map[seat.id] = 'top';
      });
      return map;
    }
    if (rightSeat) map[rightSeat.id] = 'right';
    if (topSeat) map[topSeat.id] = 'top';
    if (leftSeat) map[leftSeat.id] = 'left';
    return map;
  }, [bottomSeat, rightSeat, topSeat, leftSeat, isMobile, topBots]);

  const refBySeat = {
    bottom: bottomZoneRef,
    right: rightZoneRef,
    top: topZoneRef,
    left: leftZoneRef,
  };

  const avatarForIndex = (seatIndex: number) =>
    seatIndex === 0 ? playerAvatar : BOT_AVATARS[(seatIndex - 1 + BOT_AVATARS.length) % BOT_AVATARS.length];

  useEffect(() => {
    const event = state.lastEvent;
    if (!event || event.type !== 'draw') return;
    const player = state.classicPlayers[event.playerIndex];
    if (!player) return;
    const seat = seatById[player.id];
    if (!seat) return;
    const targetRef = refBySeat[seat];
    if (!targetRef?.current || !boneyardRef.current || !boardRef.current) return;

    const rootRect = boardRef.current.getBoundingClientRect();
    const fromRect = boneyardRef.current.getBoundingClientRect();
    const toRect = targetRef.current.getBoundingClientRect();

    const from = {
      x: fromRect.left - rootRect.left + fromRect.width / 2,
      y: fromRect.top - rootRect.top + fromRect.height / 2,
    };
    const to = {
      x: toRect.left - rootRect.left + toRect.width / 2,
      y: toRect.top - rootRect.top + toRect.height / 2,
    };

    setDrawAnim({ from, to, key: Date.now() });
  }, [state.lastEvent, state.classicPlayers, seatById]);

  // ──────────────────────────────────────────────
  //          الدوال المعدلة / الجديدة
  // ──────────────────────────────────────────────

  const handleTileSelect = (index: number) => {
    if (!isMyTurn) return;
    const tile = myHand[index];
    if (!tile) return;
    playSelectSound();

    const wasSelected = state.selectedTileIndex === index;
    const playable = canPlayTile(tile, state.chainEnds);
    state.selectTile(index);
    if (wasSelected) {
      setShowEndChoice(false);
      setPendingTileIndex(null);
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }
    if (!playable) return;

    const ends = getPlayableEnds(tile, state.chainEnds);

    if (needsEndChoice(tile, state.chainEnds, state.chain.length)) {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      setPendingTileIndex(index);
      setShowEndChoice(true);
    } else {
      setShowEndChoice(false);
      setPendingTileIndex(index);
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
      autoPlayTimerRef.current = setTimeout(() => {
        playDropSound();
        const liveState = useOnlineGameStore.getState();
        if (!liveState.isMyTurn || liveState.phase !== 'playing' || liveState.selectedTileIndex !== index) {
          setPendingTileIndex(null);
          autoPlayTimerRef.current = null;
          return;
        }
        const randomEnd = ends[Math.floor(Math.random() * ends.length)] as 'left' | 'right';
        sendAction({ type: 'play', tileIndex: index, end: randomEnd });
        setPendingTileIndex(null);
        autoPlayTimerRef.current = null;
      }, 150);
    }
  };

  const handlePlayEnd = (end: 'left' | 'right') => {
    if (pendingTileIndex === null) return;
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    playDropSound();
    sendAction({ type: 'play', tileIndex: pendingTileIndex, end });
    setShowEndChoice(false);
    setPendingTileIndex(null);
  };

  const handleCancelEndChoice = () => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setShowEndChoice(false);
    state.selectTile(-1);
    setPendingTileIndex(null);
  };

  const handleDraw = () => {
    playCaptureSound();
    sendAction({ type: 'draw' });
  };

  const handlePass = () => {
    sendAction({ type: 'pass' });
  };

  const handleExit = () => {
    setShowExitConfirm(false);
    clearScoreSnapshot('scoreSnapshot:online');
    leaveRoom();
    state.resetOnlineGame();
    navigate('/home');
  };

  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false);
  }, [setShowExitConfirm]);

  const normalizedLastRoomCode = (lastRoomCode || '').trim().toUpperCase();
  const hasReconnectInfo = /^[A-Z0-9]{6}$/.test(normalizedLastRoomCode) && !!lastPlayerId;
  const showReconnectOverlay = (roomStatus === 'disconnected' || roomStatus === 'joining') && reconnectAvailable && hasReconnectInfo;

  const handleRejoin = useCallback(() => {
    if (!hasReconnectInfo || !lastPlayerId) return;
    const name = playerName.trim() || 'لاعب';
    useOnlineStore.getState().setPlayerName(name);
    rejoinRoom(normalizedLastRoomCode, name, lastPlayerId);
  }, [hasReconnectInfo, lastPlayerId, playerName, normalizedLastRoomCode, rejoinRoom]);

  return (
    <div ref={boardRef} className="min-h-screen bg-background flex flex-col overflow-hidden relative" dir="rtl">
      <ChatPanel />
      <OpponentConnectionBanner />
      <ReconnectOverlay
        open={showReconnectOverlay}
        roomCode={normalizedLastRoomCode}
        onRejoin={handleRejoin}
        onLeave={handleExit}
      />
      <ExitConfirmDialog
        open={showExitConfirm}
        onConfirm={handleExit}
        onCancel={handleCancelExit}
      />

      {/* Event overlay */}
      <AnimatePresence>
        {state.lastEvent && state.lastEvent.type === 'block' && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="px-6 py-3 rounded-2xl bg-card/90 border border-primary/30 backdrop-blur-sm"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
            >
              <p className="text-lg font-arabic font-bold text-primary">
                اللعبة مقفلة!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invalid message */}
      <AnimatePresence>
        {state.lastEvent?.type === 'invalid' && (
          <motion.div
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-destructive/90 text-destructive-foreground text-sm font-arabic"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {state.lastEvent.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar - all player scores */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button
          onClick={handleExit}
          className="w-11 h-11 rounded-full bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground min-w-[44px] min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
          {state.classicPlayers.map((p) => (
            <motion.div
              key={p.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-arabic transition-all ${
                p.id === state.currentPlayerId
                  ? 'bg-primary/15 border border-primary/40 text-primary'
                  : 'bg-secondary/60 border border-border/50 text-muted-foreground'
              }`}
              animate={p.id === state.currentPlayerId ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="font-bold truncate max-w-[70px]">{p.name}</span>
              {state.classicPlayers.length === 2 && p.id !== state.myPlayerId && (
                <span className="flex items-center gap-1">
                  <span className={`flex items-center gap-1 text-[9px] font-arabic px-1.5 py-0.5 rounded-full border ${
                    opponentConnected
                      ? 'bg-accent/10 border-accent/20 text-accent'
                      : 'bg-destructive/10 border-destructive/20 text-destructive'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${opponentConnected ? 'bg-accent' : 'bg-destructive animate-pulse'}`} />
                    {opponentConnected ? 'متصل' : 'منقطع'}
                  </span>
                  {botReplacingOpponent && (
                    <span className="flex items-center gap-1 text-[9px] font-arabic px-1.5 py-0.5 rounded-full border bg-primary/10 border-primary/30 text-primary">
                      🤖 بوت
                    </span>
                  )}
                </span>
              )}
              <span className="font-mono font-bold">{p.cumulativeScore}</span>
              {showTimer && p.id === state.currentPlayerId && (
                <TurnTimer
                  deadline={state.turnDeadline}
                  durationSeconds={state.timerSeconds}
                  size={28}
                />
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-mono">R{state.roundNumber}</span>
          {connected ? null : <span className="text-destructive">•</span>}
        </div>
      </div>

      {/* Status */}
      {statusText && (
        <motion.div
          className="text-center py-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className={`text-xs font-arabic text-primary ${statusPulse ? 'animate-pulse' : ''}`}>
            {statusText}
          </span>
        </motion.div>
      )}

      <AnimatePresence>
        {drawAnim && (
          <motion.div
            key={drawAnim.key}
            className="absolute z-40 rounded-sm border border-border/60 diamond-pattern"
            style={{ width: 18, height: 32, background: 'hsl(var(--tile-back))' }}
            initial={{ x: drawAnim.from.x - 9, y: drawAnim.from.y - 16, opacity: 1 }}
            animate={{ x: drawAnim.to.x - 9, y: drawAnim.to.y - 16, opacity: 0 }}
            transition={{ duration: 0.4 }}
            onAnimationComplete={() => setDrawAnim(null)}
          />
        )}
      </AnimatePresence>

      {/* Board layout */}
      <div className="flex-1 flex flex-col overflow-hidden px-2 pb-2">
        <div className="flex items-center justify-center pt-2">
          {isMobile ? (
            <div ref={topZoneRef} className="flex items-center justify-center gap-2 flex-wrap">
              {topBots.map((seat, idx) => {
                const seatIndex = idx + 1;
                return (
                  <ClassicPlayerZone
                    key={seat.id}
                    position="top"
                    avatar={avatarForIndex(seatIndex)}
                    name={seat.name}
                    cardCount={getCardCount(seat)}
                    isCurrentTurn={seat.id === state.currentPlayerId}
                    lastAction={getAction(seat)?.action ?? null}
                    lastPlayedTile={getAction(seat)?.tile}
                  />
                );
              })}
            </div>
          ) : (
            topSeat && topSeatIndex !== null && (
              <ClassicPlayerZone
                ref={topZoneRef}
                position="top"
                avatar={avatarForIndex(topSeatIndex)}
                name={topSeat.name}
                cardCount={getCardCount(topSeat)}
                isCurrentTurn={topSeat.id === state.currentPlayerId}
                lastAction={getAction(topSeat)?.action ?? null}
                lastPlayedTile={getAction(topSeat)?.tile}
              />
            )
          )}
        </div>

        <div className="flex-1 flex items-stretch gap-2 mt-2">
          {leftSeat && leftSeatIndex !== null && (
            <div className="flex items-center justify-center">
              <ClassicPlayerZone
                ref={leftZoneRef}
                position="left"
                avatar={avatarForIndex(leftSeatIndex)}
                name={leftSeat.name}
                cardCount={getCardCount(leftSeat)}
                isCurrentTurn={leftSeat.id === state.currentPlayerId}
                lastAction={getAction(leftSeat)?.action ?? null}
                lastPlayedTile={getAction(leftSeat)?.tile}
              />
            </div>
          )}

          <div
            className="flex-1 felt-bg rounded-xl flex flex-col relative overflow-hidden"
            style={{ minHeight: 0 }}
            onClick={showEndChoice ? handleCancelEndChoice : undefined}
          >
            {state.boneyardCount > 0 && (
              <div ref={boneyardRef} className="absolute left-2 top-2 flex flex-col items-center gap-1 z-10">
                <div className="flex flex-col items-center gap-0.5 max-h-full overflow-y-auto scrollbar-hide">
                  {Array.from({ length: Math.min(6, state.boneyardCount) }).map((_, bi) => (
                    <motion.div
                      key={bi}
                      className="w-6 h-9 rounded-sm border border-border/50 diamond-pattern flex-shrink-0"
                      style={{ background: 'hsl(var(--tile-back))' }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: bi * 0.03 }}
                    />
                  ))}
                  {state.boneyardCount > 6 && (
                    <span className="text-[9px] font-mono text-muted-foreground/60">+{state.boneyardCount - 6}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-card/80 rounded-lg px-2 py-0.5 border border-border/50">
                  <Layers className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-mono text-muted-foreground">{state.boneyardCount}</span>
                </div>
              </div>
            )}

            <ChainArea
              chain={state.chain}
              chainEnds={state.chainEnds}
              highlightEnds={showEndChoice}
              onLeftEndClick={showEndChoice ? () => handlePlayEnd('left') : undefined}
              onRightEndClick={showEndChoice ? () => handlePlayEnd('right') : undefined}
            />
          </div>

          {rightSeat && rightSeatIndex !== null && (
            <div className="flex items-center justify-center">
              <ClassicPlayerZone
                ref={rightZoneRef}
                position="right"
                avatar={avatarForIndex(rightSeatIndex)}
                name={rightSeat.name}
                cardCount={getCardCount(rightSeat)}
                isCurrentTurn={rightSeat.id === state.currentPlayerId}
                lastAction={getAction(rightSeat)?.action ?? null}
                lastPlayedTile={getAction(rightSeat)?.tile}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-center mt-2">
          {bottomSeat && bottomSeatIndex !== null && (
            <ClassicPlayerZone
              ref={bottomZoneRef}
              position="bottom"
              avatar={avatarForIndex(bottomSeatIndex)}
              name={bottomSeat.name}
              cardCount={getCardCount(bottomSeat)}
              isCurrentTurn={bottomSeat.id === state.currentPlayerId}
              lastAction={getAction(bottomSeat)?.action ?? null}
              lastPlayedTile={getAction(bottomSeat)?.tile}
              showHand={false}
            />
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 px-4 py-2">
        {canDraw && (
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 bg-accent/20 border border-accent/30 text-accent rounded-xl font-arabic text-sm font-bold"
            onClick={handleDraw}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Layers className="w-4 h-4" />
            اسحب ({state.boneyardCount})
          </motion.button>
        )}
        {canPass && (
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 bg-destructive/20 border border-destructive/30 text-destructive rounded-xl font-arabic text-sm font-bold"
            onClick={handlePass}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.95 }}
          >
            <SkipForward className="w-4 h-4" />
            تمرير
          </motion.button>
        )}
      </div>

      {/* Player hand */}
      <div className="px-2 pb-3 pt-1">
        <div className="overflow-x-auto flex items-center justify-center scrollbar-hide">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {myHand.map((tile, i) => {
              const playable = isMyTurn && canPlayTile(tile, state.chainEnds);
              const selected = state.selectedTileIndex === i;

              return (
                <motion.button
                  key={`${tile[0]}-${tile[1]}-${i}`}
                  className={`flex flex-col w-10 h-20 tile-face rounded-lg border-2 shadow-md overflow-hidden transition-all ${
                    selected
                      ? 'border-primary gold-glow -translate-y-2'
                      : playable
                        ? 'border-accent/50 hover:border-accent'
                        : 'border-border/30 opacity-60'
                  }`}
                  onClick={() => handleTileSelect(i)}
                  whileTap={{ scale: 0.95 }}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: selected ? -8 : 0, opacity: playable || selected ? 1 : 0.6 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="flex-1 p-0.5">
                    <DotPattern count={tile[0]} />
                  </div>
                  <div className="w-8 mx-auto h-px bg-[hsl(var(--tile-divider))]" />
                  <div className="flex-1 p-0.5">
                    <DotPattern count={tile[1]} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
        <p className="text-center text-xs font-arabic text-muted-foreground mt-1">
          {state.classicPlayers.find(p => p.id === state.myPlayerId)?.name || 'أنت'} ({myHand.length} قطعة)
        </p>
      </div>
    </div>
  );
}
