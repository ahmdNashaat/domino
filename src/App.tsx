import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  useAndroidBackButton();
  useAppStateRestore();
  return (
    <AnimatePresence>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<SplashPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/mode" element={<ModePage />} />
        <Route path="/room" element={<RoomPage />} />
        <Route path="/online" element={<OnlineRoomPage />} />
        <Route path="/online/game" element={<OnlineGamePage />} />
        <Route path="/online/score" element={<OnlineScorePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/score" element={<ScorePage />} />
        <Route path="/classic-game" element={<ClassicGamePage />} />
        <Route path="/classic-score" element={<ClassicScorePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
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
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
