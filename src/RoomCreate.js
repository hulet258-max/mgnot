import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import { socket } from "./socket"; // 🔌 Import your socket instance

function RoomCreate({ onClose, onRoomCreated }) {
  const { user } = useUser();
  const navigate = useNavigate();
  const BASE_URL = process.env.REACT_APP_API_URL;
  const [roomName, setRoomName] = useState("");
  const [gameType, setGameType] = useState("2-players");
  const [entryFee, setEntryFee] = useState("5");
  const [visibility, setVisibility] = useState("public");
  const [createdRoomId, setCreatedRoomId] = useState("");
  const [privateGameLink, setPrivateGameLink] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoinRoom = async (roomId) => {
    const joinRes = await fetch(`${BASE_URL}/join-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        userId: user.telegramId,
        socketId: socket.id,
      }),
    });
    const joinData = await joinRes.json();
    if (!joinRes.ok || !joinData.success) {
      throw new Error(joinData.error || "Failed to join room.");
    }
    navigate(`/game/${joinData.room.id}`, {
      state: {
        room: joinData.room,
        players: joinData.players,
        redisData: joinData.redisData,
      },
    });
  };

  const handleCopyLink = async () => {
    if (!privateGameLink) return;
    try {
      await navigator.clipboard.writeText(privateGameLink);
      setCopyMsg("Copied!");
      setTimeout(() => setCopyMsg(""), 1200);
    } catch (err) {
      setError("Could not copy link.");
    }
  };

  const handleCreate = async () => {
    if (!user || !roomName.trim() || !entryFee) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);
    setError("");
    setCopyMsg("");

    try {
      const createRes = await fetch(`${BASE_URL}/create-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: roomName.trim(),
          gameType,
          entryFee,
          visibility,
          creatorId: user.telegramId,
          socketId: socket.id,
        }),
      });
      const createData = await createRes.json();

      if (!createRes.ok || !createData.success) {
        throw new Error(createData.error || "Failed to create room.");
      }

      if (visibility === "public") {
        onRoomCreated(createData.room);
        await handleJoinRoom(createData.room.id);
        return;
      }

      setCreatedRoomId(createData.room.id);
      setPrivateGameLink(`${window.location.origin}/second?roomId=${createData.room.id}`);
    } catch (err) {
      console.error("Error in room creation process:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
      display: "flex",
      flexDirection: "column",
      gap: "15px",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid rgba(245, 238, 194, 0.2)",
      paddingBottom: "10px",
    },
    title: {
      margin: 0,
      fontSize: "1.2rem",
      color: "#f1c40f",
      textShadow: "1px 1px 0px #8e44ad, 0 0 5px rgba(241, 196, 15, 0.3)",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    closeBtn: {
      background: "transparent",
      border: "none",
      color: "rgba(245, 238, 194, 0.7)",
      cursor: "pointer",
      padding: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "color 0.2s",
    },
    formGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
    label: {
      fontSize: "0.75rem",
      color: "rgba(245, 238, 194, 0.8)",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    input: {
      width: "100%",
      padding: "10px",
      borderRadius: "8px",
      border: "1px solid rgba(245, 238, 194, 0.2)",
      background: "rgba(0, 0, 0, 0.4)",
      color: "#fff",
      fontSize: "0.9rem",
      boxSizing: "border-box",
      outline: "none",
      transition: "border-color 0.2s",
    },
    errorText: {
      color: "#e74c3c",
      textAlign: "center",
      fontSize: "0.85rem",
    },
    successText: {
      color: "#2ecc71",
      textAlign: "center",
      fontSize: "0.82rem",
      marginTop: "2px",
    },
    privateLinkBox: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      marginTop: "6px",
      padding: "10px",
      borderRadius: "8px",
      background: "rgba(0, 0, 0, 0.35)",
      border: "1px solid rgba(245, 238, 194, 0.2)",
    },
    privateLink: {
      fontSize: "0.72rem",
      wordBreak: "break-all",
      color: "#f5eec2",
      opacity: 0.92,
    },
    inlineActions: {
      display: "flex",
      gap: "8px",
      width: "100%",
    },
    secondaryBtn: {
      flex: 1,
      borderRadius: "8px",
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(255,255,255,0.08)",
      color: "#fff",
      padding: "10px",
      fontWeight: "bold",
      cursor: "pointer",
      fontSize: "0.8rem",
    },
    createBtn: {
      width: "100%",
      background: "#ff9800", // Match the orange from the other views
      border: "none",
      borderRadius: "8px",
      padding: "12px",
      color: "#fff",
      fontWeight: "bold",
      fontSize: "0.9rem",
      cursor: "pointer",
      boxShadow: "0 3px 0 #e65100, 0 4px 8px rgba(0,0,0,0.3)",
      textTransform: "uppercase",
      letterSpacing: "1px",
      marginTop: "10px",
      transition: "transform 0.1s",
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.popupContent} onClick={(e) => e.stopPropagation()}>
        
        <div style={styles.header}>
          <h2 style={styles.title}>Create Room</h2>
          <button 
            onClick={onClose} 
            style={styles.closeBtn}
            onMouseOver={(e) => e.currentTarget.style.color = "#fff"}
            onMouseOut={(e) => e.currentTarget.style.color = "rgba(245, 238, 194, 0.7)"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.5rem" }}>close</span>
          </button>
        </div>

        <div>
          <div style={styles.formGroup}>
            <label htmlFor="room-name" style={styles.label}>Room Name</label>
            <input
              type="text"
              id="room-name"
              placeholder="e.g., Weekend Warriors"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              style={styles.input}
              onFocus={(e) => e.target.style.borderColor = "#f1c40f"}
              onBlur={(e) => e.target.style.borderColor = "rgba(245, 238, 194, 0.2)"}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label htmlFor="game-type" style={styles.label}>Game Type</label>
            <select 
              id="game-type" 
              value={gameType} 
              onChange={(e) => setGameType(e.target.value)}
              style={{...styles.input, appearance: "auto"}} // Ensures native dropdown arrows still appear
              onFocus={(e) => e.target.style.borderColor = "#f1c40f"}
              onBlur={(e) => e.target.style.borderColor = "rgba(245, 238, 194, 0.2)"}
            >
              <option value="2-players" style={{ background: "#0a1e12" }}>2 Players</option>
              <option value="3-players" style={{ background: "#0a1e12" }}>3 Players</option>
              <option value="4-players" style={{ background: "#0a1e12" }}>4 Players</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="visibility" style={styles.label}>Visibility</label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              style={{ ...styles.input, appearance: "auto" }}
              onFocus={(e) => e.target.style.borderColor = "#f1c40f"}
              onBlur={(e) => e.target.style.borderColor = "rgba(245, 238, 194, 0.2)"}
            >
              <option value="public" style={{ background: "#0a1e12" }}>Public</option>
              <option value="private" style={{ background: "#0a1e12" }}>Private</option>
            </select>
          </div>
          
          <div style={styles.formGroup}>
            <label htmlFor="entry-fee" style={styles.label}>Entry Fee (Birr)</label>
            <input
              type="number"
              id="entry-fee"
              placeholder="e.g., 10"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              style={styles.input}
              onFocus={(e) => e.target.style.borderColor = "#f1c40f"}
              onBlur={(e) => e.target.style.borderColor = "rgba(245, 238, 194, 0.2)"}
            />
          </div>
        </div>

        {error && <div style={styles.errorText}>{error}</div>}
        {copyMsg && <div style={styles.successText}>{copyMsg}</div>}

        {visibility === "private" && privateGameLink && (
          <div style={styles.privateLinkBox}>
            <div style={styles.privateLink}>{privateGameLink}</div>
            <div style={styles.inlineActions}>
              <button style={styles.secondaryBtn} onClick={handleCopyLink}>
                Copy Link
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => handleJoinRoom(createdRoomId)}
              >
                Join Room
              </button>
            </div>
          </div>
        )}

        <div>
          <button 
            style={styles.createBtn} 
            onClick={handleCreate}
            disabled={loading}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(3px)";
              e.currentTarget.style.boxShadow = "0 0px 0 #e65100, 0 2px 4px rgba(0,0,0,0.3)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 3px 0 #e65100, 0 4px 8px rgba(0,0,0,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 3px 0 #e65100, 0 4px 8px rgba(0,0,0,0.3)";
            }}
          >
            {loading ? "Creating..." : visibility === "private" ? "Create Room" : "Create & Join"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default RoomCreate;
