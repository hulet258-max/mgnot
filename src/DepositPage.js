import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import { socket } from "./socket";
import { useLanguage } from "./contexts/LanguageContext";
import { PaymentNumberList, usePaymentNumbers } from "./PaymentNumbers";

function DepositPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { t } = useLanguage();
  const [inputMode, setInputMode] = useState("text");
  const [messageOrLink, setMessageOrLink] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState("");
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const { paymentNumbers, loadingPaymentNumbers } = usePaymentNumbers();

  const API_BASE_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    if (!screenshotFile) {
      setScreenshotPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(screenshotFile);
    setScreenshotPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [screenshotFile]);

  const handleScreenshotChange = (event) => {
    const file = event.target.files?.[0] || null;
    setScreenshotFile(file);
  };

  const submitReceiptCheck = async (receiptValue) => {
    const response = await fetch(`${API_BASE_URL}/check-receipt-demo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receiptTextOrLink: String(receiptValue).trim(),
        confirmedByUser: confirmPaid,
        socketId: socket.id,
        userId: user?.telegramId || user?.id,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || t("deposit.errorReceiptFailed", "Receipt check failed."));
    }

    return data;
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
      throw new Error(data.error || t("deposit.errorOcrFailed", "Could not read screenshot."));
    }

    return data.transactionId;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!confirmPaid) {
      setResult({ type: "error", text: t("deposit.errorConfirm", "Please check the confirmation box before submitting.") });
      return;
    }

    if (inputMode === "text" && !messageOrLink.trim()) {
      setResult({ type: "error", text: t("deposit.errorEmptyText", "Please paste your message or receipt link.") });
      return;
    }

    if (inputMode === "screenshot" && !screenshotFile) {
      setResult({ type: "error", text: t("deposit.errorNoScreenshot", "Please upload a screenshot first.") });
      return;
    }

    try {
      setSubmitting(true);
      setResult(null);

      let receiptInput = messageOrLink.trim();

      if (inputMode === "screenshot") {
        receiptInput = await extractFromScreenshot();
        setMessageOrLink(receiptInput);
      }

      const data = await submitReceiptCheck(receiptInput);

      setResult({
        type: "success",
        text:
          data.message ||
          t("deposit.successDefault", "Receipt check complete. Status: {{status}}.", {
            status: data.receiptStatus,
          }),
      });
      setMessageOrLink("");
      setScreenshotFile(null);
      setScreenshotPreviewUrl("");
      setConfirmPaid(false);
    } catch (error) {
      setResult({
        type: "error",
        text: error.message || t("deposit.errorBackend", "Failed to connect to backend API."),
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
      background: "rgba(0,0,0,0.55)",
      border: "1px solid rgba(241, 196, 15, 0.35)",
      borderRadius: "14px",
      padding: "20px",
      boxShadow: "0 8px 18px rgba(0, 0, 0, 0.6)",
      position: "relative",
    },
    title: {
      margin: "0 0 10px 0",
      color: "#f1c40f",
      fontSize: "1.5rem",
    },
    text: {
      margin: "0 0 10px 0",
      fontSize: "0.95rem",
      opacity: 0.92,
      color: "#f5eec2",
      lineHeight: 1.5,
    },
    payNumber: {
      margin: "0 0 16px 0",
      fontWeight: 700,
      letterSpacing: "0.5px",
      color: "#f1c40f",
    },
    label: {
      display: "block",
      marginBottom: "8px",
      fontSize: "0.85rem",
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      opacity: 0.9,
      color: "#f5eec2",
    },
    modeRow: {
      display: "flex",
      gap: "8px",
      marginBottom: "12px",
    },
    modeButton: {
      flex: 1,
      border: "1px solid rgba(255, 255, 255, 0.25)",
      borderRadius: "8px",
      background: "rgba(0, 0, 0, 0.35)",
      color: "#f5eec2",
      padding: "9px 10px",
      fontWeight: 600,
      cursor: "pointer",
    },
    modeButtonActive: {
      borderColor: "#f1c40f",
      background: "rgba(241, 196, 15, 0.15)",
    },
    textarea: {
      width: "100%",
      minHeight: "110px",
      resize: "vertical",
      borderRadius: "10px",
      border: "1px solid rgba(241, 196, 15, 0.45)",
      background: "rgba(0, 0, 0, 0.35)",
      color: "#f5eec2",
      padding: "12px",
      boxSizing: "border-box",
      outline: "none",
      fontSize: "0.95rem",
      marginBottom: "12px",
    },
    screenshotCard: {
      marginBottom: "12px",
      border: "1px dashed rgba(241, 196, 15, 0.45)",
      borderRadius: "12px",
      padding: "14px",
      background: "rgba(0, 0, 0, 0.35)",
    },
    fileInputHidden: {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0,
      padding: 0,
      margin: "-1px",
    },
    screenshotPickerButton: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      border: "1px solid rgba(241, 196, 15, 0.7)",
      borderRadius: "10px",
      background: "rgba(0, 0, 0, 0.4)",
      color: "#f5eec2",
      fontWeight: 700,
      fontSize: "0.92rem",
      cursor: "pointer",
      padding: "11px 12px",
      marginBottom: "10px",
    },
    screenshotHelper: {
      margin: "0 0 8px 0",
      fontSize: "0.82rem",
      opacity: 0.85,
      textAlign: "center",
      color: "#f5eec2",
    },
    fileName: {
      marginBottom: "10px",
      fontSize: "0.82rem",
      opacity: 0.9,
      textAlign: "center",
      wordBreak: "break-word",
    },
    screenshotPreviewWrap: {
      width: "100%",
      borderRadius: "10px",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(0,0,0,0.4)",
    },
    screenshotPreviewImage: {
      width: "100%",
      maxHeight: "260px",
      objectFit: "contain",
      display: "block",
      background: "rgba(0,0,0,0.6)",
    },
    checkboxRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "14px",
      fontSize: "0.9rem",
      color: "#f5eec2",
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
      background: "rgba(0, 0, 0, 0.4)",
      color: "#f5eec2",
      border: "1px solid rgba(255, 255, 255, 0.25)",
    },
    submitButton: {
      background: "#fb8c00",
      color: "#ffffff",
      border: "1px solid rgba(255,255,255,0.35)",
      boxShadow: "0 3px 0 #e65100, 0 6px 12px rgba(0,0,0,0.25)",
    },
    result: {
      marginTop: "14px",
      padding: "10px",
      borderRadius: "8px",
      fontSize: "0.9rem",
      border: "1px solid transparent",
    },
    formFieldset: {
      border: "none",
      padding: 0,
      margin: 0,
      minWidth: 0,
    },
    loadingOverlay: {
      position: "absolute",
      inset: 0,
      borderRadius: "14px",
      background: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
      pointerEvents: "all",
    },
    loadingContent: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "10px",
    },
    loadingSpinner: {
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      border: "3px solid rgba(241, 196, 15, 0.5)",
      borderTopColor: "#f1c40f",
      animation: "spin 0.9s linear infinite",
    },
    loadingText: {
      fontSize: "0.9rem",
      fontWeight: 700,
      color: "#f5eec2",
      letterSpacing: "0.3px",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>{t("deposit.title", "Deposit")}</h2>
        <p style={styles.text}>{t("deposit.payTo", "Pay to one of these numbers:")}</p>
        <PaymentNumberList paymentNumbers={paymentNumbers} loading={loadingPaymentNumbers} />

        <form onSubmit={handleSubmit}>
          <fieldset style={styles.formFieldset} disabled={submitting}>
            <label style={styles.label}>{t("deposit.chooseInput", "Choose receipt input type")}</label>
            <div style={styles.modeRow}>
              <button
                type="button"
                style={{
                  ...styles.modeButton,
                  ...(inputMode === "text" ? styles.modeButtonActive : {}),
                }}
                onClick={() => setInputMode("text")}
                disabled={submitting}
              >
                {t("deposit.modeText", "Paste text/link")}
              </button>
              <button
                type="button"
                style={{
                  ...styles.modeButton,
                  ...(inputMode === "screenshot" ? styles.modeButtonActive : {}),
                }}
                onClick={() => setInputMode("screenshot")}
                disabled={submitting}
              >
                {t("deposit.modeScreenshot", "Upload screenshot")}
              </button>
            </div>

            {inputMode === "text" ? (
              <>
                <label style={styles.label}>{t("deposit.pasteLabel", "Paste the message or receipt link here")}</label>
                <textarea
                  style={styles.textarea}
                  placeholder={t("deposit.pastePlaceholder", "Paste receipt text or transaction link...")}
                  value={messageOrLink}
                  onChange={(e) => setMessageOrLink(e.target.value)}
                />
              </>
            ) : (
              <>
                <label style={styles.label}>{t("deposit.uploadLabel", "Upload payment screenshot")}</label>
                <div style={styles.screenshotCard}>
                  <input
                    id="screenshotUpload"
                    style={styles.fileInputHidden}
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    disabled={submitting}
                  />
                  <label htmlFor="screenshotUpload" style={styles.screenshotPickerButton}>
                    {screenshotFile
                      ? t("deposit.chooseDifferent", "Choose different screenshot")
                      : t("deposit.chooseImage", "Choose screenshot image")}
                  </label>
                  <p style={styles.screenshotHelper}>{t("deposit.fileHint", "PNG, JPG or WEBP up to 5MB")}</p>
                  {screenshotFile && (
                    <div style={styles.fileName}>
                      {t("deposit.selected", "Selected: {{name}}", { name: screenshotFile.name })}
                    </div>
                  )}
                  {screenshotPreviewUrl && (
                    <div style={styles.screenshotPreviewWrap}>
                      <img
                        src={screenshotPreviewUrl}
                        alt="Selected payment screenshot preview"
                        style={styles.screenshotPreviewImage}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={confirmPaid}
                onChange={(e) => setConfirmPaid(e.target.checked)}
              />
              {t("deposit.confirmPaid", "I confirm that I made the payment")}
            </label>

            <div style={styles.actions}>
              <button
                type="button"
                style={{ ...styles.button, ...styles.backButton }}
                onClick={() => navigate("/")}
              >
                {t("common.back", "Back")}
              </button>
              <button
                type="submit"
                style={{ ...styles.button, ...styles.submitButton }}
                disabled={submitting}
              >
                {submitting
                  ? t("deposit.verifying", "Verifying...")
                  : t("deposit.checkReceipt", "Check Receipt")}
              </button>
            </div>
          </fieldset>
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
        {submitting && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingContent}>
              <div style={styles.loadingSpinner} />
              <div style={styles.loadingText}>{t("deposit.verifyingPayment", "Verifying payment...")}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DepositPage;
