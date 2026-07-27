import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "./raffleApi";
import { socket } from "./socket";
import "./Raffle.css";

export function usePaymentNumbers() {
  const [paymentNumbers, setPaymentNumbers] = useState([]);
  const [loadingPaymentNumbers, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/payment-numbers`, {
        headers: { Accept: "application/json" },
      });
      const data = await response.json();
      if (response.ok && data.success) setPaymentNumbers(data.paymentNumbers || []);
    } catch (_) {
      // Payment pages remain usable for receipt validation if the list is temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    socket.on("payment_numbers_updated", load);
    return () => socket.off("payment_numbers_updated", load);
  }, [load]);

  return { paymentNumbers, loadingPaymentNumbers, reloadPaymentNumbers: load };
}

export function PaymentNumberList({ paymentNumbers, loading = false }) {
  if (loading) {
    return <div className="customer-payment-numbers muted">Loading payment numbers…</div>;
  }

  if (!paymentNumbers.length) {
    return <div className="customer-payment-numbers empty">Payment number is currently unavailable.</div>;
  }

  return (
    <div className="customer-payment-numbers">
      {paymentNumbers.map((entry) => (
        <div key={entry.id}>
          <strong>{entry.phone}</strong>
          {entry.label && <small>{entry.label}</small>}
        </div>
      ))}
    </div>
  );
}
