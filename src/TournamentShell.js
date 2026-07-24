import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import { useLanguage } from "./contexts/LanguageContext";
import { API_BASE_URL, mediaUrl, readJson, telegramHeaders, userQuery } from "./raffleApi";
import { socket } from "./socket";
import "./TournamentShell.css";
import "./Raffle.css";

const languageLabels = { en: "EN", am: "አማ", om: "OR" };

function TournamentShell({ children, eyebrow, title, subtitle, actions }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, error } = useUser();
  const { language, setLanguage, t, formatCurrency } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : user?.username || t("raffle.ui.telegramUser", "Telegram user");
  const initials = useMemo(
    () => displayName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
    [displayName]
  );

  useEffect(() => {
    if (!user?.telegramId) return undefined;
    let cancelled = false;
    const loadTickets = () => {
      if (profileOpen) setProfileLoading(true);
      fetch(`${API_BASE_URL}/users/me/raffle-tickets${userQuery(user)}`, { headers: telegramHeaders(user) })
        .then((response) => readJson(response, t("raffle.ui.failedTickets", "Failed to load tickets.")))
        .then((data) => { if (!cancelled) setPurchases(data.purchases || []); })
        .catch(() => { if (!cancelled) setPurchases([]); })
        .finally(() => { if (!cancelled) setProfileLoading(false); });
    };
    loadTickets();
    socket.on("raffle_updated", loadTickets);
    socket.on("sync_required", loadTickets);
    return () => {
      cancelled = true;
      socket.off("raffle_updated", loadTickets);
      socket.off("sync_required", loadTickets);
    };
  }, [profileOpen, user, t]);

  const assigned = purchases.filter((purchase) => purchase.status === "assigned");
  const pending = purchases.filter((purchase) => purchase.status === "pending_number");
  const brandName = language === "am" ? "ምኞት" : "mgnot";

  return (
    <div className="wc-app raffle-app">
      <div className="wc-page-art" aria-hidden="true">
        <img className="brand-particle brand-particle-main" src="/brand/mgnot-mark.png" alt="" />
        <img className="brand-particle brand-particle-small" src="/brand/mgnot-mark.png" alt="" />
        <img className="brand-particle brand-particle-float" src="/brand/mgnot-mark.png" alt="" />
      </div>
      <header className="wc-topbar">
        <button className="wc-brand" type="button" onClick={() => navigate("/")}>
          <span className="wc-brand-mark"><img src="/brand/mgnot-mark.png" alt="" /></span>
          <span className="wc-brand-copy"><strong>{brandName}</strong><small>{t("raffle.ui.tagline", "Wish it. Get it.")}</small></span>
        </button>
        <div className="wc-topbar-actions">
          <button className="wc-lang-button" type="button" onClick={() => setLanguageOpen(true)} aria-label={t("raffle.ui.chooseLanguage", "Choose language")}>{languageLabels[language] || "አማ"}</button>
          <button className="wc-avatar-button" type="button" onClick={() => setProfileOpen(true)} aria-label={t("raffle.ui.openProfile", "Open profile")}>
            {user?.photo ? <img src={user.photo} alt="" /> : <span>{initials || "U"}</span>}
          </button>
        </div>
        <nav className="wc-nav" aria-label={t("raffle.ui.raffleSections", "Raffle sections")}>
          <Link className={location.pathname === "/" ? "wc-nav-link active" : "wc-nav-link"} to="/">{t("raffle.nav.home", "Home")}</Link>
          <Link className={location.pathname === "/tickets" ? "wc-nav-link active" : "wc-nav-link"} to="/tickets">{t("raffle.nav.tickets", "Your tickets")}</Link>
          <Link className={location.pathname === "/draw" ? "wc-nav-link active" : "wc-nav-link"} to="/draw">{t("raffle.nav.draw", "Draw")}</Link>
        </nav>
      </header>

      {languageOpen && <div className="modal-backdrop language-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="language-modal-title" onClick={() => setLanguageOpen(false)}>
        <div className="language-modal" onClick={(event) => event.stopPropagation()}>
          <button className="raffle-modal-close" type="button" onClick={() => setLanguageOpen(false)} aria-label={t("raffle.ui.close", "Close")}>×</button>
          <p className="wc-eyebrow">{t("raffle.ui.chooseLanguage", "Choose language")}</p>
          <h2 id="language-modal-title">{t("raffle.ui.chooseLanguage", "Choose language")}</h2>
          <div className="language-modal-options">
            <button className={language === "am" ? "active" : ""} type="button" onClick={() => { setLanguage("am"); setLanguageOpen(false); }}><span>አማ</span><strong>{t("raffle.ui.amharic", "Amharic")}</strong></button>
            <button className={language === "en" ? "active" : ""} type="button" onClick={() => { setLanguage("en"); setLanguageOpen(false); }}><span>EN</span><strong>{t("raffle.ui.english", "English")}</strong></button>
            <button className={language === "om" ? "active" : ""} type="button" onClick={() => { setLanguage("om"); setLanguageOpen(false); }}><span>OR</span><strong>{t("raffle.ui.oromifa", "Afaan Oromoo")}</strong></button>
          </div>
        </div>
      </div>}

      {profileOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setProfileOpen(false)}>
        <div className="profile-modal raffle-profile" onClick={(event) => event.stopPropagation()}>
          <button className="raffle-modal-close" type="button" onClick={() => setProfileOpen(false)} aria-label={t("raffle.ui.close", "Close")}>×</button>
          <div className="profile-header">
            <div className="profile-avatar">{user?.photo ? <img src={user.photo} alt="" /> : <span>{initials || "U"}</span>}</div>
            <div className="profile-title"><strong>{loading ? t("raffle.ui.loading", "Loading...") : displayName}</strong><span>{error ? t("raffle.ui.telegramOffline", "Telegram sync offline") : user?.username ? `@${user.username}` : t("raffle.ui.connectedAccount", "Connected account")}</span></div>
          </div>
          <div className="profile-stat-grid">
            <div><span>{t("raffle.ui.ownedTickets", "Owned tickets")}</span><strong>{assigned.length}</strong></div>
            <div><span>{t("raffle.ui.chooseNumber", "Choose number")}</span><strong>{pending.length}</strong></div>
          </div>
          <div className="raffle-profile-list">
            {profileLoading && <div className="wc-empty">{t("raffle.ui.loadingTickets", "Loading tickets...")}</div>}
            {!profileLoading && !purchases.length && <div className="wc-empty">{t("raffle.ui.noProfileTickets", "You have not bought a raffle ticket yet.")}</div>}
            {purchases.map((purchase) => <div className="raffle-profile-ticket" key={`${purchase.raffleId}-${purchase.id}`}>
              <img src={mediaUrl(purchase.raffle.coverImageUrl)} alt="" />
              <div><strong>{purchase.raffle.itemName}</strong><span>{purchase.status === "assigned" ? t("raffle.ui.ticketAssigned", "Ticket #{{number}}", { number: purchase.ticketNumber }) : t("raffle.ui.paymentPending", "Payment confirmed — number pending")}</span></div>
              <b>{formatCurrency(purchase.raffle.ticketPrice)}</b>
            </div>)}
          </div>
        </div>
      </div>}

      <main className="wc-main">
        {(eyebrow || title || subtitle || actions) && <section className="wc-page-heading"><div>{eyebrow && <p className="wc-eyebrow">{eyebrow}</p>}{title && <h1>{title}</h1>}{subtitle && <p className="wc-subtitle">{subtitle}</p>}</div>{actions && <div className="wc-heading-actions">{actions}</div>}</section>}
        {children}
      </main>
    </div>
  );
}

export default TournamentShell;
