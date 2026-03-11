import { motion } from 'framer-motion';
import { LogOut, Wifi, WifiOff } from 'lucide-react';

interface PlayerInfo {
  name: string;
  score: number;
}

interface Props {
  player: PlayerInfo;
  opponent: PlayerInfo;
  roundNumber: number;
  statusText?: string;
  statusPulse?: boolean;
  onExit: () => void;
  isOnline?: boolean;
  connected?: boolean;
}

export default function GameTopBar({
  player,
  opponent,
  roundNumber,
  statusText,
  statusPulse,
  onExit,
  isOnline,
  connected,
}: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-secondary/60 backdrop-blur-sm border-b border-border/50">
      {/* Player score */}
      <div className="flex flex-col items-center min-w-[72px]">
        <span className="text-[11px] font-arabic text-muted-foreground/60 leading-tight">{player.name}</span>
        <span className="font-mono text-[28px] font-bold leading-none gold-text drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
          {player.score}
        </span>
      </div>

      {/* Center info */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-sm">
          <span className="text-[11px] text-primary/60">◈</span>
          <span className="text-[13px] font-arabic font-bold text-foreground">
            الجولة {roundNumber}
          </span>
          <span className="text-[11px] text-primary/60">◈</span>
          {isOnline && (
            connected ? (
              <Wifi className="w-3 h-3 text-accent" />
            ) : (
              <WifiOff className="w-3 h-3 text-destructive" />
            )
          )}
        </div>
        {statusText && (
          statusPulse ? (
            <motion.span
              className="text-xs text-primary font-arabic font-bold"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              {statusText}
            </motion.span>
          ) : (
            <span className="text-xs text-primary font-arabic font-bold">
              {statusText}
            </span>
          )
        )}
      </div>

      {/* Opponent score + Exit */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center min-w-[72px]">
          <span className="text-[11px] font-arabic text-muted-foreground/60 leading-tight">{opponent.name}</span>
          <span className="font-mono text-[28px] font-bold leading-none gold-text drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
            {opponent.score}
          </span>
        </div>
        <button
          onClick={onExit}
          className="p-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="خروج"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
