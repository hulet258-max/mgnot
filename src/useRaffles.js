import { useCallback, useEffect, useState } from "react";
import { socket } from "./socket";
import { API_BASE_URL, readJson } from "./raffleApi";

export function useRaffles() {
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      const data = await readJson(await fetch(`${API_BASE_URL}/raffles`), "Failed to load raffles.");
      setRaffles(data.raffles || []);
    } catch (err) {
      setError(err.message || "Failed to load raffles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();

    const onRaffleUpdated = (payload = {}) => {
      if (payload?.raffle?.id) {
        setRaffles((current) => {
          const index = current.findIndex((entry) => entry.id === payload.raffle.id);
          if (index === -1) return [...current, payload.raffle];
          const next = current.slice();
          next[index] = { ...next[index], ...payload.raffle };
          return next;
        });
      }
      // Always reconcile from API so create/delete/list changes stay accurate.
      reload();
    };

    socket.on("raffle_updated", onRaffleUpdated);
    socket.on("sync_required", reload);
    return () => {
      socket.off("raffle_updated", onRaffleUpdated);
      socket.off("sync_required", reload);
    };
  }, [reload]);

  return { raffles, loading, error, reload };
}
