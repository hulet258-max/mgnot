import React, { useEffect, useMemo, useState } from "react";
import TournamentShell from "./TournamentShell";
import { useLanguage } from "./contexts/LanguageContext";
import { useRaffles } from "./useRaffles";
import { API_BASE_URL, mediaUrl, readJson } from "./raffleApi";
import { socket } from "./socket";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIX_MS = 10 * 60 * 1000;

function formatCountdown(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function DrawPage() {
  const { t } = useLanguage();
  const { raffles, loading, error, reload } = useRaffles();
  const [now, setNow] = useState(Date.now());
  const [taken, setTaken] = useState([]);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(reload, 15000);
    return () => { clearInterval(clock); clearInterval(poll); };
  }, [reload]);

  const raffle = useMemo(() => {
    const scheduled = raffles
      .filter((entry) => {
        const drawTime = new Date(entry.drawAt || 0).getTime();
        return entry.drawAt && ["open", "sold_out"].includes(entry.status) && drawTime - now <= DAY_MS && drawTime + MIX_MS >= now;
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

  const drawTime = raffle?.drawAt ? new Date(raffle.drawAt).getTime() : 0;
  const isComplete = raffle?.status === "completed" && Boolean(raffle.winningNumber);
  const isMixing = !isComplete && drawTime > 0 && now >= drawTime;
  const countdownTarget = isMixing ? drawTime + MIX_MS : drawTime;
  const displayedNumbers = isComplete && raffle.winningNumber && !taken.includes(raffle.winningNumber)
    ? [...taken, raffle.winningNumber]
    : taken;

  return (
    <TournamentShell>
      {loading && <div className="wc-empty">{t("raffle.ui.loadingRaffles", "Loading item raffles...")}</div>}
      {!loading && error && <div className="wc-empty">{error}</div>}
      {!loading && !error && !raffle && <div className="raffle-empty-state"><img src="/brand/mgnot-mark.png" alt="" /><strong>{t("raffle.ui.noDrawToday", "No draw for today")}</strong></div>}

      {raffle && <article className="draw-card">
        <div className="draw-card-heading">
          <img src={mediaUrl(raffle.coverImageUrl)} alt="" />
          <div><span>{isComplete ? t("raffle.ui.drawResult", "Draw result") : t("raffle.ui.drawingFor", "Drawing for")}</span><h2>{raffle.itemName}</h2><time dateTime={raffle.drawAt || raffle.drawnAt}>{new Date(raffle.drawAt || raffle.drawnAt).toLocaleString()}</time></div>
          <div className="draw-card-countdown">
            <span>{isComplete ? t("raffle.ui.completed", "Completed") : isMixing ? t("raffle.ui.drawingIn", "Drawing in") : t("raffle.ui.startsIn", "Starts in")}</span>
            <strong>{isComplete ? `#${raffle.winningNumber}` : formatCountdown(countdownTarget - now)}</strong>
          </div>
        </div>
        <div className="draw-taken-heading"><strong>{isComplete ? t("raffle.ui.winningNumber", "Winning number") : t("raffle.ui.takenNumbers", "Taken numbers")}</strong><span>{taken.length} / {raffle.ticketLimit}</span></div>
        {displayedNumbers.length ? <div className={`draw-number-stage ${isMixing ? "mixing" : ""} ${isComplete ? "complete" : "waiting"}`} aria-label={t("raffle.ui.takenNumbers", "Taken numbers")}>
          {displayedNumbers.map((number, index) => <span className={isComplete && number === raffle.winningNumber ? "winner-ball" : ""} key={number} style={{ "--draw-delay": `${-(index % 12) * 0.09}s`, "--ball-x": `${((index * 7) % 29) - 14}px`, "--ball-y": `${((index * 11) % 25) - 12}px` }}>#{number}{isComplete && number === raffle.winningNumber && <small>{t("raffle.ui.winner", "Winner")}</small>}</span>)}
        </div> : <div className="draw-no-numbers">{t("raffle.ui.noTakenNumbers", "No numbers have been taken yet.")}</div>}
      </article>}
    </TournamentShell>
  );
}

export default DrawPage;
