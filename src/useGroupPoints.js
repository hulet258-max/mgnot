import { useEffect, useState } from "react";

export function useGroupPoints() {
  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const [groupPoints, setGroupPoints] = useState({});

  useEffect(() => {
    let cancelled = false;

    const loadGroupPoints = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/group-points?refresh=true`);
        const data = await response.json();
        if (!response.ok || !data.success) return;

        if (!cancelled) {
          setGroupPoints(data.points || {});
        }
      } catch (error) {
        if (!cancelled) {
          setGroupPoints({});
        }
      }
    };

    loadGroupPoints();
    const intervalId = setInterval(loadGroupPoints, 60 * 1000);
    window.addEventListener("tournament:group-predictions-saved", loadGroupPoints);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("tournament:group-predictions-saved", loadGroupPoints);
    };
  }, [API_BASE_URL]);

  return groupPoints;
}
