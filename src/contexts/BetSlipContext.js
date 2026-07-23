import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const BetSlipContext = createContext(null);

export function BetSlipProvider({ children }) {
  const [bets, setBets] = useState({});
  const [expanded, setExpanded] = useState(false);

  const addBet = useCallback((match, prediction) => {
    setBets((current) => ({
      ...current,
      [match.id]: {
        match,
        prediction: {
          ...prediction,
          matchId: match.id,
        },
      },
    }));
    setExpanded(false);
  }, []);

  const removeBet = useCallback((matchId) => {
    setBets((current) => {
      const next = { ...current };
      delete next[matchId];
      return next;
    });
  }, []);

  const clearBets = useCallback(() => {
    setBets({});
    setExpanded(false);
  }, []);

  const value = useMemo(
    () => ({
      bets: Object.values(bets),
      betCount: Object.keys(bets).length,
      expanded,
      setExpanded,
      addBet,
      removeBet,
      clearBets,
    }),
    [addBet, bets, clearBets, expanded, removeBet]
  );

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);
  if (!context) {
    throw new Error("useBetSlip must be used within a BetSlipProvider");
  }
  return context;
}
