// src/GamePage.js
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import { socket } from "./socket";
import { useLanguage } from "./contexts/LanguageContext";

const rankOrder = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const suitOrder = ["♠", "♥", "♦", "♣"];

function GamePage() {

  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { t } = useLanguage();
  
  // Update this to match your actual backend URL/port
  const BASE_URL = process.env.REACT_APP_API_URL;

  // ✨ Use state to hold game data, making it reactive to socket updates
  const [room, setRoom] = useState(location.state?.room || null);
  const [players, setPlayers] = useState(location.state?.players || []);
  const [gameState, setGameState] = useState(location.state?.redisData || {});

  // Click & Action States
  const [selectedHandIndex, setSelectedHandIndex] = useState(null);
  const [deckSelected, setDeckSelected] = useState(false);
  const [laidSelected, setLaidSelected] = useState(false);
  const [highlightedCardKey, setHighlightedCardKey] = useState(null);
  const prevMyCardsRef = useRef([]);
  const [flyingCard, setFlyingCard] = useState(null);
  
  // ✨ UI feedback states
  const [errorMsg, setErrorMsg] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    const handleRoomUpdate = (data) => {
      console.log("📢 Received room_update:", data);
      setRoom(data.room);
      setPlayers(data.players);
      setGameState(data.redisData);
    };
    socket.on("room_update", handleRoomUpdate);

    return () => {
      socket.off("room_update", handleRoomUpdate);
    };
  }, []); 

  // Extract game state from the state variable
  const playerCards = useMemo(() => gameState.playerCards || {}, [gameState.playerCards]);
  const laidCards = gameState.laidCards || [];
  const turn = gameState.turn;
  const gameEnded = Boolean(gameState.gameEnded || gameState.status === "ended");
  const gameResult = gameState.gameResult || null;

  // Get actual cards for the logged-in user
  const myCards = useMemo(() => (
    user && playerCards[user.telegramId] ? playerCards[user.telegramId] : []
  ), [playerCards, user]);

  // Detect newly picked card and highlight it
  useEffect(() => {
    const prevCards = prevMyCardsRef.current || [];

    if (prevCards.length > 0 && myCards.length === prevCards.length + 1) {
      const countCards = (cards) => {
        return cards.reduce((acc, card) => {
          const key = `${card.rank}-${card.suit}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      };

      const prevMap = countCards(prevCards);
      const newMap = countCards(myCards);
      let newKey = null;
      Object.keys(newMap).forEach((key) => {
        if ((prevMap[key] || 0) < newMap[key]) {
          newKey = key;
        }
      });

      if (newKey) {
        setHighlightedCardKey(newKey);
      }
    }

    prevMyCardsRef.current = myCards;
  }, [myCards]);

  // Trigger and clean up flying card animation
  useEffect(() => {
    if (!flyingCard || flyingCard.animate) return;

    const raf = requestAnimationFrame(() => {
      setFlyingCard((prev) => (prev ? { ...prev, animate: true } : prev));
    });

    const timer = setTimeout(() => {
      setFlyingCard(null);
    }, 600);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [flyingCard]);

  // ✨ GAME RULES LOGIC
  const isMyTurn = user && String(turn) === String(user.telegramId);
  const canPick = !gameEnded && isMyTurn && myCards.length === 10;
  const canLay = !gameEnded && isMyTurn && myCards.length === 11;
  const rankPattern = Object.values(
    myCards.reduce((acc, card) => {
      acc[card.rank] = (acc[card.rank] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b - a);
  const canDeclareWin =
    !gameEnded &&
    isMyTurn &&
    myCards.length === 11 &&
    rankPattern.length === 4 &&
    rankPattern[0] === 4 &&
    rankPattern[1] === 3 &&
    rankPattern[2] === 3 &&
    rankPattern[3] === 1;

  // Helper to show errors
  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 3000); // clear after 3 seconds
  };

  // Always arrange cards in grouped order for display
  const groupedAndSortedCards = myCards
    .map((card, originalIndex) => ({ ...card, originalIndex }))
    .sort((a, b) => {
      const sameRankCountA = myCards.filter((card) => card.rank === a.rank).length;
      const sameRankCountB = myCards.filter((card) => card.rank === b.rank).length;

      if (sameRankCountA !== sameRankCountB) {
        return sameRankCountB - sameRankCountA;
      }

      if (a.rank !== b.rank) {
        const rankAIndex = rankOrder.indexOf(a.rank);
        const rankBIndex = rankOrder.indexOf(b.rank);

        if (rankAIndex !== rankBIndex) {
          return rankAIndex - rankBIndex;
        }
      }

      const suitAIndex = suitOrder.indexOf(a.suit);
      const suitBIndex = suitOrder.indexOf(b.suit);

      if (suitAIndex !== suitBIndex) {
        return suitAIndex - suitBIndex;
      }

      return a.originalIndex - b.originalIndex;
    });

  // Map opponent positions around the top and sides in a top-down view
  const getOpponentPosition = (index, total) => {
    const positions = [
      { top: "5%", left: "50%", transform: "translateX(-50%)" }, // Top Center
      { top: "15%", left: "20%" }, // Top Left
      { top: "15%", right: "20%" }, // Top Right
      { top: "40%", left: "8%" }, // Mid Left
      { top: "40%", right: "8%" }, // Mid Right
    ];
    return positions[index % positions.length];
  };

  // Click Handlers
  const handleCardClick = (index) => {
    setSelectedHandIndex(index === selectedHandIndex ? null : index);
    setDeckSelected(false);
    setLaidSelected(false);
  };

  const handleDeckClick = () => {
    setDeckSelected(!deckSelected);
    setSelectedHandIndex(null);
    setLaidSelected(false);
  };

  const handleLaidClick = () => {
    if (laidCards.length === 0) return; // Ignore if empty
    setLaidSelected(!laidSelected);
    setSelectedHandIndex(null);
    setDeckSelected(false);
  };

  // Action Handler connected to Backend Endpoints
  const handleAction = async (e, action, target, cardData = null) => {
    e.stopPropagation();
    
    // Safety check before hitting the API
    if (action === "Pick" && !canPick) {
      return showError(t("game.errorAlreadyPicked", "You already picked! You must lay a card."));
    }
    if (action === "Lay" && !canLay) {
      return showError(t("game.errorPickFirst", "You must pick a card before you can lay one."));
    }

    const payload = {
      userId: user.telegramId,
      roomId: room.id || room.roomId || room.name,
      // ✨ Add socketId to ensure server has the latest for emitting updates
      socketId: socket.id
    };

    try {
      let endpoint = "";
      if (action === "Pick" && target === "Deck") {
        endpoint = "/gameplay/take-card";
      } else if (action === "Pick" && target === "Laid Card") {
        endpoint = "/gameplay/pick-card";
      } else if (action === "Lay") {
        endpoint = "/gameplay/lay-card";
        payload.card = cardData;
      }

      if (endpoint) {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        // Handle backend errors (like out of turn, etc)
        if (!response.ok || data.error) {
          showError(data.error || t("game.errorAction", "Action failed"));
          console.error(`❌ Server error from ${endpoint}:`, data);
        } else {
          console.log(`✅ Server response from ${endpoint}:`, data);

          // Trigger flying card animation on successful pick/lay actions
          if (action === "Pick" && target === "Deck") {
            setFlyingCard({
              type: "deckToHand",
              variant: "back",
              animate: false,
            });
          } else if (action === "Pick" && target === "Laid Card") {
            if (topLaidCard) {
              setFlyingCard({
                type: "deckToHand",
                variant: "face",
                card: topLaidCard,
                animate: false,
              });
            }
          } else if (action === "Lay" && cardData) {
            setFlyingCard({
              type: "handToLaid",
              variant: "face",
              card: cardData,
              animate: false,
            });
          }
        }
      }
    } catch (error) {
      showError(t("game.errorNetwork", "Network error. Could not connect to server."));
      console.error("❌ Error performing action:", error);
    }
    
    // Reset selections after action
    setSelectedHandIndex(null);
    setDeckSelected(false);
    setLaidSelected(false);
    if (action === "Lay") {
      // After laying a card, remove highlight from the previously picked card
      setHighlightedCardKey(null);
    }
  };

  const postGameplayAction = async (endpoint) => {
    if (!user || !room) return false;
    const payload = {
      userId: user.telegramId,
      roomId: room.id || room.roomId || room.name,
      socketId: socket.id,
    };

    setIsActionLoading(true);
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        showError(data.error || t("game.errorAction", "Action failed"));
        return false;
      }
      return true;
    } catch (error) {
      showError(t("game.errorNetwork", "Network error. Could not connect to server."));
      console.error(`❌ Error calling ${endpoint}:`, error);
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    const success = await postGameplayAction("/gameplay/leave-game");
    if (success) navigate("/second");
  };

  const handleDeclareWin = async () => {
    if (!canDeclareWin) {
      return showError(t("game.errorWinningHand", "Winning hand must be 4-3-3-1."));
    }
    await postGameplayAction("/gameplay/declare-win");
  };

  const handlePlayAgain = async () => {
    await postGameplayAction("/gameplay/play-again");
  };

  const styles = {
    container: {
      minHeight: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: "#0c2b18", 
      position: "relative",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
    },
    errorToast: {
      position: "absolute",
      top: "15%",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#e74c3c",
      color: "white",
      padding: "10px 20px",
      borderRadius: "20px",
      fontWeight: "bold",
      boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
      zIndex: 1000,
      opacity: errorMsg ? 1 : 0,
      transition: "opacity 0.3s ease",
      pointerEvents: "none",
    },
    centerArea: {
      position: "absolute",
      top: "45%",
      left: "50%", 
      transform: "translate(-50%, -50%)",
      display: "flex",
      gap: "20px",
      zIndex: 2,
    },
    deckCard: {
      width: "clamp(45px, 8vw, 65px)", 
      height: "clamp(70px, 12vw, 100px)",
      background: "repeating-linear-gradient(45deg, #b71c1c, #b71c1c 4px, #fff 4px, #fff 8px)",
      border: "2px solid #fff",
      borderRadius: "6px",
      boxShadow: "-2px 2px 5px rgba(0,0,0,0.6)",
      cursor: isMyTurn ? "pointer" : "default", // Only show pointer if it's your turn
    },
    laidCardSlot: {
      width: "clamp(45px, 8vw, 65px)", 
      height: "clamp(70px, 12vw, 100px)",
      border: "2px dashed rgba(255, 255, 255, 0.3)",
      borderRadius: "6px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "rgba(0, 0, 0, 0.2)",
      cursor: isMyTurn && laidCards.length > 0 ? "pointer" : "default",
      position: "relative",
    },
    opponentWrapper: {
      position: "absolute",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      zIndex: 3,
      transition: "all 0.3s ease",
    },
    avatar: (isActive) => ({
      width: "clamp(40px, 8vw, 55px)",
      height: "clamp(40px, 8vw, 55px)",
      borderRadius: "50%",
      border: `3px solid ${isActive ? "#2ecc71" : "#f1c40f"}`, 
      background: "#333",
      objectFit: "cover",
      boxShadow: isActive ? "0 0 15px rgba(46, 204, 113, 0.8)" : "0 4px 10px rgba(0,0,0,0.5)",
    }),
    playerName: (isActive) => ({
      fontSize: "0.75rem",
      background: isActive ? "rgba(46, 204, 113, 0.2)" : "rgba(0,0,0,0.6)",
      padding: "3px 8px",
      borderRadius: "12px",
      marginTop: "5px",
      border: `1px solid ${isActive ? "#2ecc71" : "rgba(245, 238, 194, 0.2)"}`,
      whiteSpace: "nowrap",
      color: isActive ? "#2ecc71" : "rgba(255,255,255,0.9)",
      fontWeight: isActive ? "bold" : "normal",
    }),
    cardCount: {
      fontSize: "0.6rem",
      background: "#e74c3c",
      color: "white",
      borderRadius: "50%",
      width: "18px",
      height: "18px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      position: "absolute",
      top: "-5px",
      right: "-5px",
      fontWeight: "bold",
      border: "1px solid #fff",
    },
    statusDisplay: {
      background: 'rgba(0, 0, 0, 0.5)',
      padding: '8px 15px',
      borderRadius: '15px',
      marginBottom: '10px',
      fontSize: '0.9rem',
      fontWeight: 'bold',
      color: '#f1c40f',
      border: '1px solid rgba(241, 196, 15, 0.3)',
      textAlign: 'center',
      minWidth: '250px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
      zIndex: 11,
    },
    playerArea: {
      position: "absolute",
      bottom: "2vh", 
      left: "0",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      zIndex: 10,
    },
    handContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-end",
      marginTop: "8px",
      height: "clamp(90px, 15vw, 130px)", 
      paddingBottom: "35px", 
    },
    card: {
      width: "clamp(40px, 8vw, 60px)", 
      height: "clamp(60px, 12vw, 90px)",
      background: "#fff",
      borderRadius: "6px",
      border: "1px solid #ccc",
      boxShadow: "-3px 0px 8px rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "center",
      paddingTop: "6px",
      fontWeight: "bold",
      fontSize: "clamp(1rem, 2.5vw, 1.4rem)",
      position: "relative",
      transition: "transform 0.2s, z-index 0.2s",
      cursor: "pointer",
    },
    actionPopupBtn: {
      position: "absolute",
      bottom: "-35px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#2ecc71",
      color: "#fff",
      border: "1px solid #27ae60",
      padding: "5px 15px",
      borderRadius: "15px",
      fontSize: "0.8rem",
      fontWeight: "bold",
      cursor: "pointer",
      boxShadow: "0 2px 5px rgba(0,0,0,0.5)",
      zIndex: 100, 
    },
    actionButtons: {
      display: "flex",
      gap: "15px",
      marginTop: "5px",
    },
    btnLeave: {
      background: "rgba(255, 255, 255, 0.05)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      color: "#fff",
      borderRadius: "20px",
      padding: "8px 25px",
      fontSize: "0.85rem",
      cursor: "pointer",
      backdropFilter: "blur(5px)",
      transition: "background 0.2s",
    },
    btnWin: {
      background: "#f1c40f",
      border: "1px solid #fff",
      color: "#000",
      fontWeight: "bold",
      borderRadius: "20px",
      padding: "8px 25px",
      fontSize: "0.85rem",
      cursor: "pointer",
      boxShadow: "0 3px 0 #b9770e, 0 4px 10px rgba(0,0,0,0.4)",
      transition: "transform 0.1s",
    },
    btnWinDisabled: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
      filter: "grayscale(0.5)",
    },
    gameOverOverlay: {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      padding: "20px",
    },
    gameOverPopup: {
      width: "min(520px, 92vw)",
      background: "rgba(12, 12, 12, 0.95)",
      border: "1px solid rgba(241, 196, 15, 0.4)",
      borderRadius: "16px",
      padding: "18px 20px",
      boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
    },
    gameOverTitle: {
      margin: 0,
      fontSize: "1.2rem",
      color: "#f1c40f",
    },
    gameOverSubtitle: {
      marginTop: "8px",
      opacity: 0.85,
      fontSize: "0.9rem",
    },
    gameOverDetails: {
      marginTop: "14px",
      fontSize: "0.85rem",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "10px",
      padding: "10px 12px",
      lineHeight: 1.5,
    },
    gameOverActions: {
      marginTop: "16px",
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
    },
    roomInfoBanner: {
      position: "absolute",
      top: "10px",
      left: "10px",
      background: "rgba(0,0,0,0.3)",
      padding: "5px 10px",
      borderRadius: "8px",
      zIndex: 20,
      fontSize: "0.75rem",
      border: "1px solid rgba(245, 238, 194, 0.1)",
    },
    turnLoader: {
      marginTop: "6px",
      width: "28px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    turnLoaderDot: (delay) => ({
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "#f1c40f",
      animation: `turnPulse 1s ease-in-out ${delay}s infinite`,
      boxShadow: "0 0 6px rgba(241, 196, 15, 0.7)",
    }),
    flyingCard: (config) => {
      const base = {
        position: "absolute",
        width: "clamp(40px, 8vw, 60px)",
        height: "clamp(60px, 12vw, 90px)",
        borderRadius: "6px",
        boxShadow: "0 6px 14px rgba(0,0,0,0.7)",
        zIndex: 999,
        pointerEvents: "none",
        transition: "transform 0.55s ease-out, opacity 0.55s ease-out",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        fontSize: "clamp(1rem, 2.5vw, 1.4rem)",
      };

      let top = "45%";
      let left = "50%";
      let transformFrom = "translate3d(-50%, -50%, 0)";
      let transformTo = "translate3d(-50%, 40vh, 0)";

      if (config?.type === "handToLaid") {
        top = "82%";
        left = "50%";
        transformFrom = "translate3d(-50%, -50%, 0)";
        transformTo = "translate3d(-50%, -42vh, 0)";
      }

      const transform = config?.animate ? transformTo : transformFrom;
      const opacity = config?.animate ? 0 : 1;

      return {
        ...base,
        top,
        left,
        transform,
        opacity,
      };
    },
  };

  if (!room) {
    return (
      <p style={{ color: "white", textAlign: "center", marginTop: "50px" }}>
        {t("game.loading", "Loading Game...")}
      </p>
    );
  }

  const displayOpponents = players && user 
    ? players.filter(playerId => String(playerId) !== String(user.telegramId)) 
    : [];

  const topLaidCard = laidCards.length > 0 ? laidCards[laidCards.length - 1] : null;

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes turnPulse {
            0%, 80%, 100% {
              transform: scale(0.7);
              opacity: 0.35;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
      {/* ✨ Error Notification Toast */}
      {errorMsg && <div style={styles.errorToast}>{errorMsg}</div>}

      <div style={styles.roomInfoBanner}>
        <span style={{ color: "#f1c40f", fontWeight: "bold" }}>{room.name}</span>
        <span style={{ opacity: 0.7, marginLeft: "10px" }}>
          {t("game.statusFee", "Fee: {{amount}} Birr", { amount: room.entryFee })}
        </span>
      </div>

      {/* Center Table (Deck & Discard Pile) */}
      <div style={styles.centerArea}>
        {/* The remaining deck */}
        <div style={{ position: "relative" }} onClick={handleDeckClick}>
          <div style={styles.deckCard}></div>
          <div style={{...styles.deckCard, position: "absolute", top: "-2px", left: "2px", zIndex: -1 }}></div>
          {/* ✨ Only show Pick button if it's your turn AND you have 10 cards */}
          {deckSelected && canPick && (
            <button style={styles.actionPopupBtn} onClick={(e) => handleAction(e, "Pick", "Deck")}>
              {t("game.pick", "Pick")}
            </button>
          )}
        </div>

        {/* Discard / Laid Cards Pile */}
        <div 
          style={styles.laidCardSlot}
          onClick={handleLaidClick}
        >
          {topLaidCard ? (
            // Render a visual representation of the card
            <div style={{
                ...styles.deckCard, // Reuse style for consistent size
                background: '#fff',
                color: topLaidCard.color,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                fontWeight: 'bold',
                lineHeight: 1,
                cursor: 'inherit' // Inherit cursor from parent
            }}>
              <div>{topLaidCard.rank}</div>
              <div>{topLaidCard.suit}</div>
            </div>
          ) : (
            <span style={{ opacity: 0.3, fontSize: "0.8rem" }}>{t("game.empty", "Empty")}</span>
          )}
          
          {/* The pick button is positioned relative to the slot */}
          {laidSelected && topLaidCard && canPick && (
            <button style={styles.actionPopupBtn} onClick={(e) => handleAction(e, "Pick", "Laid Card")}>
              {t("game.pick", "Pick")}
            </button>
          )}
        </div>
      </div>

      {/* Opponents */}
      {displayOpponents.map((opponentId, index) => {
        const isOpponentTurn = String(turn) === String(opponentId);
        const opponentCardCount = playerCards[opponentId]?.length || 0;

        return (
          <div 
            key={index} 
            style={{ 
              ...styles.opponentWrapper, 
              ...getOpponentPosition(index, displayOpponents.length) 
            }}
          >
            <div style={{ position: "relative" }}>
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${opponentId}`} 
                alt={t("game.player", "Player")} 
                style={styles.avatar(isOpponentTurn)} 
              />
              <div style={styles.cardCount}>{opponentCardCount}</div>
            </div>
            <div style={styles.playerName(isOpponentTurn)}>
              {t("game.statusPlayer", "Player {{id}}", { id: String(opponentId).slice(-4) })}
            </div>
            {isOpponentTurn && (
              <div style={styles.turnLoader}>
                <div style={styles.turnLoaderDot(0)}></div>
                <div style={styles.turnLoaderDot(0.2)}></div>
                <div style={styles.turnLoaderDot(0.4)}></div>
              </div>
            )}
          </div>
        );
      })}

      {gameEnded && gameResult && (
        <div style={styles.gameOverOverlay}>
          <div style={styles.gameOverPopup}>
            <h3 style={styles.gameOverTitle}>{t("game.gameOver", "Game Over")}</h3>
            <div style={styles.gameOverSubtitle}>
              {t("game.statusWinner", "Winner: Player {{id}}", { id: String(gameResult.winnerId || "").slice(-4) })}
            </div>
            <div style={styles.gameOverDetails}>
              <div>
                {t("game.statusPattern", "Pattern: {{pattern}}", {
                  pattern: gameResult.winnerPattern || "4-3-3-1",
                })}
              </div>
              <div>
                {t("game.statusReason", "Reason: {{reason}}", {
                  reason: gameResult.reason || "valid-hand",
                })}
              </div>
              <div>
                {t("game.ended", "Ended")}: {" "}
                {gameResult.endedAt
                  ? new Date(gameResult.endedAt).toLocaleString()
                  : t("game.notAvailable", "N/A")}
              </div>
            </div>
            <div style={styles.gameOverActions}>
              <button
                style={styles.btnLeave}
                onClick={handleLeaveGame}
                disabled={isActionLoading}
              >
                {t("game.leave", "Leave")}
              </button>
              <button
                style={styles.btnWin}
                onClick={handlePlayAgain}
                disabled={isActionLoading}
              >
                {isActionLoading
                  ? t("game.starting", "Starting...")
                  : t("game.playAgain", "Play Again")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flying card animation overlay */}
      {flyingCard && (
        <div style={styles.flyingCard(flyingCard)}>
          {flyingCard.variant === "back" ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "6px",
                background:
                  "repeating-linear-gradient(45deg, #b71c1c, #b71c1c 4px, #fff 4px, #fff 8px)",
                border: "2px solid #fff",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#fff",
                borderRadius: "6px",
                border: "2px solid #f1c40f",
                color: flyingCard.card?.color || "#000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              <div>{flyingCard.card?.rank}</div>
              <div>{flyingCard.card?.suit}</div>
            </div>
          )}
        </div>
      )}

      {/* Main Player Bottom Area */}
      <div style={styles.playerArea}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img
            src={user?.photo || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
            alt={t("game.you", "You")}
            style={{
              ...styles.avatar(isMyTurn),
              width: "clamp(50px, 9vw, 65px)",
              height: "clamp(50px, 9vw, 65px)",
            }}
          />
          <div style={styles.playerName(isMyTurn)}>
            {user ? `${user.firstName}` : t("game.you", "You")}
          </div>
          {isMyTurn && (
            <div style={styles.turnLoader}>
              <div style={styles.turnLoaderDot(0)}></div>
              <div style={styles.turnLoaderDot(0.2)}></div>
              <div style={styles.turnLoaderDot(0.4)}></div>
            </div>
          )}
        </div>
        <div style={styles.handContainer}>
          {groupedAndSortedCards.length > 0 ? (
            groupedAndSortedCards.map((card, index) => {
              const isSelected = selectedHandIndex === index;
              const isHighlighted = highlightedCardKey === `${card.rank}-${card.suit}`;
              return (
                <div
                  key={`${card.rank}-${card.suit}-${index}`}
                  style={{
                    ...styles.card,
                    color: card.color,
                    marginLeft: index === 0 ? "0" : "clamp(-18px, -4vw, -10px)",
                    zIndex: isSelected ? 50 : index,
                    transform: isSelected ? "translateY(-15px)" : "translateY(0)",
                    border: isHighlighted ? "2px solid #f1c40f" : styles.card.border,
                    boxShadow: isHighlighted
                      ? "0 0 10px rgba(241, 196, 15, 0.9)"
                      : styles.card.boxShadow,
                  }}
                  onClick={() => handleCardClick(index)}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = "translateY(-10px)";
                      e.currentTarget.style.zIndex = "50";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.zIndex = index;
                    }
                  }}
                >
                  <div style={{ lineHeight: "1" }}>{card.rank}</div>
                  <div style={{ lineHeight: "1" }}>{card.suit}</div>
                  {isSelected && canLay && (
                    <button
                      style={styles.actionPopupBtn}
                      onClick={(e) => handleAction(e, "Lay", "Hand", card)}
                    >
                      {t("game.lay", "Lay")}
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ opacity: 0.5, fontStyle: "italic", marginTop: "10px" }}>
              {t("game.waiting", "Waiting for cards...")}
            </div>
          )}
        </div>
        <div style={styles.actionButtons}>
          <button
            style={styles.btnLeave}
            onClick={handleLeaveGame}
            disabled={isActionLoading}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
          >
            {t("game.leave", "Leave")}
          </button>
          <button
            style={{
              ...styles.btnWin,
              ...(canDeclareWin ? {} : styles.btnWinDisabled),
            }}
            onClick={handleDeclareWin}
            disabled={!canDeclareWin || isActionLoading}
          >
            {isActionLoading ? "..." : t("game.win", "Win")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GamePage;
