import { useEffect, useState } from "react";
import { socket } from "./socket";

const emptyData = {
  tournamentInfo: {},
  groups: [],
  matchDays: [],
  recentActivity: [],
  pools: [],
};

export function useTournamentData() {
  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadTournamentData = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/tournament-data`);
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload?.error || "Failed to load tournament data.");
        }

        if (!cancelled) {
          setData({
            tournamentInfo: payload.tournamentInfo || {},
            groups: payload.groups || [],
            matchDays: payload.matchDays || [],
            recentActivity: payload.recentActivity || [],
            pools: payload.pools || [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load tournament data.");
          setData(emptyData);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTournamentData();
    socket.on("pool_updated", loadTournamentData);
    socket.on("sync_required", loadTournamentData);
    window.addEventListener("tournament:pool-updated", loadTournamentData);

    return () => {
      cancelled = true;
      socket.off("pool_updated", loadTournamentData);
      socket.off("sync_required", loadTournamentData);
      window.removeEventListener("tournament:pool-updated", loadTournamentData);
    };
  }, [API_BASE_URL]);

  return {
    ...data,
    loading,
    error,
  };
}
