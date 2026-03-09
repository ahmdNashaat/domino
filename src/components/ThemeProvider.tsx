import { useEffect } from 'react';
import { useSettingsStore, CARD_STYLES, TABLE_STYLES, APP_THEMES } from '@/store/settingsStore';

const THEME_VARS = [
  ['--background', 'background'],
  ['--foreground', 'foreground'],
  ['--primary', 'primary'],
  ['--primary-foreground', 'primaryForeground'],
  ['--secondary', 'secondary'],
  ['--secondary-foreground', 'secondaryForeground'],
  ['--muted', 'muted'],
  ['--muted-foreground', 'mutedForeground'],
  ['--border', 'border'],
  ['--input', 'border'],
  ['--ring', 'primary'],
  ['--card', 'card'],
  ['--card-foreground', 'cardForeground'],
  ['--popover', 'popover'],
  ['--popover-foreground', 'popoverForeground'],
  ['--accent', 'accent'],
  ['--accent-foreground', 'accentForeground'],
  ['--destructive', 'destructive'],
  ['--destructive-foreground', 'destructiveForeground'],
  ['--gold-warm', 'goldWarm'],
  ['--gold-dark', 'goldDark'],
  ['--sidebar-background', 'background'],
  ['--sidebar-foreground', 'foreground'],
  ['--sidebar-primary', 'primary'],
  ['--sidebar-primary-foreground', 'primaryForeground'],
  ['--sidebar-accent', 'secondary'],
  ['--sidebar-accent-foreground', 'secondaryForeground'],
  ['--sidebar-border', 'border'],
  ['--sidebar-ring', 'primary'],
] as const;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { cardStyle, tableStyle, appTheme } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    const theme = APP_THEMES[appTheme] || APP_THEMES['dark'];
    const card = CARD_STYLES[cardStyle] || CARD_STYLES['classic'];
    const table = TABLE_STYLES[tableStyle] || TABLE_STYLES['green'];

    for (const [cssVar, key] of THEME_VARS) {
      root.style.setProperty(cssVar, (theme as any)[key]);
    }

    root.style.setProperty('--tile-face', card.tileFace);
    root.style.setProperty('--tile-back', card.tileBack);
    root.style.setProperty('--tile-dot', card.tileDot);
    root.style.setProperty('--tile-divider', card.tileDivider);

    root.style.setProperty('--felt', table.felt);
    root.style.setProperty('--felt-border', table.feltBorder);
  }, [cardStyle, tableStyle, appTheme]);

  return <>{children}</>;
}
