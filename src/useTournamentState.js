import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "./contexts/UserContext";
import { useTournamentData } from "./useTournamentData";
import { socket } from "./socket";

const createInitialGroupPredictions = (groups) => {
  return groups.reduce((acc, group) => {
    acc[group.id] = [...group.teams]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((team) => team.id);
    return acc;
  }, {});
};

const createInitialState = (groups = []) => ({
  selectedPoolId: null,
  joinedPoolIds: [],
  poolPredictions: {},
  groupPredictions: createInitialGroupPredictions(groups),
  groupPredictionsLocked: false,
  lockedGroupIds: [],
  savedGroupIds: [],
  matchPredictions: {},
  savedAt: null,
});

const normalizeLockedGroupIds = (predictionDoc = {}, groups = []) => {
  if (predictionDoc.groupPredictionsLocked) {
    return groups.map((group) => group.id);
  }
  return Array.isArray(predictionDoc.lockedGroupIds) ? predictionDoc.lockedGroupIds : [];
};

const normalizeSavedGroupIds = (predictionDoc = {}, groups = []) => {
  const savedGroupIds = new Set(
    Array.isArray(predictionDoc.savedGroupIds) ? predictionDoc.savedGroupIds : []
  );

  normalizeLockedGroupIds(predictionDoc, groups).forEach((groupId) => savedGroupIds.add(groupId));

  if (!predictionDoc.savedGroupIds && predictionDoc.groupPredictions) {
    Object.keys(predictionDoc.groupPredictions).forEach((groupId) => savedGroupIds.add(groupId));
  }

  return [...savedGroupIds];
};

const normalizePredictionDoc = (predictionDoc = {}, groups = []) => ({
  ...predictionDoc,
  lockedGroupIds: normalizeLockedGroupIds(predictionDoc, groups),
  savedGroupIds: normalizeSavedGroupIds(predictionDoc, groups),
});

export const useTournamentState = () => {
  const { user } = useUser();
  const { groups } = useTournamentData();
  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const userId = user?.telegramId || user?.id || null;
  const initialState = useMemo(() => createInitialState(groups), [groups]);
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState((current) => ({
      ...initialState,
      selectedPoolId: current.selectedPoolId,
      joinedPoolIds: current.joinedPoolIds,
      poolPredictions: current.poolPredictions,
      groupPredictions: {
        ...initialState.groupPredictions,
        ...current.groupPredictions,
      },
      groupPredictionsLocked: current.groupPredictionsLocked,
      lockedGroupIds: current.lockedGroupIds,
      savedGroupIds: current.savedGroupIds,
      matchPredictions: current.matchPredictions,
      savedAt: current.savedAt,
    }));
  }, [initialState]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const loadUserPool = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/user-pool?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (!response.ok || !data.success) return;

        if (!cancelled) {
          const joinedPoolIds = data.joinedPoolIds || (data.poolId ? [data.poolId] : []);
          setState((current) => ({
            ...current,
            joinedPoolIds,
            selectedPoolId: current.selectedPoolId || data.poolId || joinedPoolIds[0] || null,
            savedAt: new Date().toISOString(),
          }));
        }
      } catch (error) {
        console.warn("Failed to load user pool:", error);
      }
    };

    loadUserPool();
    socket.on("pool_updated", loadUserPool);
    socket.on("sync_required", loadUserPool);
    window.addEventListener("tournament:pool-updated", loadUserPool);

    return () => {
      cancelled = true;
      socket.off("pool_updated", loadUserPool);
      socket.off("sync_required", loadUserPool);
      window.removeEventListener("tournament:pool-updated", loadUserPool);
    };
  }, [API_BASE_URL, userId]);

  useEffect(() => {
    if (!userId || !state.joinedPoolIds.length) return;
    let cancelled = false;

    const hydrateJoinedPoolPredictions = async () => {
      try {
        const responses = await Promise.all(
          state.joinedPoolIds.map(async (poolId) => {
            const response = await fetch(`${API_BASE_URL}/pools/${poolId}/predictions/${userId}`);
            const data = await response.json();
            return { poolId, response, data };
          })
        );

        if (cancelled) return;

        const poolPredictions = responses.reduce((acc, { poolId, response, data }) => {
          if (response.ok && data.success && data.exists && data.predictions) {
            acc[poolId] = normalizePredictionDoc(data.predictions, groups);
          }
          return acc;
        }, {});

        setState((current) => {
          const selectedPredictions = poolPredictions[current.selectedPoolId] || {};
          return {
            ...current,
            poolPredictions,
            groupPredictions: {
              ...current.groupPredictions,
              ...(selectedPredictions.groupPredictions || {}),
            },
            groupPredictionsLocked: Boolean(selectedPredictions.groupPredictionsLocked),
            lockedGroupIds: selectedPredictions.lockedGroupIds || [],
            savedGroupIds: selectedPredictions.savedGroupIds || [],
            matchPredictions: selectedPredictions.matchPredictions || current.matchPredictions,
            savedAt: new Date().toISOString(),
          };
        });
      } catch (error) {
        console.warn("Failed to hydrate joined pool predictions:", error);
      }
    };

    hydrateJoinedPoolPredictions();

    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, groups, state.joinedPoolIds, userId]);

  useEffect(() => {
    if (!userId || !state.selectedPoolId) return;
    let cancelled = false;

    const hydrateFromRemote = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/pools/${state.selectedPoolId}/predictions/${userId}`
        );
        const data = await response.json();

        if (!response.ok || !data.success || !data.exists || !data.predictions) return;

        if (cancelled) return;
        const normalizedPredictions = normalizePredictionDoc(data.predictions, groups);

        setState((current) => ({
          ...current,
          selectedPoolId: state.selectedPoolId,
          groupPredictions: {
            ...initialState.groupPredictions,
            ...(normalizedPredictions.groupPredictions || {}),
          },
          groupPredictionsLocked: Boolean(normalizedPredictions.groupPredictionsLocked),
          lockedGroupIds: normalizedPredictions.lockedGroupIds || [],
          savedGroupIds: normalizedPredictions.savedGroupIds || [],
          poolPredictions: {
            ...current.poolPredictions,
            [state.selectedPoolId]: {
              ...normalizedPredictions,
            },
          },
          matchPredictions: normalizedPredictions.matchPredictions || current.matchPredictions,
          savedAt: new Date().toISOString(),
        }));
      } catch (error) {
        console.warn("Failed to hydrate predictions:", error);
      }
    };

    hydrateFromRemote();

    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, groups, initialState.groupPredictions, state.selectedPoolId, userId]);

  useEffect(() => {
    const handleSavedMatchPredictions = (event) => {
      const savedPredictions = Array.isArray(event.detail?.savedPredictions)
        ? event.detail.savedPredictions
        : [];
      if (!savedPredictions.length) return;

      const savedAt = new Date().toISOString();
      setState((current) => {
        const nextPoolPredictions = { ...current.poolPredictions };
        let nextMatchPredictions = current.matchPredictions;

        savedPredictions.forEach(({ poolId, matchId, prediction }) => {
          if (!poolId || !matchId || !prediction) return;

          const nextPrediction = {
            ...prediction,
            savedAt,
          };

          nextPoolPredictions[poolId] = {
            ...(nextPoolPredictions[poolId] || {}),
            matchPredictions: {
              ...(nextPoolPredictions[poolId]?.matchPredictions || {}),
              [matchId]: nextPrediction,
            },
          };

          if (poolId === current.selectedPoolId) {
            nextMatchPredictions = {
              ...nextMatchPredictions,
              [matchId]: nextPrediction,
            };
          }
        });

        return {
          ...current,
          poolPredictions: nextPoolPredictions,
          matchPredictions: nextMatchPredictions,
          savedAt,
        };
      });
    };

    window.addEventListener("tournament:match-predictions-saved", handleSavedMatchPredictions);
    return () => {
      window.removeEventListener("tournament:match-predictions-saved", handleSavedMatchPredictions);
    };
  }, []);

  const updateState = useCallback((updater) => {
    setState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return {
        ...next,
        savedAt: new Date().toISOString(),
      };
    });
  }, []);

  const selectPool = useCallback((poolId) => {
    updateState((current) => {
      const selectedPredictions = current.poolPredictions[poolId] || {};
      return {
        ...current,
        selectedPoolId: poolId,
        matchPredictions: selectedPredictions.matchPredictions || {},
        groupPredictions: {
          ...current.groupPredictions,
          ...(selectedPredictions.groupPredictions || {}),
        },
        groupPredictionsLocked: Boolean(selectedPredictions.groupPredictionsLocked),
        lockedGroupIds: selectedPredictions.lockedGroupIds || [],
        savedGroupIds: selectedPredictions.savedGroupIds || [],
      };
    });
  }, [updateState]);

  const setGroupOrder = (groupId, nextOrder) => {
    updateState((current) => {
      const groupLocked = current.groupPredictionsLocked || current.lockedGroupIds.includes(groupId);
      const savedGroupIds = groupLocked
        ? current.savedGroupIds
        : current.savedGroupIds.filter((savedGroupId) => savedGroupId !== groupId);
      const currentPoolPrediction = current.poolPredictions[current.selectedPoolId] || {};

      return {
        ...current,
        savedGroupIds,
        groupPredictions: {
          ...current.groupPredictions,
          [groupId]: nextOrder,
        },
        poolPredictions: current.selectedPoolId
          ? {
              ...current.poolPredictions,
              [current.selectedPoolId]: {
                ...currentPoolPrediction,
                savedGroupIds,
              },
            }
          : current.poolPredictions,
      };
    });
  };

  const saveGroupPrediction = async (groupId) => {
    const poolId = state.selectedPoolId;
    const groupOrder = state.groupPredictions[groupId] || [];

    if (!poolId) {
      throw new Error("Select a pool before saving group predictions.");
    }

    if (userId && poolId) {
      const response = await fetch(`${API_BASE_URL}/pools/${poolId}/group-predictions/${groupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          groupOrder,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save group prediction.");
      }
    }

    updateState((current) => {
      const savedGroupIds = current.savedGroupIds.includes(groupId)
        ? current.savedGroupIds
        : [...current.savedGroupIds, groupId];

      return {
        ...current,
        savedGroupIds,
        poolPredictions: {
          ...current.poolPredictions,
          [poolId]: {
            ...(current.poolPredictions[poolId] || {}),
            groupPredictions: {
              ...(current.poolPredictions[poolId]?.groupPredictions || {}),
              [groupId]: groupOrder,
            },
            lockedGroupIds: current.lockedGroupIds,
            savedGroupIds,
            groupPredictionsLocked: current.groupPredictionsLocked,
          },
        },
      };
    });
    window.dispatchEvent(new CustomEvent("tournament:group-predictions-saved", {
      detail: { poolId, groupId },
    }));
  };

  const lockGroupPrediction = async (groupId) => {
    const poolId = state.selectedPoolId;
    if (!poolId) {
      throw new Error("Select a pool before locking group predictions.");
    }

    await saveGroupPrediction(groupId);

    let lockData = {};
    if (userId && poolId) {
      const response = await fetch(`${API_BASE_URL}/pools/${poolId}/group-predictions/${groupId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      lockData = await response.json().catch(() => ({}));
      if (!response.ok || !lockData.success) {
        throw new Error(lockData.error || "Failed to lock group prediction.");
      }
    }

    updateState((current) => {
      const lockedGroupIds = current.lockedGroupIds.includes(groupId)
        ? current.lockedGroupIds
        : [...current.lockedGroupIds, groupId];
      const savedGroupIds = current.savedGroupIds.includes(groupId)
        ? current.savedGroupIds
        : [...current.savedGroupIds, groupId];
      const groupPossiblePoints = lockData.groupPossiblePoints || current.poolPredictions[poolId]?.groupPossiblePoints || {};
      const totalGroupPossiblePoints = lockData.totalGroupPossiblePoints
        ?? current.poolPredictions[poolId]?.totalGroupPossiblePoints
        ?? 0;
      const allGroupsLocked = groups.length > 0 && groups.every((group) => lockedGroupIds.includes(group.id));

      return {
        ...current,
        lockedGroupIds,
        savedGroupIds,
        groupPredictionsLocked: allGroupsLocked,
        poolPredictions: {
          ...current.poolPredictions,
          [poolId]: {
            ...(current.poolPredictions[poolId] || {}),
            groupPredictions: {
              ...(current.poolPredictions[poolId]?.groupPredictions || {}),
              [groupId]: current.groupPredictions[groupId] || [],
            },
            lockedGroupIds,
            savedGroupIds,
            groupPossiblePoints,
            totalGroupPossiblePoints,
            groupPredictionsLocked: allGroupsLocked,
          },
        },
      };
    });
    window.dispatchEvent(new CustomEvent("tournament:group-predictions-saved", {
      detail: { poolId, groupId, locked: true },
    }));
  };

  const lockGroupPredictions = async () => {
    const poolId = state.selectedPoolId;
    const currentPredictions = state.groupPredictions;

    if (userId && poolId) {
      try {
        await fetch(`${API_BASE_URL}/pools/${poolId}/group-predictions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            groupPredictions: currentPredictions,
          }),
        });

        await fetch(`${API_BASE_URL}/pools/${poolId}/group-predictions/lock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } catch (error) {
        console.warn("Failed to lock group predictions:", error);
      }
    }

    updateState((current) => {
      const lockedGroupIds = groups.map((group) => group.id);
      const savedGroupIds = groups.map((group) => group.id);
      return {
        ...current,
        groupPredictionsLocked: true,
        lockedGroupIds,
        savedGroupIds,
        poolPredictions: {
          ...current.poolPredictions,
          [poolId]: {
            ...(current.poolPredictions[poolId] || {}),
            groupPredictions: current.groupPredictions,
            lockedGroupIds,
            savedGroupIds,
            groupPredictionsLocked: true,
          },
        },
      };
    });
  };

  const saveMatchPrediction = async (matchId, prediction, poolIdOverride = null) => {
    const poolId = poolIdOverride || state.selectedPoolId;
    const savedAt = new Date().toISOString();

    if (userId && poolId) {
      const response = await fetch(`${API_BASE_URL}/pools/${poolId}/match-predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          matchId,
          prediction,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save match prediction.");
      }
      prediction = data.prediction || prediction;
    }

    if (!poolIdOverride || poolIdOverride === state.selectedPoolId) {
      updateState((current) => ({
        ...current,
        poolPredictions: {
          ...current.poolPredictions,
          [poolId]: {
            ...(current.poolPredictions[poolId] || {}),
            matchPredictions: {
              ...(current.poolPredictions[poolId]?.matchPredictions || {}),
              [matchId]: {
                ...prediction,
                savedAt,
              },
            },
          },
        },
        matchPredictions: {
          ...current.matchPredictions,
          [matchId]: {
            ...prediction,
            savedAt,
          },
        },
      }));
    } else {
      updateState((current) => ({
        ...current,
        poolPredictions: {
          ...current.poolPredictions,
          [poolId]: {
            ...(current.poolPredictions[poolId] || {}),
            matchPredictions: {
              ...(current.poolPredictions[poolId]?.matchPredictions || {}),
              [matchId]: {
                ...prediction,
                savedAt,
              },
            },
          },
        },
      }));
    }

    return prediction;
  };

  const completedGroups = groups.filter((group) => (state.lockedGroupIds || []).includes(group.id)).length;

  const groupCompletion = groups.length ? Math.round((completedGroups / groups.length) * 100) : 0;

  return {
    ...state,
    completedGroups,
    groupCompletion,
    remainingGroups: groups.length - completedGroups,
    selectPool,
    setGroupOrder,
    saveGroupPrediction,
    lockGroupPrediction,
    lockGroupPredictions,
    saveMatchPrediction,
  };
};
