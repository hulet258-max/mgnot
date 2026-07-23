import { useEffect, useState } from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";
import { UserProvider } from "./contexts/UserContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import MainPage from "./MainPage";
import LeaderboardPage from "./LeaderboardPage";
import SplashScreen from "./SplashScreen";
import DrawPage from "./DrawPage";

function App() {
  const [showSplash, setShowSplash] = useState(process.env.NODE_ENV !== "test");

  useEffect(() => {
    if (!showSplash) return undefined;
    const timer = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(timer);
  }, [showSplash]);

  if (showSplash) return <SplashScreen />;

  return (
    <UserProvider>
      <LanguageProvider>
        <Router>
            <Routes>
              <Route path="/" element={<MainPage />} />
              <Route path="/tickets" element={<LeaderboardPage />} />
              <Route path="/draw" element={<DrawPage />} />
              <Route path="/pools" element={<Navigate to="/" replace />} />
              <Route path="/numbers" element={<Navigate to="/tickets" replace />} />
              <Route path="/winners" element={<Navigate to="/tickets" replace />} />
              <Route path="/leaderboard" element={<Navigate to="/tickets" replace />} />
              <Route path="/group-predictions" element={<Navigate to="/tickets" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
      </LanguageProvider>
    </UserProvider>
  );
}

export default App;
