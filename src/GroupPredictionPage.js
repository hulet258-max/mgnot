import React, { useEffect, useState } from "react";
import TournamentShell from "./TournamentShell";
import { API_BASE_URL, mediaUrl, readJson } from "./raffleApi";
import { socket } from "./socket";

function GroupPredictionPage() {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = async () => {
      try {
        const data = await readJson(await fetch(`${API_BASE_URL}/raffle-winners`), "Failed to load winners.");
        setWinners(data.winners || []);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    socket.on("raffle_updated", load);
    return () => socket.off("raffle_updated", load);
  }, []);
  return (
    <TournamentShell eyebrow="Completed draws" title="Past winners" subtitle="Celebrate previous winners and verify the ticket number selected for each item.">
      {loading && <div className="wc-empty">Loading past winners...</div>}
      {error && <div className="wc-empty">{error}</div>}
      {!loading && !error && !winners.length && <div className="wc-empty">No completed raffle draws yet.</div>}
      <div className="winner-grid">{winners.map((raffle) => <article className="winner-card" key={raffle.id}><div className="winner-image"><img src={mediaUrl(raffle.coverImageUrl)} alt={raffle.itemName} /><span>Completed</span></div><div className="winner-copy"><p className="wc-eyebrow">Winning item</p><h2>{raffle.itemName}</h2><div className="winning-number"><span>Winning ticket</span><strong>#{raffle.winningNumber}</strong></div><div className="winner-person"><div>{raffle.winner?.photo ? <img src={raffle.winner.photo} alt="" /> : <span>{String(raffle.winner?.displayName || "W").slice(0, 1)}</span>}</div><p><small>Winner</small><strong>{raffle.winner?.displayName || "Winner"}</strong>{raffle.winner?.username && <b>@{raffle.winner.username}</b>}</p></div><time dateTime={raffle.drawnAt}>Drawn {new Date(raffle.drawnAt).toLocaleDateString()}</time></div></article>)}</div>
    </TournamentShell>
  );
}

export default GroupPredictionPage;
