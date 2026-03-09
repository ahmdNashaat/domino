import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = App.addListener('backButton', ({ canGoBack }) => {
      const path = location.pathname;

      // Home/splash → minimize app
      if (path === '/' || path === '/home') {
        App.minimizeApp();
        return;
      }

      // Game screens → show exit confirmation
      if (path === '/game' || path === '/classic-game' || path === '/online/game') {
        setShowExitConfirm(true);
        return;
      }

      // Other screens → go back
      if (canGoBack) {
        navigate(-1);
      } else {
        navigate('/home');
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [location.pathname, navigate]);

  return { showExitConfirm, setShowExitConfirm };
}
