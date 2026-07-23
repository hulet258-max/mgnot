import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import { useLanguage } from "./contexts/LanguageContext";

function WithdrawPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { t, formatCurrency } = useLanguage();

  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const minWithdraw = 1;
  const maxWithdraw = balance;
  const telegramId = user?.telegramId || user?.id;

  useEffect(() => {
    if (user?.balance !== undefined) {
      setBalance(Number(user.balance) || 0);
    }
  }, [user]);

  useEffect(() => {
    if (!telegramId) return;

    fetch(`${API_BASE_URL}/telegram-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ telegramId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setBalance(Number(data.user?.balance || 0));
        }
      })
      .catch((error) => {
        console.error("Failed to refresh balance:", error);
      });
  }, [API_BASE_URL, telegramId]);

  const handleWithdraw = async (event) => {
    event.preventDefault();
    setResult(null);

    if (!telegramId) {
      setResult({ type: "error", text: t("withdraw.errorUser", "User not found. Please open from Telegram app.") });
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < minWithdraw) {
      setResult({ type: "error", text: t("withdraw.errorMin", "Minimum withdraw amount is {{min}}.", { min: minWithdraw }) });
      return;
    }

    if (parsedAmount > maxWithdraw) {
      setResult({ type: "error", text: t("withdraw.errorMax", "Withdraw amount is greater than your balance.") });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegramId,
          amount: parsedAmount,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || t("withdraw.errorFailed", "Withdraw failed."));
      }

      setBalance(Number(data.newBalance || 0));
      setAmount("");
      setResult({
        type: "success",
        text: data.message || t("withdraw.successDefault", "Withdraw request sent successfully."),
      });
    } catch (error) {
      setResult({
        type: "error",
        text: error.message || t("withdraw.errorRequestFailed", "Failed to send withdraw request."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const styles = {
    page: {
      minHeight: "100vh",
      width: "100vw",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#0f3d1f",
      padding: "18px",
      boxSizing: "border-box",
      color: "#f5eec2",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    card: {
      width: "100%",
      maxWidth: "420px",
      background: "rgba(9, 26, 15, 0.92)",
      border: "1px solid rgba(245, 238, 194, 0.25)",
      borderRadius: "14px",
      padding: "20px",
      boxShadow: "0 12px 28px rgba(0, 0, 0, 0.45)",
      position: "relative",
    },
    title: {
      margin: "0 0 14px 0",
      color: "#f1c40f",
      fontSize: "1.5rem",
    },
    statCard: {
      background: "rgba(255, 255, 255, 0.07)",
      borderRadius: "10px",
      padding: "12px",
      marginBottom: "14px",
      border: "1px solid rgba(255,255,255,0.14)",
    },
    statLabel: {
      fontSize: "0.82rem",
      opacity: 0.85,
      marginBottom: "4px",
      textTransform: "uppercase",
      letterSpacing: "0.6px",
    },
    statValue: {
      fontSize: "1.4rem",
      fontWeight: 700,
      color: "#f1c40f",
      margin: 0,
    },
    infoText: {
      margin: "4px 0",
      fontSize: "0.9rem",
      opacity: 0.92,
    },
    label: {
      display: "block",
      marginBottom: "8px",
      fontSize: "0.85rem",
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      opacity: 0.88,
      marginTop: "14px",
    },
    input: {
      width: "100%",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(255,255,255,0.08)",
      color: "#fff",
      padding: "12px",
      boxSizing: "border-box",
      outline: "none",
      fontSize: "0.95rem",
      marginBottom: "12px",
    },
    actions: {
      display: "flex",
      gap: "10px",
      justifyContent: "space-between",
    },
    button: {
      flex: 1,
      border: "none",
      borderRadius: "8px",
      padding: "10px 12px",
      fontWeight: 700,
      cursor: "pointer",
    },
    backButton: {
      background: "rgba(255,255,255,0.16)",
      color: "#fff",
    },
    submitButton: {
      background: "#ef6c00",
      color: "#fff",
    },
    result: {
      marginTop: "14px",
      padding: "10px",
      borderRadius: "8px",
      fontSize: "0.9rem",
      border: "1px solid transparent",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>{t("withdraw.title", "Withdraw")}</h2>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t("withdraw.balance", "Your Balance")}</div>
          <h3 style={styles.statValue}>{formatCurrency(balance)}</h3>
          <p style={styles.infoText}>{t("withdraw.min", "Minimum withdraw: {{min}} Birr", { min: minWithdraw })}</p>
          <p style={styles.infoText}>{t("withdraw.max", "Maximum withdraw: {{max}} Birr", { max: maxWithdraw })}</p>
        </div>

        <form onSubmit={handleWithdraw}>
          <label style={styles.label}>{t("withdraw.label", "Withdraw amount")}</label>
          <input
            type="number"
            min={minWithdraw}
            max={maxWithdraw}
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={t("withdraw.placeholder", "Enter amount to withdraw")}
            style={styles.input}
            disabled={submitting}
          />

          <div style={styles.actions}>
            <button
              type="button"
              style={{ ...styles.button, ...styles.backButton }}
              onClick={() => navigate("/")}
              disabled={submitting}
            >
              {t("common.back", "Back")}
            </button>
            <button
              type="submit"
              style={{ ...styles.button, ...styles.submitButton }}
              disabled={submitting}
            >
              {submitting ? t("withdraw.sending", "Sending...") : t("withdraw.submit", "Withdraw")}
            </button>
          </div>
        </form>

        {result && (
          <div
            style={{
              ...styles.result,
              background: result.type === "success" ? "rgba(46, 125, 50, 0.3)" : "rgba(198, 40, 40, 0.3)",
              borderColor: result.type === "success" ? "rgba(129, 199, 132, 0.6)" : "rgba(239, 154, 154, 0.6)",
            }}
          >
            {result.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default WithdrawPage;
