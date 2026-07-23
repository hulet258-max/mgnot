import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TournamentShell from "./TournamentShell";
import { useUser } from "./contexts/UserContext";
import { useLanguage } from "./contexts/LanguageContext";
import { API_BASE_URL, mediaUrl, readJson, telegramHeaders, userQuery } from "./raffleApi";
import { socket } from "./socket";

function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { formatCurrency, t } = useLanguage();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTickets = useCallback(async () => {
    if (!user?.telegramId) return;
    setError("");
    try {
      const data = await readJson(await fetch(`${API_BASE_URL}/users/me/raffle-tickets${userQuery(user)}`, { headers: telegramHeaders(user) }), t("raffle.ui.failedTickets", "Failed to load your tickets."));
      setPurchases(data.purchases || []);
    } catch (err) { setError(err.message || t("raffle.ui.failedTickets", "Failed to load your tickets.")); }
    finally { setLoading(false); }
  }, [t, user]);

  useEffect(() => {
    loadTickets();
    socket.on("raffle_updated", loadTickets);
    socket.on("sync_required", loadTickets);
    return () => {
      socket.off("raffle_updated", loadTickets);
      socket.off("sync_required", loadTickets);
    };
  }, [loadTickets]);

  return (
    <TournamentShell>
      {purchases.length > 0 && <section className="tickets-page-heading"><h1>{t("raffle.ui.yourTickets", "Your tickets")}</h1><span>{t("raffle.ui.ticketCount", "{{count}} ticket(s)", { count: purchases.length })}</span></section>}
      {loading && <div className="wc-empty">{t("raffle.ui.loadingTickets", "Loading your tickets...")}</div>}
      {!loading && error && <div className="wc-empty">{error}</div>}
      {!loading && !error && purchases.length === 0 && <div className="raffle-empty-state"><img src="/brand/mgnot-mark.png" alt="" /><strong>{t("raffle.ui.emptyTicketsShort", "You have no ticket")}</strong></div>}
      {!loading && !error && purchases.length > 0 && <div className="tickets-page-list">{purchases.map((purchase) => <article className="ticket-page-card" key={`${purchase.raffleId}-${purchase.id}`}>
        <img src={mediaUrl(purchase.raffle.coverImageUrl)} alt={purchase.raffle.itemName} />
        <div className="ticket-page-item"><span>{t("raffle.ui.item", "Item")}</span><h2>{purchase.raffle.itemName}</h2><small>{t("raffle.ui.ticketPriceValue", "{{price}} ticket", { price: formatCurrency(purchase.raffle.ticketPrice) })}</small></div>
        <div className="ticket-page-number"><span>{t("raffle.ui.ticketNumber", "Ticket number")}</span><strong>{purchase.status === "assigned" ? `#${purchase.ticketNumber}` : t("raffle.ui.notSelected", "Not selected")}</strong></div>
        <div className="ticket-page-status"><span>{t("raffle.ui.status", "Status")}</span><b className={purchase.status}>{purchase.status === "assigned" ? t("raffle.ui.active", "Active") : t("raffle.ui.chooseNumber", "Choose number")}</b></div>
        {purchase.status === "pending_number" && <button className="wc-button" type="button" onClick={() => navigate("/")}>{t("raffle.ui.chooseNumber", "Choose number")}</button>}
      </article>)}</div>}
    </TournamentShell>
  );
}

export default LeaderboardPage;
