"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import "./manager-home-simple.css";
import "./manager-business.css";
import { Icon } from "@/components/delivery/icons";
import { PaymentLogo } from "@/components/delivery/payment-logos";
import {
  type BusinessProfile,
  emptyBusinessProfile,
  loadBusinessProfile,
  MAX_PICKUP_LOCATIONS,
  saveBusinessProfile,
} from "@/lib/delivery/business-profile";
import {
  buildCodLedger,
  type CodPayment,
  type CodReport,
  loadCodLedgerData,
  summariseCodLedger,
} from "@/lib/delivery/cod-ledger";
import { FEE_RULES } from "@/lib/delivery/delivery-fee";
import { currency } from "@/lib/delivery/format";
import {
  isPaymentMethod,
  orderPaymentMethod,
  PAYMENT_METHODS,
} from "@/lib/delivery/payment-methods";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { createClient } from "@/lib/supabase/client";

const RULE_ROWS = [
  ["Base fee", FEE_RULES.base, `includes ${FEE_RULES.includedKm} km`],
  ["Per extra km", FEE_RULES.perKm, "road distance, rounded up to 100"],
  ["Per extra kg", FEE_RULES.perKgOver, `after ${FEE_RULES.includedKg} kg`],
  ["Urgent", FEE_RULES.urgent, "same-hour pickup"],
  ["Cash handling", FEE_RULES.codHandling, "cash on delivery only"],
] as const;

function Panel({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mh-card" aria-labelledby={id}>
      <header className="mh-card-head">
        <div className="mh-card-title">
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function ManagerBusiness({
  orders,
  live,
}: {
  orders: DeliveryOrder[];
  live: boolean;
}) {
  const [profile, setProfile] = useState<BusinessProfile>(emptyBusinessProfile);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [payments, setPayments] = useState<CodPayment[]>([]);
  const [reports, setReports] = useState<CodReport[]>([]);

  useEffect(() => {
    setProfile(loadBusinessProfile());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!live) return;
    let active = true;
    loadCodLedgerData(createClient())
      .then((data) => {
        if (!active) return;
        setPayments(data.payments);
        setReports(data.reports);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [live]);

  const ledger = useMemo(
    () => summariseCodLedger(buildCodLedger(orders, payments, reports)),
    [orders, payments, reports],
  );
  const mix = useMemo(() => {
    const counts = { mmqr: 0, ctzpay: 0, cod: 0 };
    for (const order of orders) counts[orderPaymentMethod(order)] += 1;
    return counts;
  }, [orders]);

  function persist(next: BusinessProfile) {
    setProfile(next);
    setSaved(false);
    saveBusinessProfile(next);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const method = form.get("defaultPayment");
    persist({
      ...profile,
      name: String(form.get("name") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      defaultPayment: isPaymentMethod(method) ? method : "cod",
    });
    setSaved(true);
  }

  function addLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const address = String(data.get("address") || "").trim();
    if (!address || profile.pickupLocations.length >= MAX_PICKUP_LOCATIONS)
      return;
    persist({
      ...profile,
      pickupLocations: [
        ...profile.pickupLocations,
        {
          id: `loc-${Date.now().toString(36)}`,
          label: String(data.get("label") || "").trim() || address.slice(0, 60),
          address,
          contactName: String(data.get("contactName") || "").trim(),
          contactPhone: String(data.get("contactPhone") || "").trim(),
        },
      ],
    });
    form.reset();
  }

  const total = orders.length;
  const share = (count: number) =>
    total ? `${Math.round((count / total) * 100)}%` : "—";

  return (
    <div className="mh-page biz-page">
      <Panel
        id="biz-settle"
        title="Settlement summary"
        description="Cash riders hold for you, and how orders are being paid."
      >
        <ul className="mh-metrics">
          <li>
            <Link href="/manager/cod">
              <span className="mh-metric-label">To settle</span>
              <strong className={ledger.toSettleCount ? "is-warning" : ""}>
                {currency.format(ledger.toSettleTotal)}
              </strong>
              <small className="biz-sub">
                {ledger.toSettleCount} collected parcels
              </small>
            </Link>
          </li>
          <li>
            <Link href="/manager/cod">
              <span className="mh-metric-label">On the road</span>
              <strong>{currency.format(ledger.awaitingTotal)}</strong>
              <small className="biz-sub">Not yet collected</small>
            </Link>
          </li>
          <li>
            <Link href="/manager/cod">
              <span className="mh-metric-label">Settled</span>
              <strong>{currency.format(ledger.settledTotal)}</strong>
              <small className="biz-sub">Handed over</small>
            </Link>
          </li>
          <li>
            <Link href="/manager/cod">
              <span className="mh-metric-label">Exceptions</span>
              <strong className={ledger.exceptionCount ? "is-error" : ""}>
                {ledger.exceptionCount}
              </strong>
              <small className="biz-sub">Missing or mismatched cash</small>
            </Link>
          </li>
        </ul>
        <ul className="biz-mix" aria-label="Payment mix">
          {PAYMENT_METHODS.map((method) => (
            <li key={method.id}>
              <PaymentLogo method={method.id} size={28} />
              <span>{method.label}</span>
              <strong>{share(mix[method.id])}</strong>
              <small>{mix[method.id]} orders</small>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mh-columns">
        <div className="mh-stack">
          <Panel
            id="biz-locations"
            title="Saved pickup locations"
            description="Pick one on Create order instead of typing the address each time."
          >
            {loaded && profile.pickupLocations.length > 0 ? (
              <ul className="biz-locations">
                {profile.pickupLocations.map((location) => (
                  <li key={location.id}>
                    <span className="mh-health-copy">
                      <strong>{location.label}</strong>
                      <small>
                        {location.address}
                        {location.contactPhone && ` · ${location.contactPhone}`}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="button button-outline mh-action"
                      onClick={() =>
                        persist({
                          ...profile,
                          pickupLocations: profile.pickupLocations.filter(
                            (item) => item.id !== location.id,
                          ),
                        })
                      }
                      aria-label={`Remove ${location.label}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mh-empty">
                No saved locations yet. Add your shop or warehouse below.
              </p>
            )}
            <form className="biz-form" onSubmit={addLocation}>
              <label>
                Name
                <input name="label" placeholder="Main shop" maxLength={60} />
              </label>
              <label>
                Address
                <input name="address" required maxLength={300} />
              </label>
              <label>
                Contact name
                <input name="contactName" maxLength={120} />
              </label>
              <label>
                Contact phone
                <input name="contactPhone" inputMode="tel" maxLength={30} />
              </label>
              <button
                type="submit"
                className="button button-primary"
                disabled={
                  profile.pickupLocations.length >= MAX_PICKUP_LOCATIONS
                }
              >
                <Icon name="plus" size={16} /> Add location
              </button>
            </form>
          </Panel>

          <Panel
            id="biz-fees"
            title="Delivery fee rules"
            description="Rates used for estimates. They are placeholders until you confirm your pricing."
          >
            <div className="mh-table-wrap">
              <table className="mh-table">
                <thead>
                  <tr>
                    <th scope="col">Rule</th>
                    <th scope="col" className="mh-num">
                      Amount
                    </th>
                    <th scope="col">Applies</th>
                  </tr>
                </thead>
                <tbody>
                  {RULE_ROWS.map(([label, amount, note]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td className="mh-num">{currency.format(amount)}</td>
                      <td className="mh-muted">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="mh-stack">
          <Panel id="biz-profile" title="Business profile">
            <form
              className="biz-form biz-form-single"
              onSubmit={saveProfile}
              key={loaded ? "loaded" : "pending"}
            >
              <label>
                Business name
                <input
                  name="name"
                  defaultValue={profile.name}
                  maxLength={120}
                />
              </label>
              <label>
                Business phone
                <input
                  name="phone"
                  inputMode="tel"
                  defaultValue={profile.phone}
                  maxLength={30}
                />
              </label>
              <label>
                Usual payment method
                <select
                  name="defaultPayment"
                  defaultValue={profile.defaultPayment}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="button button-primary">
                Save profile
              </button>
              {saved && (
                <output className="biz-saved">Saved on this device.</output>
              )}
            </form>
          </Panel>
          <Panel id="biz-shortcuts" title="Shortcuts">
            <ul className="mh-health">
              <li>
                <Link href="/manager/order/create">
                  <span className="mh-health-copy">
                    <strong>Create order</strong>
                    <small>Uses your saved pickup locations</small>
                  </span>
                  <Icon name="arrow-right" size={15} />
                </Link>
              </li>
              <li>
                <Link href="/manager/cod">
                  <span className="mh-health-copy">
                    <strong>COD ledger</strong>
                    <small>Reconcile and settle cash</small>
                  </span>
                  <Icon name="arrow-right" size={15} />
                </Link>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
