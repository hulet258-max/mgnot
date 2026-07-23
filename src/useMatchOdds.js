import { useEffect, useState } from "react";

export function useMatchOdds() {
  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const [oddsByMatch, setOddsByMatch] = useState({});

  useEffect(() => {
    let cancelled = false;

    const loadOdds = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/match-odds?refresh=true`);
        const data = await response.json();

        if (!response.ok || !data.success) return;
        if (!cancelled) {
          setOddsByMatch(data.odds || {});
        }
      } catch (error) {
        if (!cancelled) {
          setOddsByMatch({});
        }
      }
    };

    loadOdds();
    const intervalId = setInterval(loadOdds, 60 * 1000);
    window.addEventListener("tournament:match-predictions-saved", loadOdds);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("tournament:match-predictions-saved", loadOdds);
    };
  }, [API_BASE_URL]);

  return oddsByMatch;
}
