"use client";

import { type FormEvent, useState } from "react";

import { currency } from "@/lib/delivery/format";
import { PAYMENT_METHODS } from "@/lib/delivery/payment-methods";

const ONLINE = PAYMENT_METHODS.filter((method) => method.prepaid) as readonly {
  id: "mmqr" | "ctzpay";
  label: string;
}[];

/**
 * Staff record money that arrived from MMQR or CTZPay against an order's COD
 * balance. Until a provider confirms payments automatically, this is the step
 * that turns the order Paid and shrinks the rider's cash due.
 */
export function RecordOnlinePayment({
  balance,
  saving,
  onRecord,
}: {
  balance: number;
  saving: boolean;
  onRecord: (amount: number, method: "mmqr" | "ctzpay") => void;
}) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<"mmqr" | "ctzpay">("mmqr");
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= balance;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid && !saving) onRecord(value, method);
  }

  return (
    <form className="record-online" onSubmit={submit}>
      <strong>Paid online?</strong>
      <small>
        Record what arrived. The rider then collects only what is left.
      </small>
      <div className="record-online-row">
        <select
          aria-label="Paid with"
          value={method}
          onChange={(event) => setMethod(event.target.value as typeof method)}
        >
          {ONLINE.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          aria-label="Amount received (MMK)"
          type="number"
          inputMode="numeric"
          min={1}
          max={balance}
          step={1}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <button
          type="submit"
          className="button button-small button-primary"
          disabled={!valid || saving}
        >
          {saving ? "Saving…" : "Record"}
        </button>
      </div>
      {!valid && amount.trim() !== "" && (
        <small role="alert">
          Enter an amount from 1 to {currency.format(balance)}.
        </small>
      )}
    </form>
  );
}
