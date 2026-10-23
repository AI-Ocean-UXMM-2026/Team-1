"use client";

import { useState } from "react";
import { PaymentLogo } from "@/components/delivery/payment-logos";
import "./payment-picker.css";
import type { FeeEstimate } from "@/lib/delivery/delivery-fee";
import { currency } from "@/lib/delivery/format";
import {
  isPrepaid,
  PAYMENT_METHODS,
  type Payer,
  type PaymentMethod,
  paymentMethodInfo,
  splitPayment,
} from "@/lib/delivery/payment-methods";

/** Payment choice for an order: prepaid wallets first, cash last. */
export function PaymentMethodPicker({
  name,
  value,
  onChange,
  awayFromHome: _awayFromHome,
  onAwayChange: _onAwayChange,
}: {
  name: string;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  awayFromHome?: boolean;
  onAwayChange?: (away: boolean) => void;
}) {
  return (
    <fieldset className="pay-picker">
      <legend>Payment</legend>
      <div className="pay-options" role="radiogroup">
        {PAYMENT_METHODS.map((method) => (
          <label
            key={method.id}
            className={`pay-option${value === method.id ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={method.id}
              checked={value === method.id}
              onChange={() => onChange(method.id)}
            />
            <PaymentLogo method={method.id} />
            <span className="pay-option-copy">
              <strong>{method.label}</strong>
              <small>{method.hint}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Line items and the total, with the cash due at the door called out. */
export function FeeBreakdown({
  estimate,
  method,
  itemCash = 0,
  paidNow,
}: {
  estimate: FeeEstimate | null;
  method: PaymentMethod;
  /** Goods money the rider collects from the receiver. */
  itemCash?: number;
  /** Prepaid only: what is paid in the app now. Defaults to all of it. */
  paidNow?: number;
}) {
  if (!estimate)
    return (
      <p className="pay-note">
        Add both addresses on the map to see the delivery fee.
      </p>
    );
  const prepaid = isPrepaid(method);
  const owed = estimate.total + itemCash;
  const split = splitPayment(owed, paidNow ?? owed);
  return (
    <section className="pay-fee" aria-label="Delivery fee">
      <h3>Delivery fee</h3>
      <dl>
        {estimate.lines.map((line) => (
          <div
            key={`${line.id}-${line.label}`}
            className={line.id === "discount" ? "pay-fee-discount" : undefined}
          >
            <dt>{line.label}</dt>
            <dd>{currency.format(line.amount)}</dd>
          </div>
        ))}
        <div className="pay-fee-total">
          <dt>Total fee</dt>
          <dd>{currency.format(estimate.total)}</dd>
        </div>
        {prepaid && itemCash > 0 && (
          <>
            <div>
              <dt>Goods</dt>
              <dd>{currency.format(itemCash)}</dd>
            </div>
            <div className="pay-fee-total">
              <dt>Total to pay</dt>
              <dd>{currency.format(owed)}</dd>
            </div>
          </>
        )}
        {prepaid && split.cashDue > 0 && (
          <>
            <div>
              <dt>Pay now with {paymentMethodInfo(method).label}</dt>
              <dd>−{currency.format(split.paid)}</dd>
            </div>
            <div className="pay-fee-total">
              <dt>Cash at the door</dt>
              <dd>{currency.format(split.cashDue)}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="pay-fee-due">
        {!prepaid
          ? `Pay the rider ${currency.format(owed)} in cash${itemCash > 0 ? " (fee plus goods)" : ""}.`
          : split.cashDue === 0
            ? "Pay it all online. Nothing to pay at the door."
            : `The rest is cash on delivery: the rider collects ${currency.format(split.cashDue)}.`}
      </p>
      <p className="pay-fee-meta">
        About {estimate.distanceKm.toFixed(1)} km by road. Estimate; the final
        fee is confirmed when a rider is assigned.
      </p>
    </section>
  );
}

/** Who pays the delivery: the sender now, or someone else later. */
export function PayerChoice({
  name,
  value,
  onChange,
}: {
  name: string;
  value: Payer;
  onChange: (payer: Payer) => void;
}) {
  const options: { id: Payer; label: string; hint: string }[] = [
    { id: "me", label: "I’ll pay", hint: "Online now, or cash at the door." },
    {
      id: "other",
      label: "Someone else pays",
      hint: "The receiver, or anyone you share a pay link with.",
    },
  ];
  return (
    <fieldset className="pay-picker">
      <legend>Who pays?</legend>
      <div className="pay-options" role="radiogroup">
        {options.map((option) => (
          <label
            key={option.id}
            className={`pay-option${value === option.id ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className="pay-option-copy">
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Shown once the request is sent and the tracking code exists. Pay now opens
 * the steps for the chosen app with the amount and reference filled in; the
 * pay link lets someone else do the same from anywhere. Payment is confirmed
 * by staff, so this says so instead of pretending the order is already paid.
 */
export function PayAfterRequest({
  code,
  balance,
  payOnline,
  method,
}: {
  code: string;
  balance: number;
  payOnline: number;
  method: PaymentMethod;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (balance <= 0) return null;
  const label = paymentMethodInfo(method).label;
  const atDoor = balance - payOnline;

  async function share() {
    const url = `${window.location.origin}/track?code=${encodeURIComponent(code)}&pay=1`;
    const text = `Pay ${currency.format(balance)} for parcel ${code} on Oern (MMQR or CTZPay)`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Pay for a delivery", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}: ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sharing was cancelled or is unavailable; nothing to recover.
    }
  }

  return (
    <section className="pay-after" aria-label="Pay for this delivery">
      <h3>Pay for this delivery</h3>
      {payOnline > 0 && (
        <>
          <button
            type="button"
            className="pay-after-primary"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <PaymentLogo method={method} size={32} />
            Pay {currency.format(payOnline)} now with {label}
          </button>
          {open && (
            <ol className="pay-steps">
              <li>
                Open your bank or wallet app and send{" "}
                <strong>{currency.format(payOnline)}</strong> with {label}.
              </li>
              <li>
                Use <strong>{code}</strong> as the reference.
              </li>
              <li>
                Once it arrives, the order shows Paid and the rider collects
                less cash.
              </li>
            </ol>
          )}
        </>
      )}
      <button
        type="button"
        className="pay-after-secondary"
        onClick={() => void share()}
      >
        {copied ? "Link copied" : "Share pay link for someone else"}
      </button>
      <p className="pay-after-note">
        {atDoor > 0
          ? `Whatever is not paid online is cash at the door: ${currency.format(atDoor)} after your payment. `
          : ""}
        Online payment is not connected yet, so staff confirm it by hand.
      </p>
    </section>
  );
}

/**
 * How much to pay in the app now. Any amount up to the total is fine; what is
 * left becomes cash on delivery.
 */
export function PayNowField({
  id,
  total,
  fee,
  value,
  onChange,
}: {
  id: string;
  total: number;
  /** The delivery fee alone, offered as a shortcut when goods are owed too. */
  fee: number;
  /** As typed; empty means the whole total. */
  value: string;
  onChange: (value: string) => void;
}) {
  const { paid, cashDue } = splitPayment(
    total,
    value.trim() === "" ? total : Number(value),
  );
  const shortcuts = [
    ...(fee > 0 && fee < total ? [{ label: "Delivery fee", amount: fee }] : []),
    { label: "Full amount", amount: total },
  ];
  return (
    <section className="pay-now" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={id}>
        Pay now
      </label>
      <div className="pay-now-input">
        <span aria-hidden="true">MMK</span>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={total}
          step={1}
          value={value.trim() === "" ? String(total) : value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-split`}
        />
      </div>
      <div className="pay-now-shortcuts">
        {shortcuts.map((item) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={paid === item.amount}
            onClick={() => onChange(String(item.amount))}
          >
            {item.label} · {currency.format(item.amount)}
          </button>
        ))}
      </div>
      <output id={`${id}-split`} className="pay-now-split" aria-live="polite">
        {cashDue === 0
          ? "Paid in full. Nothing to pay at the door."
          : paid === 0
            ? `Nothing now. The rider collects ${currency.format(cashDue)} in cash.`
            : `The rider collects the other ${currency.format(cashDue)} in cash.`}
      </output>
    </section>
  );
}

/** Stand-in for the provider hand-off until MMQR and CTZPay are connected. */
export function PrepaidStub({
  method,
  amount,
}: {
  method: PaymentMethod;
  amount: number;
}) {
  if (!isPrepaid(method)) return null;
  const label = paymentMethodInfo(method).label;
  return (
    <section className="pay-stub" aria-label="Pay in app">
      <PaymentLogo method={method} size={44} />
      <div>
        <strong>
          Pay {currency.format(amount)} with {label}
        </strong>
        {method === "mmqr" && (
          <ol className="pay-steps">
            <li>Open your bank or wallet app and choose Scan.</li>
            <li>Scan the MMQR code for this order.</li>
            <li>
              Check the amount and that the reference is your tracking code.
            </li>
          </ol>
        )}
        <small>
          Online payment is not connected yet. Your request is sent now and
          payment is confirmed with the rider assignment.
        </small>
      </div>
    </section>
  );
}

/** Coupon code and loyalty points for the fee, shown before the total. */
export function RewardsControl({
  id,
  appliedCode,
  status,
  balance,
  usePoints,
  pointsUsed,
  pointsDiscount,
  onApply,
  onRemove,
  onUsePointsChange,
  showPoints = true,
}: {
  id: string;
  /** Off for staff, who apply a coupon but cannot spend a customer's points. */
  showPoints?: boolean;
  /** The code in the draft, empty when none is applied. */
  appliedCode: string;
  status:
    | { state: "none" }
    | { state: "checking" }
    | { state: "valid"; discount: number }
    | { state: "invalid"; reason: string };
  balance: number;
  usePoints: boolean;
  pointsUsed: number;
  pointsDiscount: number;
  onApply: (code: string) => void;
  onRemove: () => void;
  onUsePointsChange: (use: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  const valid = status.state === "valid";
  const showForm = !appliedCode || status.state === "invalid";
  return (
    <section className="rewards-control" aria-label="Coupon and points">
      <h3>{showPoints ? "Coupon and points" : "Coupon"}</h3>
      {valid && (
        <div className="rewards-applied">
          <span>
            <strong>{appliedCode}</strong>
            <small>Saves {currency.format(status.discount)}</small>
          </span>
          <button type="button" onClick={onRemove}>
            Remove
          </button>
        </div>
      )}
      {status.state === "checking" && (
        <output className="pay-note">Checking {appliedCode}…</output>
      )}
      {showForm && (
        <div className="rewards-form">
          <label htmlFor={id}>Coupon code</label>
          <div className="rewards-input">
            <input
              id={id}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                // Not a form: this control also sits inside the manual order form.
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (typed.trim()) onApply(typed);
              }}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={24}
              aria-invalid={status.state === "invalid"}
              aria-describedby={
                status.state === "invalid" ? `${id}-error` : undefined
              }
            />
            <button
              type="button"
              disabled={!typed.trim()}
              onClick={() => onApply(typed)}
            >
              Apply
            </button>
          </div>
          {status.state === "invalid" && (
            <p id={`${id}-error`} className="rewards-error" role="alert">
              {status.reason}
            </p>
          )}
        </div>
      )}
      {!showPoints ? null : balance > 0 ? (
        <label className="rewards-points">
          <input
            type="checkbox"
            checked={usePoints}
            onChange={(event) => onUsePointsChange(event.target.checked)}
          />
          <span>
            <strong>
              Use points
              {usePoints && pointsUsed > 0
                ? ` · save ${currency.format(pointsDiscount)}`
                : ""}
            </strong>
            <small>
              {balance.toLocaleString("en-US")} points · 1 point = 10 MMK, up to
              half the fee
            </small>
          </span>
        </label>
      ) : (
        <p className="pay-fee-meta">
          Earn 1 point for every 1,000 MMK of delivery fee once an order is
          delivered.
        </p>
      )}
    </section>
  );
}
