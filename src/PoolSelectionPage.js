import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TournamentShell from "./TournamentShell";
import { useUser } from "./contexts/UserContext";
import { useTournamentState } from "./useTournamentState";
import { useLanguage } from "./contexts/LanguageContext";
import { socket } from "./socket";
import "./PredictionPages.css";

function PoolSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedPoolId, selectPool } = useTournamentState();
  const { user } = useUser();
  const { t, formatCurrency } = useLanguage();
  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joiningPoolId, setJoiningPoolId] = useState(null);
  const [expandedPoolId, setExpandedPoolId] = useState(null);
  const [activePoolId, setActivePoolId] = useState(null);
  const [joinedPoolIds, setJoinedPoolIds] = useState([]);
  const [paymentPool, setPaymentPool] = useState(null);
  const [paymentMode, setPaymentMode] = useState("text");
  const [receiptMessage, setReceiptMessage] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const poolFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("pool");
  }, [location.search]);

  const loadPools = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/pools`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || t("poolSelection.failedLoad", "Failed to load pools."));
      }

      setPools(data.pools || []);
    } catch (err) {
      setError(err.message || t("poolSelection.failedLoad", "Failed to load pools."));
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, t]);

  useEffect(() => {
    loadPools();
    socket.on("pool_updated", loadPools);
    socket.on("sync_required", loadPools);
    window.addEventListener("tournament:pool-updated", loadPools);
    return () => {
      socket.off("pool_updated", loadPools);
      socket.off("sync_required", loadPools);
      window.removeEventListener("tournament:pool-updated", loadPools);
    };
  }, [loadPools]);

  useEffect(() => {
    if (!user?.telegramId) return;
    let cancelled = false;

    const loadUserPool = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/user-pool?userId=${encodeURIComponent(user.telegramId)}`);
        const data = await response.json();
        if (!response.ok || !data.success) return;

        if (!cancelled) {
          const nextJoinedPoolIds = data.joinedPoolIds || (data.poolId ? [data.poolId] : []);
          setJoinedPoolIds(nextJoinedPoolIds);
        }

        if (!cancelled && data.poolId) {
          setActivePoolId(data.poolId);
          if (selectedPoolId !== data.poolId) {
            selectPool(data.poolId);
          }
        }
      } catch (err) {
        console.warn("Failed to check user pool:", err);
      }
    };

    loadUserPool();

    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, selectPool, selectedPoolId, user?.telegramId]);

  useEffect(() => {
    if (!screenshotFile) {
      setScreenshotPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(screenshotFile);
    setScreenshotPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [screenshotFile]);

  useEffect(() => {
    if (pools.length === 0) return;
    if (poolFromQuery && pools.some((pool) => pool.id === poolFromQuery)) {
      setExpandedPoolId(poolFromQuery);
      return;
    }
    if (!expandedPoolId) {
      setExpandedPoolId(selectedPoolId || pools[0].id);
    }
  }, [expandedPoolId, poolFromQuery, pools, selectedPoolId]);

  const openPaymentPopup = (pool) => {
    if (!user?.telegramId) {
      setError(t("poolSelection.connectTelegram", "Connect Telegram before joining a pool."));
      return;
    }

    if (joinedPoolIds.includes(pool.id)) {
      setActivePoolId(pool.id);
      selectPool(pool.id);
      navigate("/group-predictions");
      return;
    }

    setPaymentPool(pool);
    setPaymentMode("text");
    setReceiptMessage("");
    setScreenshotFile(null);
    setPaymentError("");
    setError("");
  };

  const extractFromScreenshot = async () => {
    const formData = new FormData();
    formData.append("screenshot", screenshotFile);

    const response = await fetch(`${API_BASE_URL}/ocr-screenshot`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || t("poolSelection.screenshotReadFailed", "Could not read screenshot."));
    }

    return data.transactionId;
  };

  const handleValidatePayment = async () => {
    if (!paymentPool || !user?.telegramId) return;
    if (paymentMode === "text" && !receiptMessage.trim()) {
      setPaymentError(t("poolSelection.pasteReceiptFirst", "Paste the Telebirr message or receipt link first."));
      return;
    }
    if (paymentMode === "screenshot" && !screenshotFile) {
      setPaymentError(t("poolSelection.uploadScreenshotFirst", "Upload a Telebirr screenshot first."));
      return;
    }

    setJoiningPoolId(paymentPool.id);
    setPaymentError("");

    try {
      const receiptTextOrLink = paymentMode === "screenshot"
        ? await extractFromScreenshot()
        : receiptMessage.trim();

      const response = await fetch(`${API_BASE_URL}/pools/${paymentPool.id}/join-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.telegramId,
          receiptTextOrLink,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || t("poolSelection.failedJoin", "Failed to join pool."));
      }

      setActivePoolId(paymentPool.id);
      setJoinedPoolIds((current) => Array.from(new Set([...current, paymentPool.id])));
      selectPool(paymentPool.id);
      await loadPools();
      window.dispatchEvent(new CustomEvent("tournament:pool-updated", {
        detail: { poolId: paymentPool.id, userId: user.telegramId },
      }));
      setPaymentPool(null);
      navigate("/group-predictions");
    } catch (err) {
      setPaymentError(err.message || t("poolSelection.failedJoin", "Failed to join pool."));
    } finally {
      setJoiningPoolId(null);
    }
  };

  return (
    <TournamentShell
      eyebrow={t("poolSelection.eyebrow", "Pool selection")}
      title={t("poolSelection.title", "Choose Your Competition Pool")}
      subtitle={t(
        "poolSelection.subtitle",
        "Compare entry amounts, prize totals, participation, and rules before joining the group-stage competition."
      )}
    >
      <div className="pool-list">
        {loading && <div className="wc-empty">{t("poolSelection.loading", "Loading pools...")}</div>}
        {!loading && error && <div className="wc-empty">{error}</div>}
        {!loading && !error && pools.length === 0 && (
          <div className="wc-empty">{t("poolSelection.noPools", "No pools available yet.")}</div>
        )}
        {pools.map((pool) => {
          const capacity = Number(pool.capacity || 0);
          const fill = capacity ? Math.round((pool.participants / capacity) * 100) : 0;
          const expanded = expandedPoolId === pool.id;
          const joined = joinedPoolIds.includes(pool.id) || (activePoolId || selectedPoolId) === pool.id;

          return (
            <article className={joined ? "pool-card joined" : "pool-card"} key={pool.id}>
              <button
                className="pool-card-main"
                type="button"
                onClick={() => {
                  setExpandedPoolId(expanded ? null : pool.id);
                  if (!joined) openPaymentPopup(pool);
                }}
                aria-expanded={expanded}
              >
                <div>
                  <span className="wc-pill">{t(`common.${String(pool.status || "open").toLowerCase()}`, pool.status)}</span>
                  <h2>{t("poolSelection.poolTitle", "{{amount}} Birr Pool", { amount: Number(pool.amount || 0).toLocaleString() })}</h2>
                  <p>{t("poolSelection.currentParticipants", "{{count}} current participants", { count: pool.participants })}</p>
                </div>

                <div className="pool-prize">
                  <span>{t("poolSelection.totalPrize", "Total Prize")}</span>
                  <strong>{formatCurrency(pool.prize)}</strong>
                </div>
              </button>

              <div className="pool-meter-row">
                <div>
                  <strong>{t("poolSelection.percentFull", "{{count}}% full", { count: fill })}</strong>
                  <span>{t("poolSelection.spotsRemaining", "{{count}} spots remaining", { count: pool.capacity - pool.participants })}</span>
                </div>
                <div className="wc-progress" aria-label={`${fill}% full`}>
                  <span style={{ width: `${fill}%` }} />
                </div>
              </div>

              {expanded && (
                <div className="pool-details">
                  <div>
                    <h3>{t("poolSelection.poolRules", "Pool Rules")}</h3>
                    <ul>
                      {pool.rules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="pool-detail-grid">
                    <div>
                      <span>{t("poolSelection.tournamentProgression", "Tournament Progression")}</span>
                      <p>{pool.progression}</p>
                    </div>
                    <div>
                      <span>{t("poolSelection.pointSystem", "Point System")}</span>
                      <p>{pool.points}</p>
                    </div>
                    <div>
                      <span>{t("poolSelection.rewardStructure", "Reward Structure")}</span>
                      <p>{pool.rewards}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                className="wc-button pool-join-button"
                type="button"
                disabled={joiningPoolId === pool.id}
                onClick={() => openPaymentPopup(pool)}
              >
                {joiningPoolId === pool.id
                  ? t("poolSelection.joining", "Joining...")
                  : joined
                    ? t("poolSelection.continue", "Continue With This Pool")
                    : t("poolSelection.join", "Join Pool")}
              </button>
            </article>
          );
        })}
      </div>

      {paymentPool && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pool-payment-title">
          <div className="confirm-modal pool-payment-modal">
            <h2 id="pool-payment-title">
              {t("poolSelection.payTitle", "Pay {{amount}} Birr in Telebirr", { amount: Number(paymentPool.amount || 0).toLocaleString() })}
            </h2>
            <p>
              {t("poolSelection.payBody", "Send exactly {{amount}} Birr for the {{amount}} Birr pool, then paste the Telebirr message/link or upload a screenshot.", {
                amount: Number(paymentPool.amount || 0).toLocaleString(),
              })}
            </p>

            <div className="pool-payment-modes">
              <button
                className={paymentMode === "text" ? "wc-button" : "wc-button secondary"}
                type="button"
                onClick={() => setPaymentMode("text")}
              >
                {t("poolSelection.message", "Message")}
              </button>
              <button
                className={paymentMode === "screenshot" ? "wc-button" : "wc-button secondary"}
                type="button"
                onClick={() => setPaymentMode("screenshot")}
              >
                {t("poolSelection.screenshot", "Screenshot")}
              </button>
            </div>

            {paymentMode === "text" ? (
              <textarea
                className="pool-payment-textarea"
                value={receiptMessage}
                onChange={(event) => setReceiptMessage(event.target.value)}
                placeholder={t("poolSelection.receiptPlaceholder", "Paste the Telebirr sent message or receipt link...")}
              />
            ) : (
              <div className="pool-payment-upload">
                <input
                  id="poolPaymentScreenshot"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setScreenshotFile(event.target.files?.[0] || null)}
                />
                {screenshotFile && <strong>{screenshotFile.name}</strong>}
                {screenshotPreviewUrl && <img src={screenshotPreviewUrl} alt={t("poolSelection.screenshotPreviewAlt", "Telebirr payment screenshot preview")} />}
              </div>
            )}

            {paymentError && <div className="wc-empty">{paymentError}</div>}

            <div className="modal-actions">
              <button className="wc-button secondary" type="button" onClick={() => setPaymentPool(null)}>
                {t("common.cancel", "Cancel")}
              </button>
              <button
                className="wc-button"
                type="button"
                disabled={joiningPoolId === paymentPool.id}
                onClick={handleValidatePayment}
              >
                {joiningPoolId === paymentPool.id
                  ? t("common.validating", "Validating...")
                  : t("poolSelection.validatePayment", "Validate Payment")}
              </button>
            </div>
          </div>
        </div>
      )}
    </TournamentShell>
  );
}

export default PoolSelectionPage;
