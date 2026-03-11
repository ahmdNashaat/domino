import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CardStyle = 'classic' | 'ivory' | 'black' | 'glossy-black';
export type TableStyle = 'oak-wood' | 'dark-wood' | 'green' | 'white' | 'brown';
export type AppTheme = 'light' | 'dark';

export const CARD_STYLES: Record<CardStyle, { label: string; labelAr: string; tileFace: string; tileBack: string; tileDot: string; tileDivider: string }> = {
  classic: {
    label: 'Classic', labelAr: 'كلاسيكي',
    tileFace: '38 40% 93%', tileBack: '0 0% 95%', tileDot: '240 33% 7%', tileDivider: '36 86% 38%',
  },
  ivory: {
    label: 'Ivory', labelAr: 'عاجي',
    tileFace: '40 50% 96%', tileBack: '30 20% 25%', tileDot: '20 30% 15%', tileDivider: '30 60% 50%',
  },
  black: {
    label: 'Black', labelAr: 'أسود',
    tileFace: '0 0% 10%', tileBack: '0 0% 5%', tileDot: '0 0% 95%', tileDivider: '0 0% 40%',
  },
  'glossy-black': {
    label: 'Glossy Black', labelAr: 'أسود لامع',
    tileFace: '220 15% 15%', tileBack: '220 20% 8%', tileDot: '51 100% 50%', tileDivider: '51 80% 45%',
  },
};

export const TABLE_STYLES: Record<TableStyle, { label: string; labelAr: string; felt: string; feltBorder: string; gradient: string }> = {
  'oak-wood': {
    label: 'Oak Wood', labelAr: 'خشب بلوط',
    felt: '30 35% 18%', feltBorder: '30 25% 28%',
    gradient: 'radial-gradient(ellipse at center, hsl(30, 35%, 22%) 0%, hsl(30, 35%, 14%) 100%)',
  },
  'dark-wood': {
    label: 'Dark Wood', labelAr: 'خشب غامق',
    felt: '15 30% 12%', feltBorder: '15 25% 20%',
    gradient: 'radial-gradient(ellipse at center, hsl(15, 30%, 16%) 0%, hsl(15, 30%, 9%) 100%)',
  },
  green: {
    label: 'Green', labelAr: 'أخضر',
    felt: '140 50% 9%', feltBorder: '140 35% 17%',
    gradient: 'radial-gradient(ellipse at center, hsl(140, 50%, 12%) 0%, hsl(140, 50%, 7%) 100%)',
  },
  white: {
    label: 'White', labelAr: 'أبيض',
    felt: '0 0% 92%', feltBorder: '0 0% 80%',
    gradient: 'radial-gradient(ellipse at center, hsl(0, 0%, 96%) 0%, hsl(0, 0%, 88%) 100%)',
  },
  brown: {
    label: 'Brown', labelAr: 'أسمر',
    felt: '25 40% 14%', feltBorder: '25 30% 24%',
    gradient: 'radial-gradient(ellipse at center, hsl(25, 40%, 18%) 0%, hsl(25, 40%, 10%) 100%)',
  },
};

export interface AppThemeConfig {
  label: string;
  labelAr: string;
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  goldWarm: string;
  goldDark: string;
}

export const APP_THEMES: Record<AppTheme, AppThemeConfig> = {
  dark: {
    label: 'Night', labelAr: 'ليلي',
    background: '222 60% 5%', foreground: '225 60% 97%',
    primary: '51 100% 50%', primaryForeground: '222 60% 5%',
    secondary: '225 40% 14%', secondaryForeground: '225 60% 97%',
    muted: '225 20% 20%', mutedForeground: '222 15% 55%',
    border: '225 30% 18%',
    card: '225 35% 18%', cardForeground: '225 60% 97%',
    popover: '225 45% 10%', popoverForeground: '225 60% 97%',
    accent: '160 100% 39%', accentForeground: '222 60% 5%',
    destructive: '0 100% 63%', destructiveForeground: '0 0% 100%',
    goldWarm: '45 90% 57%', goldDark: '36 86% 38%',
  },
  light: {
    label: 'Day', labelAr: 'نهاري',
    background: '30 20% 97%', foreground: '222 47% 11%',
    primary: '36 86% 38%', primaryForeground: '0 0% 100%',
    secondary: '30 15% 90%', secondaryForeground: '222 47% 11%',
    muted: '30 10% 85%', mutedForeground: '222 15% 40%',
    border: '30 15% 82%',
    card: '0 0% 100%', cardForeground: '222 47% 11%',
    popover: '0 0% 100%', popoverForeground: '222 47% 11%',
    accent: '160 80% 32%', accentForeground: '0 0% 100%',
    destructive: '0 85% 50%', destructiveForeground: '0 0% 100%',
    goldWarm: '36 86% 38%', goldDark: '30 80% 25%',
  },
};

export const AVATAR_OPTIONS = ['👤', '🎮', '👑', '🦁', '🐉', '🎯', '⚡', '🔥'] as const;

interface SettingsStore {
  cardStyle: CardStyle;
  tableStyle: TableStyle;
  appTheme: AppTheme;
  soundEnabled: boolean;
  chatEnabled: boolean;
  playerName: string;
  playerAvatar: string;
  setCardStyle: (style: CardStyle) => void;
  setTableStyle: (style: TableStyle) => void;
  setAppTheme: (theme: AppTheme) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setChatEnabled: (enabled: boolean) => void;
  setPlayerName: (name: string) => void;
  setPlayerAvatar: (avatar: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      cardStyle: 'classic',
      tableStyle: 'green',
      appTheme: 'dark',
      soundEnabled: true,
      chatEnabled: true,
      playerName: 'لاعب',
      playerAvatar: '👤',
      setCardStyle: (cardStyle) => set({ cardStyle }),
      setTableStyle: (tableStyle) => set({ tableStyle }),
      setAppTheme: (appTheme) => set({ appTheme }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setChatEnabled: (chatEnabled) => set({ chatEnabled }),
      setPlayerName: (name) => set({ playerName: name }),
      setPlayerAvatar: (avatar) => set({ playerAvatar: avatar }),
    }),
    {
      name: 'domino-settings',
      // Migrate old 'modern-dark' to 'dark'
      migrate: (persistedState: any) => {
        if (persistedState?.appTheme === 'modern-dark') {
          persistedState.appTheme = 'dark';
        }
        return persistedState;
      },
      version: 1,
    }
  )
);
