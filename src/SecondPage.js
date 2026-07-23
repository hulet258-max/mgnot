import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import RoomCreate from "./RoomCreate";
import JoinConfirmation from "./JoinConfirmation";

function SecondPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useUser();
  const BASE_URL = process.env.REACT_APP_API_URL;
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${BASE_URL}/rooms`);
      const data = await response.json();
      if (data.success) {
        setRooms(data.rooms);
      } else {
        console.error("Failed to fetch rooms:", data.error);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    const roomId = new URLSearchParams(location.search).get("roomId");
    if (!roomId || selectedRoom) return;

    const fetchSharedRoom = async () => {
      try {
        const response = await fetch(`${BASE_URL}/room/${roomId}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setSelectedRoom(data.room);
        }
      } catch (error) {
        console.error("Error fetching shared room:", error);
      }
    };

    fetchSharedRoom();
  }, [location.search, selectedRoom]);

  const handleRoomCreated = (newRoom) => {
    setRooms(prevRooms => [newRoom, ...prevRooms]);
  };

  const handleJoinClick = (room) => {
    setSelectedRoom(room);
  };

  // Styled to exactly match the MainPage theme
  const styles = {
    container: {
      minHeight: "100vh",
      width: "100vw",
      overflowX: "hidden",
      overflowY: "auto",
      background: "radial-gradient(circle at center, #4caf50 0%, #1b5e20 100%)",
      color: "#fff",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      position: "relative",
      padding: "15px", // Scaled down
      boxSizing: "border-box",
    },
    overlay: {
      position: "fixed", // Fixed so scrolling doesn't break the vignette
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "radial-gradient(transparent 60%, rgba(0,0,0,0.6) 100%)",
      pointerEvents: "none",
      zIndex: 1,
    },
    contentWrapper: {
      position: "relative",
      zIndex: 2,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: "100%",
      maxWidth: "400px", // Keeping it compact like MainPage
      margin: "0 auto",
    },
    headerCard: {
      background: "rgba(10, 30, 18, 0.85)",
      borderRadius: "12px",
      padding: "12px 15px",
      width: "100%",
      boxShadow: "0 8px 20px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(245, 238, 194, 0.3)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px",
      boxSizing: "border-box",
    },
    userInfo: {
      display: "flex",
      alignItems: "center",
    },
    avatar: {
      width: "35px", // Scaled down
      height: "35px",
      borderRadius: "50%",
      border: "2px solid #d4af37",
      marginRight: "10px",
      objectFit: "cover",
    },
    userName: {
      margin: 0,
      fontSize: "0.9rem", // Scaled down
      color: "#f5eec2",
    },
    userHandle: {
      margin: 0,
      fontSize: "0.7rem", // Scaled down
      color: "rgba(245, 238, 194, 0.7)",
    },
    headerActions: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    balanceText: {
      fontSize: "1.2rem", // Scaled down
      fontWeight: "bold",
      color: "#f1c40f", // Gold
      textShadow: "0 0 5px rgba(241, 196, 15, 0.4)",
    },
    settingsBtn: {
      background: "rgba(0, 0, 0, 0.3)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      color: "#fff",
      borderRadius: "16px",
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: "0.65rem", // Scaled down
      backdropFilter: "blur(5px)",
    },
    sectionHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: "15px",
    },
    sectionTitle: {
      margin: 0,
      fontSize: "1.2rem", // Scaled down
      fontWeight: "bold",
      color: "#f1c40f",
      textShadow: "1px 1px 0px #8e44ad, 0 0 5px rgba(241, 196, 15, 0.3)",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    createRoomBtn: {
      background: "#ff9800", // Warm orange 3D button
      border: "none",
      borderRadius: "6px",
      padding: "6px 12px",
      color: "#fff",
      fontWeight: "bold",
      fontSize: "0.7rem", // Scaled down
      cursor: "pointer",
      boxShadow: "0 2px 0 #e65100",
    },
    roomList: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    roomCard: {
      background: "rgba(0, 0, 0, 0.4)", // Slightly lighter than header for distinction
      border: "1px solid rgba(245, 238, 194, 0.15)",
      borderRadius: "10px",
      padding: "12px",
      width: "100%",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    roomHeader: {
      display: "flex",
      justifyContent: "space-between",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      paddingBottom: "8px",
    },
    roomTitle: {
      margin: 0,
      fontSize: "0.95rem",
      color: "#fff",
    },
    roomSubtitle: {
      fontSize: "0.7rem",
      color: "rgba(255,255,255,0.6)",
    },
    feeCol: {
      textAlign: "right",
    },
    feeLabel: {
      display: "block",
      fontSize: "0.6rem",
      color: "rgba(255,255,255,0.6)",
      textTransform: "uppercase",
    },
    feeAmount: {
      display: "block",
      fontSize: "0.95rem",
      fontWeight: "bold",
      color: "#f1c40f",
    },
    roomFooter: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    playersInfo: {
      fontSize: "0.75rem",
      color: "#f5eec2",
    },
    joinBtn: {
      background: "linear-gradient(to bottom, #e74c3c, #c0392b)", // Red gradient 3D
      border: "1px solid #fff",
      borderRadius: "20px",
      padding: "6px 16px",
      fontSize: "0.75rem",
      fontWeight: "bold",
      color: "#fff",
      cursor: "pointer",
      boxShadow: "0 2px 0 #922b21, 0 4px 8px rgba(0,0,0,0.3)",
      textTransform: "uppercase",
      letterSpacing: "1px",
      transition: "transform 0.1s",
    }
  };

  return (
    <div style={styles.container}>
      {/* Vignette Overlay */}
      <div style={styles.overlay}></div>

      <div style={styles.contentWrapper}>
        {/* HEADER / USER CARD */}
        <header style={styles.headerCard}>
          <div style={styles.userInfo}>
            <img
              alt="User Avatar"
              style={styles.avatar}
              src={user?.photo || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
            />
            <div>
              <h2 style={styles.userName}>
                {loading ? "Loading..." : user ? `${user.firstName} ${user.lastName}` : "User"}
              </h2>
              <p style={styles.userHandle}>@{user?.username || "username"}</p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <span style={styles.balanceText}>
              {loading ? "..." : `${user?.balance || 0} Birr`}
            </span>
            <button style={styles.settingsBtn}>Settings</button>
          </div>
        </header>

        {/* MAIN ROOM LIST */}
        <main style={{ width: "100%" }}>
          <div style={styles.sectionHeader}>
            <h4 style={styles.sectionTitle}>Game Rooms</h4>
            <button 
              style={styles.createRoomBtn} 
              onClick={() => setShowCreatePopup(true)}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translateY(2px)";
                e.currentTarget.style.boxShadow = "0 0px 0 #e65100";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 0 #e65100";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 0 #e65100";
              }}
            >
              Create Room
            </button>
          </div>

          <div style={styles.roomList}>
            {rooms.map((room) => (
              <div style={styles.roomCard} key={room.id}>
                <div style={styles.roomHeader}>
                  <div>
                    <h5 style={styles.roomTitle}>{room.name}</h5>
                    <span style={styles.roomSubtitle}>{room.maxPlayers} Players • {room.type}</span>
                  </div>
                  <div style={styles.feeCol}>
                    <span style={styles.feeLabel}>Entry Fee</span>
                    <span style={styles.feeAmount}>{room.entryFee} Birr</span>
                  </div>
                </div>
                
                <div style={styles.roomFooter}>
                  <div style={styles.playersInfo}>
                    <span>Players: {room.playerCount} / {room.maxPlayers}</span>
                  </div>
                  <button 
                    style={styles.joinBtn} 
                    onClick={() => handleJoinClick(room)}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = "translateY(2px)";
                      e.currentTarget.style.boxShadow = "0 0px 0 #922b21, 0 2px 4px rgba(0,0,0,0.3)";
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 0 #922b21, 0 4px 8px rgba(0,0,0,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 0 #922b21, 0 4px 8px rgba(0,0,0,0.3)";
                    }}
                  >
                    ይቀላቀሉ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {showCreatePopup && (
        <RoomCreate onClose={() => setShowCreatePopup(false)} onRoomCreated={handleRoomCreated} />
      )}

      {selectedRoom && (
        <JoinConfirmation
          room={selectedRoom}
          user={user}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </div>
  );
}

export default SecondPage;
