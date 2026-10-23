"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import "./manager-home-simple.css";
import "./manager-coupons.css";
import { Icon } from "@/components/delivery/icons";
import { ModalPanel } from "@/components/delivery/modal-panel";
import {
  type CouponInput,
  fetchCouponAdmin,
  saveCoupon,
  setCouponActive,
} from "@/lib/delivery/actions";
import { currency } from "@/lib/delivery/format";
import {
  type CouponForm,
  type CouponKind,
  couponHeadline,
  couponState,
  emptyCouponForm,
  normalizeCouponCode,
  validateCouponForm,
} from "@/lib/delivery/rewards";
import { createClient } from "@/lib/supabase/client";

type CouponRow = Awaited<ReturnType<typeof fetchCouponAdmin>>[number];

const STATE_LABEL = {
  active: "Active",
  off: "Turned off",
  scheduled: "Scheduled",
  expired: "Expired",
  used_up: "Fully used",
} as const;

const KIND_LABEL: Record<CouponKind, string> = {
  percent: "Percent off the fee",
  fixed: "Fixed amount off the fee",
  free_delivery: "Free delivery",
};

/** `datetime-local` wants local wall time without a zone. */
const toLocalInput = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";
const fromLocalInput = (text: string) =>
  text ? new Date(text).toISOString() : null;
const optionalNumber = (text: string) =>
  text.trim() === "" ? null : Number(text);

function formFrom(coupon: CouponRow): CouponForm {
  return {
    code: coupon.code,
    kind: coupon.kind as CouponKind,
    value: coupon.kind === "free_delivery" ? "" : String(coupon.value),
    minFee: coupon.min_fee ? String(coupon.min_fee) : "",
    maxDiscount: coupon.max_discount ? String(coupon.max_discount) : "",
    startsAt: toLocalInput(coupon.starts_at),
    endsAt: toLocalInput(coupon.ends_at),
    maxRedemptions: coupon.max_redemptions
      ? String(coupon.max_redemptions)
      : "",
    perCustomerLimit: coupon.per_customer_limit
      ? String(coupon.per_customer_limit)
      : "",
  };
}

function CouponSheet({
  coupon,
  onClose,
  onSaved,
}: {
  coupon: CouponRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CouponForm>(
    coupon ? formFrom(coupon) : emptyCouponForm,
  );
  const [errors, setErrors] = useState<ReturnType<typeof validateCouponForm>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = (patch: Partial<CouponForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const found = validateCouponForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure(null);
    const input: CouponInput = {
      code: normalizeCouponCode(form.code),
      kind: form.kind,
      value: Number(form.value) || 0,
      minFee: Number(form.minFee) || 0,
      maxDiscount: optionalNumber(form.maxDiscount),
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      maxRedemptions: optionalNumber(form.maxRedemptions),
      perCustomerLimit: optionalNumber(form.perCustomerLimit),
    };
    try {
      await saveCoupon(createClient(), input, coupon?.id);
      onSaved();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not save.");
      setSaving(false);
    }
  }

  const field = (name: keyof CouponForm) => ({
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `coupon-${name}-error` : undefined,
  });
  const error = (name: keyof CouponForm) =>
    errors[name] ? (
      <span id={`coupon-${name}-error`} className="coupon-field-error">
        {errors[name]}
      </span>
    ) : null;

  return (
    <ModalPanel
      titleId="coupon-sheet-title"
      className="coupon-sheet"
      onClose={onClose}
    >
      <header>
        <h2 id="coupon-sheet-title">
          {coupon ? `Edit ${coupon.code}` : "New coupon"}
        </h2>
        <button
          type="button"
          className="icon-button modal-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="close" size={18} />
        </button>
      </header>
      <form className="coupon-form" onSubmit={submit} noValidate>
        <label>
          Code
          <input
            value={form.code}
            onChange={(event) => set({ code: event.target.value })}
            autoCapitalize="characters"
            maxLength={24}
            {...field("code")}
          />
          {error("code")}
        </label>
        <label>
          Discount type
          <select
            value={form.kind}
            onChange={(event) =>
              set({ kind: event.target.value as CouponKind })
            }
          >
            {(Object.keys(KIND_LABEL) as CouponKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>
        {form.kind !== "free_delivery" && (
          <label>
            {form.kind === "percent" ? "Percent (1-100)" : "Amount (MMK)"}
            <input
              inputMode="numeric"
              value={form.value}
              onChange={(event) => set({ value: event.target.value })}
              {...field("value")}
            />
            {error("value")}
          </label>
        )}
        <div className="coupon-row">
          <label>
            Minimum fee (MMK)
            <input
              inputMode="numeric"
              value={form.minFee}
              onChange={(event) => set({ minFee: event.target.value })}
              {...field("minFee")}
            />
            {error("minFee")}
          </label>
          <label>
            Largest discount (MMK)
            <input
              inputMode="numeric"
              value={form.maxDiscount}
              onChange={(event) => set({ maxDiscount: event.target.value })}
              {...field("maxDiscount")}
            />
            {error("maxDiscount")}
          </label>
        </div>
        <div className="coupon-row">
          <label>
            Starts
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => set({ startsAt: event.target.value })}
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => set({ endsAt: event.target.value })}
              {...field("endsAt")}
            />
            {error("endsAt")}
          </label>
        </div>
        <div className="coupon-row">
          <label>
            Total uses
            <input
              inputMode="numeric"
              value={form.maxRedemptions}
              onChange={(event) => set({ maxRedemptions: event.target.value })}
              {...field("maxRedemptions")}
            />
            {error("maxRedemptions")}
          </label>
          <label>
            Uses per customer
            <input
              inputMode="numeric"
              value={form.perCustomerLimit}
              onChange={(event) =>
                set({ perCustomerLimit: event.target.value })
              }
              {...field("perCustomerLimit")}
            />
            {error("perCustomerLimit")}
          </label>
        </div>
        {failure && (
          <p className="coupon-field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="coupon-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? "Saving…" : "Save coupon"}
          </button>
        </div>
      </form>
    </ModalPanel>
  );
}

/** Manager: create coupons, see how they are used, and turn them on or off. */
export function ManagerCoupons({ live }: { live: boolean }) {
  const [rows, setRows] = useState<CouponRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);
  const [confirmOff, setConfirmOff] = useState<CouponRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchCouponAdmin(createClient()));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (live) void load();
  }, [live, load]);

  async function toggle(coupon: CouponRow, active: boolean) {
    setActionError(null);
    try {
      await setCouponActive(createClient(), coupon.id, active);
      setConfirmOff(null);
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Could not update the coupon.",
      );
    }
  }

  return (
    <div className="mh-page">
      <section className="mh-card" aria-labelledby="coupons-heading">
        <header className="mh-card-head">
          <div className="mh-card-title">
            <h2 id="coupons-heading">Coupons</h2>
            <p>
              Discounts on the delivery fee. Customers type a code at checkout
              or pick one from their Rewards page.
            </p>
          </div>
          <button
            type="button"
            className="button primary"
            disabled={!live}
            onClick={() => setEditing("new")}
          >
            New coupon
          </button>
        </header>
        {actionError && (
          <p className="coupon-field-error" role="alert">
            {actionError}
          </p>
        )}
        {!live ? (
          <p className="coupon-empty">
            Coupons need a live connection. Sign in with a manager account.
          </p>
        ) : loadError ? (
          <p className="coupon-empty" role="alert">
            Coupons could not be loaded.{" "}
            <button
              type="button"
              className="button"
              onClick={() => void load()}
            >
              Try again
            </button>
          </p>
        ) : rows === null ? (
          <p className="coupon-empty">Loading coupons…</p>
        ) : rows.length === 0 ? (
          <p className="coupon-empty">
            No coupons yet. Create one to offer a discount.
          </p>
        ) : (
          <table className="coupon-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Offer</th>
                <th scope="col">Used</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((coupon) => {
                const state = couponState({
                  active: coupon.active,
                  startsAt: coupon.starts_at,
                  endsAt: coupon.ends_at,
                  maxRedemptions: coupon.max_redemptions,
                  redemptions: coupon.redemptions,
                });
                return (
                  <tr key={coupon.id}>
                    <td className="coupon-code" data-label="Code">
                      {coupon.code}
                    </td>
                    <td data-label="Offer">
                      {couponHeadline({
                        kind: coupon.kind as CouponKind,
                        value: coupon.value,
                        maxDiscount: coupon.max_discount,
                      })}
                    </td>
                    <td data-label="Used">
                      {coupon.redemptions}
                      {coupon.max_redemptions
                        ? ` of ${coupon.max_redemptions}`
                        : ""}
                      {coupon.discounted > 0 && (
                        <>
                          <br />
                          <small>
                            {currency.format(coupon.discounted)} off
                          </small>
                        </>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`coupon-state is-${state}`}>
                        {STATE_LABEL[state]}
                      </span>
                    </td>
                    <td className="coupon-actions-cell">
                      <button
                        type="button"
                        className="button"
                        onClick={() => setEditing(coupon)}
                        aria-label={`Edit ${coupon.code}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={() =>
                          coupon.active
                            ? setConfirmOff(coupon)
                            : void toggle(coupon, true)
                        }
                        aria-label={`${coupon.active ? "Turn off" : "Turn on"} ${coupon.code}`}
                      >
                        {coupon.active ? "Turn off" : "Turn on"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <CouponSheet
          coupon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {confirmOff && (
        <ModalPanel
          titleId="coupon-off-title"
          className="coupon-sheet"
          onClose={() => setConfirmOff(null)}
        >
          <h2 id="coupon-off-title">Turn off {confirmOff.code}?</h2>
          <p>
            Customers can no longer use this code. Orders that already used it
            keep their discount.
          </p>
          <div className="coupon-actions coupon-form">
            <button
              type="button"
              className="button"
              onClick={() => setConfirmOff(null)}
            >
              Keep on
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => void toggle(confirmOff, false)}
            >
              Turn off
            </button>
          </div>
        </ModalPanel>
      )}
    </div>
  );
}
