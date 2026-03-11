import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.85a60c7517cb411c8540784a911e53b2',
  appName: 'A Lovable project',
  webDir: 'dist',
  server: {
    url: 'https://85a60c75-17cb-411c-8540-784a911e53b2.lovableproject.com?forceHideBadge=true',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
