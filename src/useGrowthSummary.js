import { useEffect, useState } from "react";
import { useUser } from "./contexts/UserContext";

const emptySummary = {
  activePoolId: null,
  joinedPoolIds: [],
  joinedPoolCount: 0,
  lockedGroupCount: 0,
  totalGroups: 0,
  groupCompletion: 0,
  openMatchCount: 0,
  savedOpenMatchCount: 0,
  nextLockTime: null,
  currentRank: null,
  points: 0,
  pointsBehindNext: 0,
  actions: [],
};

export function useGrowthSummary() {
  const { user } = useUser();
  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.telegramId) {
      setSummary(emptySummary);
      return undefined;
    }

    let cancelled = false;

    const loadSummary = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/user-growth-summary?userId=${encodeURIComponent(user.telegramId)}`);
        const data = await response.json();
        if (!response.ok || !data.success) return;
        if (!cancelled) {
          setSummary({ ...emptySummary, ...(data.summary || {}) });
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(emptySummary);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, user?.telegramId]);

  return { summary, loading };
}
