import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const STATE_KEY = 'app_state_snapshot';

interface AppSnapshot {
  route: string;
  timestamp: number;
}

export function useAppStateRestore() {
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // Save current route when going to background
        const snapshot: AppSnapshot = {
          route: location.pathname,
          timestamp: Date.now(),
        };
        localStorage.setItem(STATE_KEY, JSON.stringify(snapshot));
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [location.pathname]);
}

export function getSavedRoute(): string | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const snapshot: AppSnapshot = JSON.parse(raw);
    const elapsed = Date.now() - snapshot.timestamp;
    // Only restore if less than 30 minutes
    if (elapsed < 30 * 60 * 1000) {
      return snapshot.route;
    }
    localStorage.removeItem(STATE_KEY);
    return null;
  } catch {
    return null;
  }
}
