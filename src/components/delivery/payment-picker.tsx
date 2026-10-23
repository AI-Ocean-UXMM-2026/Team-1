"use client";

import Link from "next/link";
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

/** One decision: pay by MMQR yourself, or pass the payment to the receiver. */
export function PayRouteChoice({
  name,
  value,
  total,
  onChange,
}: {
  name: string;
  value: "mmqr" | "receiver";
  total: number;
  onChange: (route: "mmqr" | "receiver") => void;
}) {
  const options = [
    {
      id: "mmqr" as const,
      title: `Pay ${currency.format(total)} with MMQR`,
      hint: "Scan the MMQR after the request is created.",
    },
    {
      id: "receiver" as const,
      title: "Pass to receiver",
      hint: "Share a pay link, or the receiver pays the rider in cash.",
    },
  ];
  return (
    <fieldset className="pay-picker">
      <legend>How will this be paid?</legend>
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
            {option.id === "mmqr" ? (
              <PaymentLogo method="mmqr" size={40} />
            ) : (
              <span className="pay-route-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
                  <path d="M17 8h5M19.5 5.5 22 8l-2.5 2.5" />
                </svg>
              </span>
            )}
            <span className="pay-option-copy">
              <strong>{option.title}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Pay when the request is sent, or pass and settle later from Track. */
export function PayWhenChoice({
  name,
  value,
  total,
  onChange,
}: {
  name: string;
  value: "now" | "later";
  total: number;
  onChange: (choice: "now" | "later") => void;
}) {
  const options = [
    {
      id: "now" as const,
      title: `Pay ${currency.format(total)} now`,
      hint: "Create the request, then scan its MMQR with CTZPay or another participating app. We wait for confirmation before showing Paid.",
    },
    {
      id: "later" as const,
      title: "Pay later",
      hint: "Pay from Track, share the link so the receiver can pay, or hand cash to the rider.",
    },
  ];
  return (
    <fieldset className="pay-picker">
      <legend>How would you like to pay?</legend>
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
            {option.id === "now" ? (
              <PaymentLogo method="mmqr" />
            ) : (
              <PaymentLogo method="cod" />
            )}
            <span className="pay-option-copy">
              <strong>{option.title}</strong>
              <small>{option.hint}</small>
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
  flexiblePayment = false,
}: {
  estimate: FeeEstimate | null;
  method: PaymentMethod;
  /** Goods money the rider collects from the receiver. */
  itemCash?: number;
  /** Prepaid only: what is paid in the app now. Defaults to all of it. */
  paidNow?: number;
  /** How to pay is decided later, so no method-specific line is shown. */
  flexiblePayment?: boolean;
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
  // How this is settled is the customer's next choice, so the summary never
  // claims the money has already moved; it states what is owed and stops.
  const dueLine = flexiblePayment
    ? ""
    : !prepaid
      ? `Pay the rider ${currency.format(owed)} in cash${itemCash > 0 ? " (fee plus goods)" : ""}.`
      : split.cashDue === 0
        ? `${currency.format(owed)} to pay. Nothing at the door.`
        : `The rest is cash on delivery: the rider collects ${currency.format(split.cashDue)}.`;
  return (
    <section
      className="pay-fee"
      aria-label={flexiblePayment ? "Price summary" : "Delivery fee"}
    >
      <h3>{flexiblePayment ? "Price summary" : "Delivery fee"}</h3>
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
        {(prepaid || flexiblePayment) && itemCash > 0 && (
          <>
            <div>
              <dt>{flexiblePayment ? "Goods to collect" : "Goods"}</dt>
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
      <p className="pay-fee-due" hidden={!dueLine}>
        {dueLine}
      </p>
      <p className="pay-fee-meta">
        About {estimate.distanceKm.toFixed(1)} km. Estimate; the final fee is
        confirmed when a rider is assigned.
      </p>
    </section>
  );
}

/** Who pays the delivery: the sender now, or someone else later. */
export function PayerChoice({
  name,
  value,
  amount,
  onChange,
}: {
  name: string;
  value: Payer;
  /** What the delivery costs, so the commitment names its figure. */
  amount?: number;
  onChange: (payer: Payer) => void;
}) {
  const total = amount && amount > 0 ? currency.format(amount) : null;
  const options: { id: Payer; label: string; hint: string }[] = [
    {
      id: "me",
      label: total ? `I'll pay ${total}` : "I'll pay",
      hint: "You settle it from Track, or hand cash to the rider.",
    },
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
 * Shown once the request and its payment reference exist. MMQR is the rail;
 * CTZPay is one of the participating apps that scans it. The actual scan and
 * provider confirmation live on Track, where the order balance can update.
 */
export function PayAfterRequest({
  orderId,
  code,
  balance,
  payOnline,
  method,
  passToReceiver = false,
}: {
  /** The sender handed payment to the receiver, so sharing leads. */
  passToReceiver?: boolean;
  /** When given, offers paying right away on the Track screen. */
  orderId?: string;
  code: string;
  balance: number;
  payOnline: number;
  method: PaymentMethod;
}) {
  const [copied, setCopied] = useState(false);
  if (balance <= 0) return null;
  const atDoor = balance - payOnline;
  const wantsMmqr = orderId && payOnline > 0 && isPrepaid(method);

  async function share() {
    const url = `${window.location.origin}/track?code=${encodeURIComponent(code)}&pay=1`;
    const text = `Pay ${currency.format(balance)} for parcel ${code} on Oern (MMQR, CTZPay included)`;
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
      {orderId && !passToReceiver && (
        <Link
          className="pay-after-primary"
          href={`/track?order=${encodeURIComponent(orderId)}&pay=1`}
        >
          <span className="pay-after-logo">
            <PaymentLogo method="mmqr" size={32} />
          </span>
          {wantsMmqr
            ? `Continue to MMQR · ${currency.format(payOnline)}`
            : `Pay ${currency.format(balance)} with MMQR`}
        </Link>
      )}
      <button
        type="button"
        className={passToReceiver ? "pay-after-primary" : "pay-after-secondary"}
        onClick={() => void share()}
      >
        {copied ? "Link copied" : "Share pay link for someone else"}
      </button>
      {orderId && passToReceiver && (
        <Link
          className="pay-after-secondary"
          href={`/track?order=${encodeURIComponent(orderId)}&pay=1`}
        >
          <PaymentLogo method="mmqr" size={28} />
          Pay it yourself with MMQR
        </Link>
      )}
      <p className="pay-after-note">
        {wantsMmqr
          ? `Your request is saved, but it is not paid yet. Scan the MMQR on the next screen. ${atDoor > 0 ? `The rider will collect the remaining ${currency.format(atDoor)} in cash.` : "The rider collects no cash after payment is confirmed."}`
          : `Pay online, share the link so the receiver can pay, or hand ${currency.format(balance)} to the rider in cash.`}
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
