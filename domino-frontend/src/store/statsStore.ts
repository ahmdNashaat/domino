import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  onlineGames: number;
  onlineWins: number;
  offlineGames: number;
  offlineWins: number;
  totalBasras: number;
  totalBonbonas: number;
  highestRoundScore: number;
  currentWinStreak: number;
  bestWinStreak: number;

  recordGame: (won: boolean, online: boolean, basras?: number, bonbonas?: number, roundScore?: number) => void;
  resetStats: () => void;
}

export const useStatsStore = create<GameStats>()(
  persist(
    (set, get) => ({
      totalGames: 0,
      wins: 0,
      losses: 0,
      onlineGames: 0,
      onlineWins: 0,
      offlineGames: 0,
      offlineWins: 0,
      totalBasras: 0,
      totalBonbonas: 0,
      highestRoundScore: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,

      recordGame: (won, online, basras = 0, bonbonas = 0, roundScore = 0) => {
        const s = get();
        const newStreak = won ? s.currentWinStreak + 1 : 0;
        set({
          totalGames: s.totalGames + 1,
          wins: s.wins + (won ? 1 : 0),
          losses: s.losses + (won ? 0 : 1),
          onlineGames: s.onlineGames + (online ? 1 : 0),
          onlineWins: s.onlineWins + (online && won ? 1 : 0),
          offlineGames: s.offlineGames + (online ? 0 : 1),
          offlineWins: s.offlineWins + (!online && won ? 1 : 0),
          totalBasras: s.totalBasras + basras,
          totalBonbonas: s.totalBonbonas + bonbonas,
          highestRoundScore: Math.max(s.highestRoundScore, roundScore),
          currentWinStreak: newStreak,
          bestWinStreak: Math.max(s.bestWinStreak, newStreak),
        });
      },

      resetStats: () => set({
        totalGames: 0, wins: 0, losses: 0,
        onlineGames: 0, onlineWins: 0,
        offlineGames: 0, offlineWins: 0,
        totalBasras: 0, totalBonbonas: 0,
        highestRoundScore: 0, currentWinStreak: 0, bestWinStreak: 0,
      }),
    }),
    { name: 'domino-stats' }
  )
);
