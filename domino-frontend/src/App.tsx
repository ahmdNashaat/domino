import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cloneElement } from "react";
import { BrowserRouter, useLocation, useRoutes } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import SplashPage from "./pages/SplashPage";
import HomePage from "./pages/HomePage";
import ModePage from "./pages/ModePage";
import RoomPage from "./pages/RoomPage";
import GamePage from "./pages/GamePage";
import ScorePage from "./pages/ScorePage";
import ClassicGamePage from "./pages/ClassicGamePage";
import ClassicScorePage from "./pages/ClassicScorePage";
import OnlineRoomPage from "./pages/OnlineRoomPage";
import OnlineGamePage from "./pages/OnlineGamePage";
import OnlineScorePage from "./pages/OnlineScorePage";
import SettingsPage from "./pages/SettingsPage";
import { useAndroidBackButton } from "./hooks/useAndroidBackButton";
import { useAppStateRestore } from "./hooks/useAppStateRestore";

import NotFound from "./pages/NotFound";
import PageTransition from "./components/PageTransition";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  useAndroidBackButton();
  useAppStateRestore();
  const element = useRoutes(
    [
      { path: "/", element: <PageTransition><SplashPage /></PageTransition> },
      { path: "/home", element: <PageTransition><HomePage /></PageTransition> },
      { path: "/mode", element: <PageTransition><ModePage /></PageTransition> },
      { path: "/room", element: <PageTransition><RoomPage /></PageTransition> },
      { path: "/online", element: <PageTransition><OnlineRoomPage /></PageTransition> },
      { path: "/online/game", element: <PageTransition><OnlineGamePage /></PageTransition> },
      { path: "/online/score", element: <PageTransition><OnlineScorePage /></PageTransition> },
      { path: "/game", element: <PageTransition><GamePage /></PageTransition> },
      { path: "/score", element: <PageTransition><ScorePage /></PageTransition> },
      { path: "/classic-game", element: <PageTransition><ClassicGamePage /></PageTransition> },
      { path: "/classic-score", element: <PageTransition><ClassicScorePage /></PageTransition> },
      { path: "/settings", element: <PageTransition><SettingsPage /></PageTransition> },
      { path: "*", element: <PageTransition><NotFound /></PageTransition> },
    ],
    location
  );

  return (
    <AnimatePresence mode="sync" initial={false}>
      {element ? cloneElement(element, { key: location.pathname }) : null}
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="relative min-h-[100dvh]">
            <AnimatedRoutes />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
