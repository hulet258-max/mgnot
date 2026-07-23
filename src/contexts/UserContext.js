import React, { createContext, useState, useEffect, useContext } from 'react';
import { recordEvent } from "../apiEvents";
import { socket } from "../socket";

const UserContext = createContext(null);

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [telegramId, setTelegramId] = useState(null); // ✅ NEW
    const [telegramUser, setTelegramUser] = useState(null); // ✅ NEW
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_BASE_URL = process.env.REACT_APP_API_URL;
    const TEST_TELEGRAM_ID = process.env.REACT_APP_TEST_TELEGRAM_ID || "8573502309";

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError(null);

            const tg = window.Telegram?.WebApp;
            const isLocal =
                window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1";
            const canUseTestTelegramId =
                process.env.NODE_ENV !== "production" ||
                isLocal ||
                process.env.REACT_APP_USE_TEST_TELEGRAM_ID === "true";

            // ✅ STEP 1 — Telegram init (same as your HomeOwner)
            if (!tg) {
                if (canUseTestTelegramId) {
                    const id = String(TEST_TELEGRAM_ID);
                    console.warn("⚠️ Telegram WebApp not found. Using TEST Telegram ID:", id);
                    setTelegramId(id);
                    setTelegramUser(null);

                    try {
                        const res = await fetch(`${API_BASE_URL}/telegram-user`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ telegramId: id, telegramUser: null })
                        });

                        if (!res.ok) {
                            throw new Error(`HTTP ${res.status}`);
                        }

                        const data = await res.json();

                        if (data.success) {
                            setUser({
                                id,
                                telegramId: id,
                                ...data.user,
                                photo: data.user?.photo || data.user?.photo_url || null
                            });
                            recordEvent("app_opened", { userId: id, metadata: { source: "test_browser" } });
                        } else {
                            setUser(null);
                            setError(data.error || data.message || "User sync failed");
                        }
                    } catch (err) {
                        console.error("❌ Fetch error:", err);
                        setUser(null);
                        setError(err.message);
                    } finally {
                        setLoading(false);
                    }
                    return;
                }

                const msg = "❌ App not opened inside Telegram";
                console.error(msg);
                setError(msg);
                setLoading(false);
                return;
            }

            tg.ready();
            tg.expand();

            console.log("📱 Telegram WebApp:", tg);

            let id = null;
            let tgUser = null;

            // ✅ STEP 2 — Get user (PRIMARY)
            if (tg.initDataUnsafe?.user) {
                tgUser = tg.initDataUnsafe.user;
                id = String(tgUser.id);
                console.log("✅ Telegram ID (initDataUnsafe):", id);
            } 
            // ✅ STEP 3 — Fallback parse (SAFE)
            else if (tg.initData) {
                try {
                    const params = new URLSearchParams(tg.initData);
                    const userParam = params.get("user");

                    if (userParam) {
                        const parsedUser = JSON.parse(userParam);
                        if (parsedUser?.id) {
                            tgUser = parsedUser;
                            id = String(parsedUser.id);
                            console.log("✅ Telegram ID (initData parsed):", id);
                        }
                    }
                } catch (err) {
                    console.warn("⚠️ initData parse failed:", err);
                }
            }

            // ✅ DEV fallback ONLY
            if (!id) {
                if (canUseTestTelegramId) {
                    id = String(TEST_TELEGRAM_ID);
                    console.warn("⚠️ Using LOCAL fallback Telegram ID");
                } else {
                    const msg = "❌ Telegram ID not found. Open via bot button.";
                    console.error(msg);
                    setError(msg);
                    setLoading(false);
                    return;
                }
            }

            // ✅ SAVE GLOBALLY (IMPORTANT)
            setTelegramId(id);
            setTelegramUser(tgUser);

            // ✅ STEP 4 — Sync with backend
            try {
                const res = await fetch(`${API_BASE_URL}/telegram-user`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ telegramId: id, telegramUser: tgUser })
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const data = await res.json();

                if (data.success) {
                    const syncedUser = {
                        id,
                        telegramId: id,
                        ...data.user,
                        firstName: data.user?.firstName || tgUser?.first_name || null,
                        lastName: data.user?.lastName || tgUser?.last_name || null,
                        username: data.user?.username || tgUser?.username || null,
                        photo: data.user?.photo || data.user?.photo_url || tgUser?.photo_url || null
                    };
                    setUser(syncedUser);
                    recordEvent("app_opened", { userId: id, metadata: { source: "telegram_webapp" } });

                    console.log("✅ User synced with backend");
                } else {
                    console.error("API Error:", data.error || data.message);

                    // still allow app to work with telegram data
                    setUser({
                        id,
                        telegramId: id,
                        firstName: tgUser?.first_name || null,
                        lastName: tgUser?.last_name || null,
                        username: tgUser?.username || null,
                        photo: tgUser?.photo_url || null
                    });

                    setError(data.error || data.message || "User sync failed");
                }

            } catch (err) {
                console.error("❌ Fetch error:", err);

                // fallback to telegram-only user
                setUser({
                    id,
                    telegramId: id,
                    firstName: tgUser?.first_name || null,
                    lastName: tgUser?.last_name || null,
                    username: tgUser?.username || null,
                    photo: tgUser?.photo_url || null
                });

                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [API_BASE_URL, TEST_TELEGRAM_ID]);

    // ✅ GLOBAL VALUE
    useEffect(() => {
        if (!telegramId) return undefined;

        const identifySocket = () => socket.emit("auth_user", telegramId);
        socket.on("connect", identifySocket);
        if (socket.connected) identifySocket();

        return () => {
            socket.off("connect", identifySocket);
        };
    }, [telegramId]);

    const value = {
        user,
        telegramId,     // 🔥 MAIN THING YOU NEED
        telegramUser,   // optional
        loading,
        error
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};
