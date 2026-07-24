import { useEffect, useState } from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";
import { UserProvider } from "./contexts/UserContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { useLanguage } from "./contexts/LanguageContext";
import MainPage from "./MainPage";
import LeaderboardPage from "./LeaderboardPage";
import SplashScreen from "./SplashScreen";
import DrawPage from "./DrawPage";

function RaffleRoutes() {
  const { language, setLanguage, t } = useLanguage();
  const [showIntro, setShowIntro] = useState(process.env.NODE_ENV !== "test");

  return (
    <>
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
      {showIntro && <div className="modal-backdrop raffle-intro-backdrop" role="dialog" aria-modal="true" aria-labelledby="raffle-intro-title">
        <section className="raffle-intro-modal">
          <div className="raffle-intro-language" aria-label={t("raffle.ui.chooseLanguage", "Choose language")}>
            <button className={language === "am" ? "active" : ""} type="button" onClick={() => setLanguage("am")}>አማ</button>
            <button className={language === "en" ? "active" : ""} type="button" onClick={() => setLanguage("en")}>EN</button>
            <button className={language === "om" ? "active" : ""} type="button" onClick={() => setLanguage("om")}>OR</button>
          </div>
          <span className="raffle-intro-mark"><img src="/brand/mgnot-mark.png" alt="" /></span>
          <p className="wc-eyebrow">{t("raffle.ui.introEyebrow", "Item raffle")}</p>
          <h1 id="raffle-intro-title">{t("raffle.ui.introTitle", "How Mgnot works")}</h1>
          <p className="raffle-intro-copy">{t("raffle.ui.introBody", "Choose an item, select a lucky number, pay, and get a chance to win.")}</p>
          <ol className="raffle-intro-steps">
            <li><span>1</span><div><strong>{t("raffle.ui.introStep1Title", "Choose an item")}</strong><p>{t("raffle.ui.introStep1Body", "Browse the available raffle items.")}</p></div></li>
            <li><span>2</span><div><strong>{t("raffle.ui.introStep2Title", "Select a number")}</strong><p>{t("raffle.ui.introStep2Body", "Pick one available lucky number.")}</p></div></li>
            <li><span>3</span><div><strong>{t("raffle.ui.introStep3Title", "Pay securely")}</strong><p>{t("raffle.ui.introStep3Body", "Pay with Telebirr and confirm the payment.")}</p></div></li>
            <li><span>4</span><div><strong>{t("raffle.ui.introStep4Title", "Wait for the draw")}</strong><p>{t("raffle.ui.introStep4Body", "If your number is selected, you win the item.")}</p></div></li>
          </ol>
          <button className="wc-button raffle-intro-start" type="button" onClick={() => setShowIntro(false)}>{t("raffle.ui.introStart", "Start choosing")}</button>
        </section>
      </div>}
    </>
  );
}

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
          <RaffleRoutes />
        </Router>
      </LanguageProvider>
    </UserProvider>
  );
}

export default App;
