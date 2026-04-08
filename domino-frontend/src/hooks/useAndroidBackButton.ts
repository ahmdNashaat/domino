import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useBackButtonStore } from '@/store/backButtonStore';

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const showExitConfirm = useBackButtonStore(s => s.showExitConfirm);
  const setShowExitConfirm = useBackButtonStore(s => s.setShowExitConfirm);

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
      if (path === '/online/score') {
        navigate('/home', { replace: true });
        return;
      }

      if (path === '/online/game') {
        setShowExitConfirm(true);
        return;
      }

      if (path === '/game' || path === '/classic-game') {
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
