import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "./socket"; // 🔌 Import your socket instance here!

function JoinConfirmation({ room, user, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const API_BASE_URL = process.env.REACT_APP_API_URL;

  if (!room || !user) return null;

  const canJoin = (user.balance || 0) >= room.entryFee;

  const handleConfirm = async () => {
    if (!canJoin) return;

    setLoading(true);
    setErrorMsg("");

    // ✨ Added socketId to the payload
    const payload = {
      roomId: room.id,
      userId: user.telegramId,
      socketId: socket.id 
    };

    console.log("🚀 Join request payload:", payload);

    try {
      const res = await fetch(`${API_BASE_URL}/join-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log("📡 Response status:", res.status);

      let data;

      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error("❌ Failed to parse JSON:", jsonErr);
        throw new Error("Invalid server response (not JSON)");
      }

      console.log("📦 Response data:", data);

      if (!res.ok) {
        const msg = data?.error || `HTTP error ${res.status}`;
        throw new Error(msg);
      }

      if (data.success) {
        console.log("✅ Join success");

        navigate(`/game/${room.id}`, {
          state: {
            room: data.room,
            players: data.players,
            redisData: data.redisData
          }
        });

      } else {
        throw new Error(data.error || "Join failed");
      }

    } catch (err) {
      console.error("❌ Join room error:", err);
      setErrorMsg(err.message || "Unknown error occurred");
    }

    setLoading(false);
  };

  const styles = {
    overlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(3px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 100,
      padding: "15px",
      boxSizing: "border-box",
    },
    popupContent: {
      background: "rgba(10, 30, 18, 0.95)",
      borderRadius: "12px",
      padding: "20px",
      width: "100%",
      maxWidth: "320px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(245, 238, 194, 0.3)",
      color: "#f5eec2",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      boxSizing: "border-box",
    },
    header: {
      textAlign: "center",
      marginBottom: "15px",
    },
    title: {
      margin: 0,
      fontSize: "1.2rem",
      color: "#f1c40f",
      textShadow: "1px 1px 0px #8e44ad, 0 0 5px rgba(241, 196, 15, 0.3)",
    },
    detailsBox: {
      background: "rgba(0, 0, 0, 0.4)",
      border: "1px solid rgba(245, 238, 194, 0.15)",
      borderRadius: "8px",
      padding: "15px",
      marginBottom: "20px",
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      margin: "0 0 10px 0",
      fontSize: "0.9rem",
    },
    value: {
      fontWeight: "bold",
      color: "#f1c40f",
    },
    note: {
      margin: "10px 0 0 0",
      fontSize: "0.75rem",
      color: "rgba(245, 238, 194, 0.6)",
      textAlign: "center",
      lineHeight: "1.4",
    },
    errorText: {
      color: "#e74c3c",
      fontWeight: "bold",
      textAlign: "center",
      marginTop: "10px",
      fontSize: "0.85rem",
    },
    footer: {
      display: "flex",
      gap: "10px",
      justifyContent: "space-between",
    },
    cancelBtn: {
      flex: 1,
      background: "rgba(255, 255, 255, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "8px",
      padding: "10px",
      color: "#fff",
      fontSize: "0.85rem",
      cursor: "pointer",
      transition: "background 0.2s",
    },
    confirmBtn: {
      flex: 1,
      background: canJoin ? "linear-gradient(to bottom, #e74c3c, #c0392b)" : "rgba(255, 255, 255, 0.1)",
      border: canJoin ? "1px solid #fff" : "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "8px",
      padding: "10px",
      color: canJoin ? "#fff" : "rgba(255, 255, 255, 0.5)",
      fontWeight: "bold",
      fontSize: "0.85rem",
      cursor: canJoin ? "pointer" : "not-allowed",
      boxShadow: canJoin ? "0 3px 0 #922b21, 0 4px 8px rgba(0,0,0,0.3)" : "none",
      transition: "transform 0.1s",
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.popupContent} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{room.name}ን ይቀላቀሉ</h3>
        </div>

        <div style={styles.detailsBox}>
          <p style={styles.row}>
            <span>የመግቢያ ክፍያ:</span> 
            <span style={styles.value}>{room.entryFee} Birr</span>
          </p>
          <p style={styles.row}>
            <span>የእርስዎ ቀሪ ሂሳብ:</span> 
            <span style={styles.value}>{user.balance || 0} Birr</span>
          </p>

          <p style={styles.note}>
            ማስታወሻ፡ ይህን ክፍል ሲቀላቀሉ {room.entryFee} Birr ከሂሳብዎ ላይ ይቀነሳል።
          </p>

          {!canJoin && (
            <div style={styles.errorText}>በቂ ቀሪ ሂሳብ የለም!</div>
          )}

          {errorMsg && (
            <div style={styles.errorText}>
              {errorMsg}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button
            style={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
          >
            ሰርዝ
          </button>

          <button
            style={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!canJoin || loading}
            onMouseDown={(e) => {
              if (!canJoin) return;
              e.currentTarget.style.transform = "translateY(2px)";
              e.currentTarget.style.boxShadow = "0 1px 0 #922b21, 0 2px 4px rgba(0,0,0,0.3)";
            }}
            onMouseUp={(e) => {
              if (!canJoin) return;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 3px 0 #922b21, 0 4px 8px rgba(0,0,0,0.3)";
            }}
            onMouseLeave={(e) => {
              if (!canJoin) return;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 3px 0 #922b21, 0 4px 8px rgba(0,0,0,0.3)";
            }}
          >
            {loading ? "በመስራት..." : "አረጋግጥ እና ግባ"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinConfirmation;
