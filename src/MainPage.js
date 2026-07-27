import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import TournamentShell from "./TournamentShell";
import { useUser } from "./contexts/UserContext";
import { useLanguage } from "./contexts/LanguageContext";
import { useRaffles } from "./useRaffles";
import { API_BASE_URL, mediaUrl, readJson, telegramHeaders, userQuery } from "./raffleApi";
import ResponsiveImage from "./ResponsiveImage";
import { socket } from "./socket";

function maskPhoneLastTwoDigits(value) {
  if (!value) return "—";
  const characters = String(value).split("");
  let digitsToMask = 2;
  for (let index = characters.length - 1; index >= 0 && digitsToMask > 0; index -= 1) {
    if (/\d/.test(characters[index])) {
      characters[index] = "•";
      digitsToMask -= 1;
    }
  }
  return characters.join("");
}

function RaffleCard({ raffle, onOpen, onDraw, formatCurrency, t, now }) {
  const isOnDraw = Boolean(raffle.drawAt && now >= new Date(raffle.drawAt).getTime());
  const handleOpen = () => isOnDraw ? onDraw() : onOpen(raffle);
  return (
    <article className="raffle-card">
      <button className="raffle-card-open" type="button" onClick={handleOpen}>
        <div className="raffle-card-image"><ResponsiveImage path={raffle.coverImageUrl} alt={raffle.itemName} sizes="(max-width: 720px) 50vw, 25vw" /><span className={`raffle-card-draw-status ${isOnDraw ? "drawing" : ""}`}>{isOnDraw ? t("raffle.ui.onDraw", "On draw") : t("raffle.ui.open", "Open")}</span></div>
        <div className="raffle-card-body">
          <h2>{raffle.itemName}</h2>
          <strong className="raffle-card-ticket-price">{formatCurrency(raffle.ticketPrice)}</strong>
          {raffle.drawAt && <time className="raffle-card-draw-date" dateTime={raffle.drawAt}>{t("raffle.ui.finalDraw", "Final draw")}: {new Date(raffle.drawAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>}
          <div className="raffle-card-stats">
            <div><span>{t("raffle.ui.left", "Left")}</span><strong>{raffle.availableCount}</strong></div>
            <div><span>{t("raffle.ui.sold", "Sold")}</span><strong>{raffle.reservedCount}</strong></div>
          </div>
        </div>
      </button>
      <button className="wc-button raffle-card-cta" type="button" onClick={handleOpen}>{isOnDraw ? t("raffle.ui.goToDraw", "Go to draw") : t("raffle.ui.details", "Details")}</button>
    </article>
  );
}

function NumberPicker({ raffle, numbers, selectedNumber, onSelect, t }) {
  const numberGridRef = useRef(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const [columns, setColumns] = useState(() => {
    if (window.innerWidth <= 400) return 5;
    if (window.innerWidth <= 720) return 6;
    return 10;
  });
  const hasMoreRows = numbers.length > columns * 6;
  const updateMoreBelow = useCallback(() => {
    const grid = numberGridRef.current;
    if (!grid) return;
    setHasMoreBelow(grid.scrollTop + grid.clientHeight < grid.scrollHeight - 2);
  }, []);

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth <= 400) setColumns(5);
      else if (window.innerWidth <= 720) setColumns(6);
      else setColumns(10);
    };
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  useEffect(() => {
    const grid = numberGridRef.current;
    if (!grid) return;
    grid.scrollTop = 0;
    updateMoreBelow();
  }, [raffle.id, columns, updateMoreBelow]);

  useEffect(() => {
    updateMoreBelow();
  }, [numbers.length, columns, updateMoreBelow]);

  const showNextRows = () => {
    const grid = numberGridRef.current;
    if (!grid) return;
    grid.scrollBy({ top: grid.clientHeight, behavior: "smooth" });
  };

  return (
    <div className="raffle-number-picker">
      <div className="number-legend">
        <span><i className="available" /> {t("raffle.ui.available", "Available")}</span>
        <span><i className="taken" /> {t("raffle.ui.taken", "Taken")}</span>
        <span><i className="selected" /> {t("raffle.ui.selected", "Selected")}</span>
      </div>
      <div className={`number-grid-shell ${hasMoreBelow ? "has-more" : ""}`}>
        <div className={`number-grid compact ${hasMoreRows ? "scrollable" : ""}`} ref={numberGridRef} onScroll={updateMoreBelow}>
          {numbers.map((entry) => <button key={entry.number} type="button" className={`${entry.status} ${selectedNumber === entry.number ? "selected" : ""}`} disabled={entry.status !== "available"} onClick={() => onSelect(entry.number)} aria-label={t("raffle.ui.numberAria", "Number {{number}}, {{status}}", { number: entry.number, status: entry.status })}>{entry.number}</button>)}
        </div>
        {hasMoreBelow && <button className="number-grid-toggle" type="button" onClick={showNextRows} aria-label={t("raffle.ui.showMoreNumbers", "Show more numbers")} title={t("raffle.ui.showMoreNumbers", "Show more numbers")}><span aria-hidden="true">⌄</span></button>}
      </div>
      <p className="number-picker-help">{t("raffle.ui.numberHelp", "Choose one number from 1 to {{limit}}. Once saved, the ticket is final.", { limit: raffle.ticketLimit })}</p>
    </div>
  );
}

function MainPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { formatCurrency, t } = useLanguage();
  const { raffles, loading, error, reload } = useRaffles();
  const [activeRaffle, setActiveRaffle] = useState(null);
  const [step, setStep] = useState("select_number");
  const [paymentMode, setPaymentMode] = useState("text");
  const [receipt, setReceipt] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [preview, setPreview] = useState("");
  const [purchase, setPurchase] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [success, setSuccess] = useState("");
  const [previousWinners, setPreviousWinners] = useState([]);
  const [showAllItems, setShowAllItems] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [phone, setPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [now, setNow] = useState(Date.now());
  const openRaffles = useMemo(() => raffles.filter((raffle) => raffle.status === "open"), [raffles]);
  const visibleRaffles = showAllItems ? openRaffles : openRaffles.slice(0, 4);
  const activeImages = useMemo(() => {
    if (!activeRaffle) return [];
    return [...new Set([activeRaffle.coverImageUrl, ...(activeRaffle.galleryImageUrls || [])].filter(Boolean))].map(mediaUrl);
  }, [activeRaffle]);
  const accountPhone = user?.phone || user?.phoneNumber || "";
  const needsPhone = !accountPhone && !phoneSaved;

  const loadPurchases = useCallback(async () => {
    if (!user?.telegramId) return;
    try {
      const data = await readJson(await fetch(`${API_BASE_URL}/users/me/raffle-tickets${userQuery(user)}`, { headers: telegramHeaders(user) }), t("raffle.ui.failedTickets", "Failed to load your tickets."));
      setPendingPurchases((data.purchases || []).filter((entry) => entry.status === "pending_number"));
    } catch (_) { setPendingPurchases([]); }
  }, [t, user]);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (accountPhone) {
      setPhone(accountPhone);
      setPhoneSaved(true);
    }
  }, [accountPhone]);
  useEffect(() => {
    let cancelled = false;
    const loadWinners = () => fetch(`${API_BASE_URL}/raffle-winners`)
      .then((response) => readJson(response, t("raffle.ui.failedWinners", "Failed to load winners.")))
      .then((data) => { if (!cancelled) setPreviousWinners((data.winners || []).slice(0, 4)); })
      .catch(() => { if (!cancelled) setPreviousWinners([]); });
    loadWinners();
    socket.on("raffle_updated", loadWinners);
    socket.on("sync_required", loadWinners);
    return () => {
      cancelled = true;
      socket.off("raffle_updated", loadWinners);
      socket.off("sync_required", loadWinners);
    };
  }, [t]);

  useEffect(() => {
    if (!screenshot) { setPreview(""); return undefined; }
    const url = URL.createObjectURL(screenshot); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const resetModal = () => {
    setStep("select_number"); setPaymentMode("text"); setReceipt(""); setScreenshot(null);
    setPurchase(null); setNumbers([]); setSelectedNumber(null); setModalError(""); setDescriptionExpanded(false); setGalleryIndex(0);
  };
  const closeModal = () => {
    if (busy) return;
    setActiveRaffle(null); resetModal(); loadPurchases();
  };
  const loadNumbers = useCallback(async (raffle) => {
    if (!raffle?.id) return;
    const data = await readJson(await fetch(`${API_BASE_URL}/raffles/${raffle.id}/numbers${userQuery(user)}`, { headers: telegramHeaders(user) }), t("raffle.ui.failedNumbers", "Failed to load available numbers."));
    setNumbers(data.numbers || []);
    return data;
  }, [t, user]);

  // Live tickets + taken numbers for all connected users (no page refresh).
  useEffect(() => {
    const onRaffleUpdated = (payload = {}) => {
      loadPurchases();
      if (!activeRaffle) return;
      if (payload.raffleId && payload.raffleId !== activeRaffle.id) return;
      if (payload.raffle) {
        if (payload.raffle.status && payload.raffle.status !== "open") {
          setActiveRaffle(null);
          setNumbers([]);
          setSelectedNumber(null);
          return;
        }
        setActiveRaffle((current) => (current ? { ...current, ...payload.raffle } : current));
      }
      if (Array.isArray(payload.takenNumbers)) {
        const taken = new Set(payload.takenNumbers.map(Number));
        setNumbers((current) => {
          const limit = Number(payload.raffle?.ticketLimit || activeRaffle.ticketLimit || current.length);
          const previous = new Map(current.map((entry) => [Number(entry.number), entry.status]));
          return Array.from({ length: limit }, (_, index) => {
            const number = index + 1;
            const priorStatus = previous.get(number);
            return {
              number,
              status: priorStatus === "yours" ? "yours" : taken.has(number) ? "taken" : "available",
            };
          });
        });
      }
      loadNumbers(activeRaffle)
        .then((data) => {
          const list = data?.numbers || [];
          setSelectedNumber((current) => {
            if (!current) return current;
            const entry = list.find((item) => Number(item.number) === Number(current));
            if (!entry || entry.status === "available" || entry.status === "yours") return current;
            return null;
          });
        })
        .catch(() => {});
    };
    const reconcile = () => {
      loadPurchases();
      if (activeRaffle) loadNumbers(activeRaffle).catch(() => {});
    };
    socket.on("raffle_updated", onRaffleUpdated);
    socket.on("sync_required", reconcile);
    return () => {
      socket.off("raffle_updated", onRaffleUpdated);
      socket.off("sync_required", reconcile);
    };
  }, [activeRaffle, loadNumbers, loadPurchases]);
  const openRaffle = async (raffle) => {
    resetModal(); setActiveRaffle(raffle);
    try { await loadNumbers(raffle); } catch (err) { setModalError(err.message); }
  };
  const selectNumber = (number) => {
    setSelectedNumber((current) => current === number ? null : number);
    setModalError("");
  };
  const resumePurchase = async (pending) => {
    setActiveRaffle(pending.raffle); setPurchase(pending); setStep("legacy_number"); setSelectedNumber(null); setModalError("");
    try { await loadNumbers(pending.raffle); } catch (err) { setModalError(err.message); }
  };
  const extractScreenshot = async () => {
    const form = new FormData(); form.append("screenshot", screenshot);
    const data = await readJson(await fetch(`${API_BASE_URL}/ocr-screenshot`, { method: "POST", body: form }), t("raffle.ui.screenshotReadFailed", "Could not read the screenshot."));
    return data.transactionId;
  };
  const showSuccess = async (number, itemName) => {
    setActiveRaffle(null); resetModal();
    setSuccess(t("raffle.ui.success", "Ticket #{{number}} is saved for {{item}}. Good luck!", { number, item: itemName }));
    await Promise.all([reload(), loadPurchases()]);
  };
  const validatePayment = async () => {
    if (!user?.telegramId) { setModalError(t("raffle.ui.telegramRequired", "Open this app from Telegram before buying a ticket.")); return; }
    if (!selectedNumber) { setModalError(t("raffle.ui.chooseAvailable", "Choose an available number first.")); setStep("select_number"); return; }
    if (needsPhone && !/^\+?[\d\s-]{9,18}$/.test(phone.trim())) { setModalError(t("raffle.ui.phoneRequired", "Enter a valid phone number before continuing.")); return; }
    if (paymentMode === "text" && !receipt.trim()) { setModalError(t("raffle.ui.pasteReceipt", "Paste the Telebirr message or link first.")); return; }
    if (paymentMode === "screenshot" && !screenshot) { setModalError(t("raffle.ui.uploadScreenshot", "Upload a Telebirr screenshot first.")); return; }
    setBusy(true); setModalError("");
    try {
      const receiptTextOrLink = paymentMode === "screenshot" ? await extractScreenshot() : receipt.trim();
      const data = await readJson(await fetch(`${API_BASE_URL}/raffles/${activeRaffle.id}/payments/validate`, { method: "POST", headers: telegramHeaders(user, true), body: JSON.stringify({ userId: user.telegramId, receiptTextOrLink, phone: needsPhone ? phone.trim() : undefined }) }), t("raffle.ui.paymentFailed", "Payment could not be validated."));
      const paidPurchase = data.purchase;
      if (paidPurchase?.phone) {
        setPhone(paidPurchase.phone);
        setPhoneSaved(true);
      }
      await readJson(await fetch(`${API_BASE_URL}/raffles/${activeRaffle.id}/purchases/${paidPurchase.purchaseId || paidPurchase.id}/number`, { method: "POST", headers: telegramHeaders(user, true), body: JSON.stringify({ userId: user.telegramId, number: selectedNumber }) }), t("raffle.ui.saveFailed", "Could not save your ticket number."));
      await showSuccess(selectedNumber, activeRaffle.itemName);
    } catch (err) { setModalError(err.message); await loadPurchases(); } finally { setBusy(false); }
  };
  const saveLegacyNumber = async () => {
    if (!selectedNumber) { setModalError(t("raffle.ui.chooseAvailable", "Choose an available number first.")); return; }
    setBusy(true); setModalError("");
    try {
      await readJson(await fetch(`${API_BASE_URL}/raffles/${activeRaffle.id}/purchases/${purchase.purchaseId || purchase.id}/number`, { method: "POST", headers: telegramHeaders(user, true), body: JSON.stringify({ userId: user.telegramId, number: selectedNumber }) }), t("raffle.ui.saveFailed", "Could not save your ticket number."));
      await showSuccess(selectedNumber, activeRaffle.itemName);
    } catch (err) {
      setModalError(err.message); try { await loadNumbers(activeRaffle); } catch (_) { /* preserve assignment error */ }
      setSelectedNumber(null);
    } finally { setBusy(false); }
  };

  return (
    <TournamentShell>
      {success && createPortal(<div className="raffle-success-layer" role="status"><div className="raffle-success-card"><span className="raffle-success-logo"><img src="/brand/mgnot-mark.png" alt="" /></span><h2>{t("raffle.ui.successTitle", "Ticket confirmed!")}</h2><p>{success}</p><button className="wc-button raffle-go-home" type="button" onClick={() => setSuccess("")}>{t("raffle.ui.goHome", "Go home")}</button></div></div>, document.body)}
      {pendingPurchases.length > 0 && <section className="pending-entitlements"><div><strong>{t("raffle.ui.pendingTitle", "{{count}} paid ticket is waiting for a number.", { count: pendingPurchases.length })}</strong><span>{t("raffle.ui.paymentSafe", "Your payment is safe. Choose a number when you are ready.")}</span></div><div>{pendingPurchases.map((entry) => <button className="wc-button" key={`${entry.raffleId}-${entry.id}`} type="button" onClick={() => resumePurchase(entry)}>{t("raffle.ui.chooseFor", "Choose for {{item}}", { item: entry.raffle.itemName })}</button>)}</div></section>}
      {loading && <div className="wc-empty">{t("raffle.ui.loadingRaffles", "Loading item raffles...")}</div>}
      {!loading && error && <div className="wc-empty">{error}</div>}
      {!loading && !error && <>
        <div className="raffle-grid">{visibleRaffles.map((raffle) => <RaffleCard key={raffle.id} raffle={raffle} onOpen={openRaffle} onDraw={() => navigate("/draw")} formatCurrency={formatCurrency} t={t} now={now} />)}</div>
        {openRaffles.length > 4 && <div className="see-more-items"><button className="wc-button secondary" type="button" onClick={() => setShowAllItems((value) => !value)}>{showAllItems ? t("raffle.ui.showLess", "Show less") : t("raffle.ui.seeMore", "See more ({{count}})", { count: openRaffles.length - 4 })}</button></div>}
        <section className="home-winners-section">
          <div className="home-section-header"><div className="home-section-title"><span className="section-icon" aria-hidden="true">★</span><div><h2>{t("raffle.ui.previousWinners", "Previous item winners")}</h2></div></div></div>
          <div className="compact-winner-list">{previousWinners.map((raffle, index) => <article className={`compact-winner pool-color-${index % 3}`} key={raffle.id}><ResponsiveImage path={raffle.coverImageUrl} alt="" sizes="48px" /><div className="compact-winner-item"><span>{t("raffle.ui.item", "Item")}</span><strong>{raffle.itemName}</strong></div><div><span>{t("raffle.ui.winner", "Winner")}</span><strong>{raffle.winner?.displayName || t("raffle.ui.winner", "Winner")}</strong></div><div><span>{t("raffle.ui.winningNumber", "Winning number")}</span><strong>#{raffle.winningNumber}</strong></div><div><span>{t("raffle.ui.phone", "Phone")}</span><strong>{maskPhoneLastTwoDigits(raffle.winner?.phone)}</strong></div></article>)}</div>
        </section>
      </>}

      {activeRaffle && createPortal(<div className="modal-backdrop raffle-modal-layer" role="dialog" aria-modal="true" aria-labelledby="raffle-modal-title" aria-busy={busy} onClick={closeModal}><div className={`raffle-modal ${busy ? "is-processing" : ""}`} onClick={(event) => event.stopPropagation()}>
        <button className="raffle-modal-close" type="button" disabled={busy} onClick={closeModal} aria-label={t("raffle.ui.close", "Close")}>×</button>
        {step === "select_number" && <div className="raffle-step-panel"><div className="raffle-selection-gallery"><img src={activeImages[galleryIndex] || mediaUrl(activeRaffle.coverImageUrl)} alt={t("raffle.ui.galleryAlt", "{{item}} view {{number}}", { item: activeRaffle.itemName, number: galleryIndex + 1 })} />{activeImages.length > 1 && <><button className="raffle-gallery-arrow previous" type="button" onClick={() => setGalleryIndex((index) => (index - 1 + activeImages.length) % activeImages.length)} aria-label={t("raffle.ui.previousImage", "Previous image")}>‹</button><button className="raffle-gallery-arrow next" type="button" onClick={() => setGalleryIndex((index) => (index + 1) % activeImages.length)} aria-label={t("raffle.ui.nextImage", "Next image")}>›</button><div className="raffle-gallery-dots">{activeImages.map((image, index) => <button key={image} className={index === galleryIndex ? "active" : ""} type="button" onClick={() => setGalleryIndex(index)} aria-label={t("raffle.ui.showImage", "Show image {{number}}", { number: index + 1 })} />)}</div></>}</div><span className="raffle-step-label">{t("raffle.ui.chooseNumberFirst", "First, choose your number")}</span><div className="raffle-selection-item"><div><h2 id="raffle-modal-title">{activeRaffle.itemName}</h2>{activeRaffle.provider && <p className="raffle-provider-line"><span>{t("raffle.ui.provider", "Provider")}</span> {activeRaffle.provider.name} · {activeRaffle.provider.phone} · {activeRaffle.provider.location}</p>}<p className={descriptionExpanded ? "expanded" : ""}>{descriptionExpanded ? (activeRaffle.description || activeRaffle.shortDescription) : (activeRaffle.shortDescription || activeRaffle.description)}</p>{activeRaffle.description && activeRaffle.description !== activeRaffle.shortDescription && <button className="raffle-description-toggle" type="button" onClick={() => setDescriptionExpanded((value) => !value)}>{descriptionExpanded ? t("raffle.ui.showLess", "Show less") : t("raffle.ui.readMore", "See more")}</button>}</div></div><p>{t("raffle.ui.selectNumberIntro", "Select an available lucky number for this item.")}</p><NumberPicker raffle={activeRaffle} numbers={numbers} selectedNumber={selectedNumber} onSelect={selectNumber} t={t} />{modalError && <div className="raffle-error">{modalError}</div>}{selectedNumber && <div className="raffle-selection-pay"><button className="wc-button" type="button" onClick={() => setStep("payment")}>{t("raffle.ui.pay", "Pay")}</button></div>}</div>}
        {step === "payment" && <div className="raffle-step-panel"><span className="raffle-step-label">{t("raffle.ui.paymentStep", "Payment & receipt")}</span><div className="raffle-payment-summary"><img src={mediaUrl(activeRaffle.coverImageUrl)} alt="" /><div><span>{t("raffle.ui.item", "Item")}</span><strong>{activeRaffle.itemName}</strong></div><div className="raffle-summary-price"><span>{t("raffle.ui.ticketPrice", "Ticket price")}</span><strong>{formatCurrency(activeRaffle.ticketPrice)}</strong></div><div className="raffle-summary-number"><span>{t("raffle.ui.ticketNumber", "Ticket number")}</span><strong>#{selectedNumber}</strong></div></div><h2 id="raffle-modal-title">{t("raffle.ui.paymentTitle", "Pay with Telebirr")}</h2><div className="raffle-payment-destination"><p>{t("raffle.ui.payDestination", "Pay the above amount to the following number in Telebirr.")}</p><strong>+251 91 000 0000</strong><small>{t("raffle.ui.demoPaymentNumber", "Demo Telebirr number")}</small></div>{needsPhone && <label className="raffle-phone-field"><span>{t("raffle.ui.phoneLabel", "Your phone number")}</span><textarea rows="1" inputMode="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+251 9X XXX XXXX" /></label>}<p>{t("raffle.ui.paymentInstructions", "Send the exact ticket price, then paste the message/link or upload a clear screenshot.")}</p><div className="pool-payment-modes"><button className={paymentMode === "text" ? "wc-button" : "wc-button secondary"} type="button" onClick={() => setPaymentMode("text")}>{t("raffle.ui.messageLink", "Message or link")}</button><button className={paymentMode === "screenshot" ? "wc-button" : "wc-button secondary"} type="button" onClick={() => setPaymentMode("screenshot")}>{t("raffle.ui.screenshot", "Screenshot")}</button></div>{paymentMode === "text" ? <textarea className="pool-payment-textarea" value={receipt} onChange={(event) => setReceipt(event.target.value)} placeholder={t("raffle.ui.receiptPlaceholder", "Paste the Telebirr message or link...")} /> : <div className="pool-payment-upload"><input type="file" accept="image/*" onChange={(event) => setScreenshot(event.target.files?.[0] || null)} />{preview && <img src={preview} alt={t("raffle.ui.previewAlt", "Payment screenshot preview")} />}</div>}{modalError && <div className="raffle-error">{modalError}</div>}<div className="modal-actions"><button className="wc-button secondary" type="button" disabled={busy} onClick={() => { setSelectedNumber(null); setStep("select_number"); setModalError(""); }}>{t("raffle.ui.chooseAnother", "Choose another")}</button><button className="wc-button" type="button" disabled={busy} onClick={validatePayment}>{busy ? t("raffle.ui.validating", "Validating...") : t("raffle.ui.validatePayment", "Validate payment")}</button></div></div>}
        {step === "legacy_number" && <div className="raffle-step-panel"><span className="raffle-step-label">{t("raffle.ui.paymentConfirmed", "Payment confirmed")}</span><h2>{t("raffle.ui.chooseNumber", "Choose number")}</h2><p>{t("raffle.ui.numberInstructions", "One ticket place is reserved for you. Choose an available number below, or return later.")}</p><NumberPicker raffle={activeRaffle} numbers={numbers} selectedNumber={selectedNumber} onSelect={setSelectedNumber} t={t} />{modalError && <div className="raffle-error">{modalError}</div>}<div className="modal-actions"><button className="wc-button secondary" type="button" disabled={busy} onClick={closeModal}>{t("raffle.ui.chooseLater", "Choose later")}</button><button className="wc-button" type="button" disabled={busy || !selectedNumber} onClick={saveLegacyNumber}>{busy ? t("raffle.ui.saving", "Saving...") : selectedNumber ? t("raffle.ui.saveTicket", "Save ticket #{{number}}", { number: selectedNumber }) : t("raffle.ui.chooseNumber", "Choose number")}</button></div></div>}
        {busy && step === "payment" && <div className="raffle-processing" role="status" aria-live="assertive"><div className="raffle-processing-mark"><span /><img src="/brand/mgnot-mark.png" alt="" /></div><strong>{t("raffle.ui.validating", "Validating...")}</strong><p>{t("raffle.ui.verifyingPayment", "Verifying payment...")}</p></div>}
      </div></div>, document.body)}
    </TournamentShell>
  );
}

export default MainPage;
