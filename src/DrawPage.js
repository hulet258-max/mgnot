import React, { useEffect, useMemo, useRef, useState } from "react";
import TournamentShell from "./TournamentShell";
import { useLanguage } from "./contexts/LanguageContext";
import { useUser } from "./contexts/UserContext";
import { useRaffles } from "./useRaffles";
import { API_BASE_URL, mediaUrl, readJson, telegramHeaders, userQuery } from "./raffleApi";
import ResponsiveImage from "./ResponsiveImage";
import { socket } from "./socket";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatCountdown(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function DrawPage() {
  const { t } = useLanguage();
  const { user } = useUser();
  const { raffles, loading, error, reload } = useRaffles();
  const [now, setNow] = useState(Date.now());
  const [taken, setTaken] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const viewedResults = useRef(new Set());

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(reload, 15000);
    return () => { clearInterval(clock); clearInterval(poll); };
  }, [reload]);

  const raffle = useMemo(() => {
    const scheduled = raffles
      .filter((entry) => {
        const drawTime = new Date(entry.drawAt || 0).getTime();
        return entry.drawAt && ["open", "sold_out"].includes(entry.status) && drawTime - now <= DAY_MS && now - drawTime <= 5 * 60 * 1000;
      })
      .sort((a, b) => new Date(a.drawAt) - new Date(b.drawAt))[0];
    if (scheduled) return scheduled;
    return raffles
      .filter((entry) => entry.status === "completed" && entry.winningNumber)
      .sort((a, b) => new Date(b.drawnAt || 0) - new Date(a.drawnAt || 0))[0] || null;
  }, [raffles, now]);

  useEffect(() => {
    if (!raffle) { setTaken([]); return undefined; }
    let cancelled = false;
    const loadTaken = (payload) => {
      if (payload?.raffleId && payload.raffleId !== raffle.id) return;
      if (Array.isArray(payload?.takenNumbers)) {
        if (!cancelled) setTaken(payload.takenNumbers.map(Number).filter(Boolean));
        return;
      }
      fetch(`${API_BASE_URL}/raffles/${raffle.id}/numbers`)
        .then((response) => readJson(response, "Failed to load draw numbers."))
        .then((data) => {
          if (!cancelled) setTaken((data.numbers || []).filter((entry) => entry.status !== "available").map((entry) => entry.number));
        })
        .catch(() => { if (!cancelled) setTaken([]); });
    };
    loadTaken({});
    socket.on("raffle_updated", loadTaken);
    socket.on("sync_required", loadTaken);
    return () => {
      cancelled = true;
      socket.off("raffle_updated", loadTaken);
      socket.off("sync_required", loadTaken);
    };
  }, [raffle]);

  useEffect(() => {
    if (!raffle || !user?.telegramId) {
      setMyTickets([]);
      return undefined;
    }

    let cancelled = false;
    const loadMyTickets = () => {
      fetch(`${API_BASE_URL}/users/me/raffle-tickets${userQuery(user)}`, {
        headers: telegramHeaders(user)
      })
        .then((response) => readJson(response, t("raffle.ui.failedTickets", "Failed to load your tickets.")))
        .then((data) => {
          if (cancelled) return;
          setMyTickets(
            (data.purchases || []).filter((purchase) => String(purchase.raffleId) === String(raffle.id))
          );
        })
        .catch(() => { if (!cancelled) setMyTickets([]); });
    };

    loadMyTickets();
    socket.on("raffle_updated", loadMyTickets);
    socket.on("sync_required", loadMyTickets);
    return () => {
      cancelled = true;
      socket.off("raffle_updated", loadMyTickets);
      socket.off("sync_required", loadMyTickets);
    };
  }, [raffle, t, user]);

  const drawTime = raffle?.drawAt ? new Date(raffle.drawAt).getTime() : 0;
  const isComplete = raffle?.status === "completed" && Boolean(raffle.winningNumber);
  const isMixing = !isComplete && drawTime > 0 && now >= drawTime;
  const timeUntilDraw = drawTime - now;
  const isWithin24Hours = !isComplete && timeUntilDraw > 0 && timeUntilDraw <= DAY_MS;
  const isRolling = isWithin24Hours || isMixing;
  const proximity = isWithin24Hours ? 1 - (timeUntilDraw / DAY_MS) : 1;
  const baseReelDuration = Math.max(0.42, 1.65 - (proximity * 1.2));
  const countdownTarget = drawTime;
  const isFinalTenSeconds = !isComplete && timeUntilDraw > 0 && timeUntilDraw <= 10000;
  const winningDigits = String(raffle?.winningNumber || "").padStart(4, "0").slice(-4).split("");
  const reelDigits = Array.from({ length: 20 }, (_, index) => index % 10);

  useEffect(() => {
    if (!isComplete || !raffle?.id || !myTickets.length || viewedResults.current.has(raffle.id)) return;
    viewedResults.current.add(raffle.id);
    fetch(`${API_BASE_URL}/raffles/${raffle.id}/result-viewed`, {
      method: "POST",
      headers: telegramHeaders(user)
    }).catch(() => viewedResults.current.delete(raffle.id));
  }, [isComplete, myTickets.length, raffle?.id, user]);

  return (
    <TournamentShell>
      {loading && <div className="wc-empty">{t("raffle.ui.loadingRaffles", "Loading item raffles...")}</div>}
      {!loading && error && <div className="wc-empty">{error}</div>}
      {!loading && !error && !raffle && <div className="raffle-empty-state"><img src="/brand/mgnot-mark.png" alt="" /><strong>{t("raffle.ui.noDrawToday", "No draw for today")}</strong></div>}

      {raffle && <article className="draw-card">
        <div className="draw-card-heading">
          <ResponsiveImage path={raffle.coverImageUrl} alt="" sizes="96px" priority />
          <div><span>{isComplete ? t("raffle.ui.drawResult", "Draw result") : t("raffle.ui.drawingFor", "Drawing for")}</span><h2>{raffle.itemName}</h2><time dateTime={raffle.drawAt || raffle.drawnAt}>{new Date(raffle.drawAt || raffle.drawnAt).toLocaleString()}</time></div>
          <div className={`draw-card-countdown ${isFinalTenSeconds ? "final-ten" : ""}`}>
            <span>{isComplete ? t("raffle.ui.completed", "Completed") : isMixing ? t("raffle.ui.drawingIn", "Drawing in") : t("raffle.ui.startsIn", "Starts in")}</span>
            <strong>{isComplete ? `#${raffle.winningNumber}` : formatCountdown(countdownTarget - now)}</strong>
          </div>
        </div>
        <div className="draw-taken-heading"><strong>{isComplete ? t("raffle.ui.winningNumber", "Winning number") : t("raffle.ui.liveDraw", "Live draw")}</strong><span>{taken.length} / {raffle.ticketLimit} {t("raffle.ui.taken", "taken")}</span></div>
        <div className={`draw-digit-stage ${isRolling ? "mixing" : ""} ${isComplete ? "complete" : "waiting"}`}>
          <div className="draw-digit-boxes" aria-label={isComplete ? `${t("raffle.ui.winningNumber", "Winning number")} ${raffle.winningNumber}` : t("raffle.ui.drawInProgress", "Draw in progress")}>
            {[0, 1, 2, 3].map((position) => (
              <span className="draw-digit-box" key={position}>
                {isRolling ? (
                  <i style={{ "--reel-duration": `${baseReelDuration + position * 0.07}s`, "--reel-delay": `${position * -0.14}s` }}>
                    {reelDigits.map((digit, index) => <b key={`${position}-${index}`}>{digit}</b>)}
                  </i>
                ) : (
                  <strong>{isComplete ? winningDigits[position] : "–"}</strong>
                )}
              </span>
            ))}
          </div>
          <p>
            {isComplete
              ? t("raffle.ui.winnerSelected", "Winning ticket selected")
              : isMixing
                ? t("raffle.ui.mixingTickets", "Selecting the winning ticket…")
                : isWithin24Hours
                  ? t("raffle.ui.drawApproaching", "The reels speed up as the draw gets closer.")
                  : t("raffle.ui.waitingForDraw", "The digit reels start during the final 24 hours.")}
          </p>
        </div>

        <section className="draw-owned-tickets">
          <div className="draw-owned-heading">
            <div><span>{t("raffle.ui.yourEntries", "Your entries")}</span><strong>{t("raffle.ui.yourTicketNumbers", "Ticket numbers you bought")}</strong></div>
            <b>{myTickets.length}</b>
          </div>
          {myTickets.length ? (
            <div className="draw-owned-list">
              {myTickets.map((ticket) => (
                <div className={Number(ticket.ticketNumber) === Number(raffle.winningNumber) ? "winner" : ""} key={ticket.id}>
                  <span>{ticket.status === "assigned" ? `#${String(ticket.ticketNumber).padStart(4, "0")}` : "— — — —"}</span>
                  <small>{ticket.status === "assigned" ? t("raffle.ui.confirmedEntry", "Confirmed entry") : t("raffle.ui.numberPending", "Number pending")}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="draw-owned-empty">{t("raffle.ui.noTicketsForDraw", "You have no tickets in this draw.")}</p>
          )}
        </section>
      </article>}
    </TournamentShell>
  );
}

export default DrawPage;
