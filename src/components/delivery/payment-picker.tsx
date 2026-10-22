"use client";

import { PaymentLogo } from "@/components/delivery/payment-logos";
import "./payment-picker.css";
import type { FeeEstimate } from "@/lib/delivery/delivery-fee";
import { currency } from "@/lib/delivery/format";
import {
  isPrepaid,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/delivery/payment-methods";

/** Payment choice for an order: prepaid wallets first, cash last. */
export function PaymentMethodPicker({
  name,
  value,
  onChange,
  awayFromHome,
  onAwayChange,
}: {
  name: string;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  awayFromHome?: boolean;
  /** Omit to hide the "away from home" switch (for staff entering orders). */
  onAwayChange?: (away: boolean) => void;
}) {
  return (
    <fieldset className="pay-picker">
      <legend>Payment</legend>
      {onAwayChange && (
        <label className="pay-away">
          <input
            type="checkbox"
            checked={Boolean(awayFromHome)}
            onChange={(event) => onAwayChange(event.target.checked)}
          />
          <span>
            <strong>I’m away from home</strong>
            <small>We’ll suggest paying in the app so no cash is needed.</small>
          </span>
        </label>
      )}
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
              <strong>
                {method.label}
                {awayFromHome && method.prepaid && method.id === "mmqr" && (
                  <em>Recommended</em>
                )}
              </strong>
              <small>{method.hint}</small>
            </span>
          </label>
        ))}
      </div>
      {awayFromHome && !isPrepaid(value) && (
        <p className="pay-note">
          Cash needs someone at the drop-off to pay the rider. If that may not
          happen, pick MMQR or CTZPay.
        </p>
      )}
    </fieldset>
  );
}

/** Line items and the total, with the cash due at the door called out. */
export function FeeBreakdown({
  estimate,
  method,
  itemCash = 0,
}: {
  estimate: FeeEstimate | null;
  method: PaymentMethod;
  /** Goods money the rider collects from the receiver. */
  itemCash?: number;
}) {
  if (!estimate)
    return (
      <p className="pay-note">
        Add both addresses on the map to see the delivery fee.
      </p>
    );
  const prepaid = isPrepaid(method);
  return (
    <section className="pay-fee" aria-label="Delivery fee">
      <h3>Delivery fee</h3>
      <dl>
        {estimate.lines.map((line) => (
          <div key={line.id}>
            <dt>{line.label}</dt>
            <dd>{currency.format(line.amount)}</dd>
          </div>
        ))}
        <div className="pay-fee-total">
          <dt>Total fee</dt>
          <dd>{currency.format(estimate.total)}</dd>
        </div>
      </dl>
      <p className="pay-fee-due">
        {prepaid
          ? "Paid in the app. The rider collects no fee."
          : `Pay the rider ${currency.format(estimate.total + itemCash)} in cash${itemCash > 0 ? " (fee plus goods)" : ""}.`}
      </p>
      <p className="pay-fee-meta">
        About {estimate.distanceKm.toFixed(1)} km by road. Estimate; the final
        fee is confirmed when a rider is assigned.
      </p>
    </section>
  );
}

/** Stand-in for the provider hand-off until CTZPay / MMQR are connected. */
export function PrepaidStub({
  method,
  amount,
}: {
  method: PaymentMethod;
  amount: number;
}) {
  if (!isPrepaid(method)) return null;
  return (
    <section className="pay-stub" aria-label="Pay in app">
      <PaymentLogo method={method} size={44} />
      <div>
        <strong>
          Pay {currency.format(amount)} with{" "}
          {method === "mmqr" ? "MMQR" : "CTZPay"}
        </strong>
        <small>
          Online payment is not connected yet. Your request is sent now and
          payment is confirmed with the rider assignment.
        </small>
      </div>
    </section>
  );
}
