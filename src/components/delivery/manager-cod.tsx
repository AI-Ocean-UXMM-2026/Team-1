"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import {
  buildCodLedger,
  type CodPayment,
  type CodReport,
  type CodRow,
  type CodState,
  loadCodLedgerData,
  settleCodPayment,
  summariseCodLedger,
} from "@/lib/delivery/cod-ledger";
import { currency } from "@/lib/delivery/format";
import {
  orderPaymentMethod,
  paymentBadge,
} from "@/lib/delivery/payment-methods";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { createClient } from "@/lib/supabase/client";

const STATE_LABEL: Record<CodState, string> = {
  not_collected: "Cash not recorded",
  to_settle: "Collected · to settle",
  awaiting: "On the road",
  settled: "Settled",
};

const STATE_TONE: Record<CodState, string> = {
  not_collected: "is-error",
  to_settle: "is-warning",
  awaiting: "is-neutral",
  settled: "is-success",
};

function differenceText(row: CodRow) {
  if (row.state === "awaiting") return "—";
  if (row.difference === 0) return "Matches";
  const amount = currency.format(Math.abs(row.difference));
  return row.difference < 0 ? `${amount} short` : `${amount} over`;
}

export function CodLedgerView({
  orders,
  live,
}: {
  orders: DeliveryOrder[];
  live: boolean;
}) {
  const [payments, setPayments] = useState<CodPayment[]>([]);
  const [reports, setReports] = useState<CodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmingRider, setConfirmingRider] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [viewMode, setViewMode] = useState<"orders" | "riders">("orders");

  useEffect(() => {
    void orders;
    void reloadKey;
    if (!live) return;
    let active = true;
    setLoading(true);
    loadCodLedgerData(createClient())
      .then((data) => {
        if (!active) return;
        setPayments(data.payments);
        setReports(data.reports);
        setError(null);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load cash on delivery.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [live, orders, reloadKey]);

  const rows = useMemo(
    () => buildCodLedger(orders, payments, reports),
    [orders, payments, reports],
  );
  const summary = useMemo(() => summariseCodLedger(rows), [rows]);

  const riderGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        driverId: string;
        driverName: string;
        rows: CodRow[];
        toSettleCount: number;
        toSettleTotal: number;
        awaitingCount: number;
        awaitingTotal: number;
        settledCount: number;
        settledTotal: number;
        hasDiscrepancy: boolean;
      }
    >();

    for (const row of rows) {
      const driverId = row.order.driver_id || "unassigned";
      const driverName = row.order.driver_name || "Unassigned rider";
      let group = map.get(driverId);
      if (!group) {
        group = {
          driverId,
          driverName,
          rows: [],
          toSettleCount: 0,
          toSettleTotal: 0,
          awaitingCount: 0,
          awaitingTotal: 0,
          settledCount: 0,
          settledTotal: 0,
          hasDiscrepancy: false,
        };
        map.set(driverId, group);
      }
      group.rows.push(row);
      if (row.state === "to_settle") {
        group.toSettleCount += 1;
        group.toSettleTotal += row.collected ?? 0;
      } else if (row.state === "awaiting") {
        group.awaitingCount += 1;
        group.awaitingTotal += row.expected;
      } else if (row.state === "settled") {
        group.settledCount += 1;
        group.settledTotal += row.collected ?? row.expected;
      }
      if (row.difference !== 0) {
        group.hasDiscrepancy = true;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.toSettleTotal - a.toSettleTotal || b.toSettleCount - a.toSettleCount,
    );
  }, [rows]);

  async function settle(row: CodRow) {
    if (settling) return;
    setSettling(row.order.id);
    setNotice(null);
    setError(null);
    try {
      await settleCodPayment(createClient(), row.order.id);
      setConfirming(null);
      setNotice(
        `${currency.format(row.collected ?? 0)} for ${row.order.tracking_code} marked as handed over.`,
      );
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not settle this cash.",
      );
    } finally {
      setSettling(null);
    }
  }

  async function settleRiderShift(group: (typeof riderGroups)[number]) {
    if (settling) return;
    const toSettleRows = group.rows.filter((r) => r.state === "to_settle");
    if (!toSettleRows.length) return;
    setSettling(group.driverId);
    setNotice(null);
    setError(null);
    try {
      const client = createClient();
      for (const r of toSettleRows) {
        await settleCodPayment(client, r.order.id);
      }
      setConfirmingRider(null);
      setNotice(
        `Shift settled: ${currency.format(group.toSettleTotal)} from ${group.driverName} (${toSettleRows.length} parcels) marked as handed over.`,
      );
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not settle shift for this rider.",
      );
    } finally {
      setSettling(null);
    }
  }

  return (
    <div className="cod-ledger">
      <section className="dash-card" aria-label="Cash on delivery summary">
        <div className="dash-kpi-grid">
          <div className="dash-kpi">
            <span className="dash-kpi-label">To settle</span>
            <strong className="dash-kpi-value">
              {currency.format(summary.toSettleTotal)}
            </strong>
            <span className="dash-kpi-hint">
              {summary.toSettleCount} collected, not handed over
            </span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">On the road</span>
            <strong className="dash-kpi-value">
              {currency.format(summary.awaitingTotal)}
            </strong>
            <span className="dash-kpi-hint">Still to be collected</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Settled</span>
            <strong className="dash-kpi-value">
              {currency.format(summary.settledTotal)}
            </strong>
            <span className="dash-kpi-hint">Handed over</span>
          </div>
          <div
            className={`dash-kpi ${summary.exceptionCount ? "is-warning" : ""}`}
          >
            <span className="dash-kpi-label">Exceptions</span>
            <strong className="dash-kpi-value">{summary.exceptionCount}</strong>
            <span className="dash-kpi-hint">Short, over or missing</span>
          </div>
        </div>
      </section>

      <div className="dash-notice-slot" aria-live="polite">
        {notice && (
          <p className="dash-notice is-success">
            <Icon name="check" size={15} />
            {notice}
          </p>
        )}
        {error && (
          <p className="dash-notice is-error" role="alert">
            <Icon name="warning" size={15} />
            {error}
          </p>
        )}
      </div>

      <section className="dash-card" aria-label="Cash on delivery by order">
        <header className="dash-card-header cod-ledger-header">
          <h2>Cash by delivery</h2>
          <div
            className="order-filter-tabs cod-view-toggle"
            role="tablist"
            aria-label="COD view modes"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "orders"}
              className={viewMode === "orders" ? "is-active" : ""}
              onClick={() => setViewMode("orders")}
            >
              All deliveries <span>{rows.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "riders"}
              className={viewMode === "riders" ? "is-active" : ""}
              onClick={() => setViewMode("riders")}
            >
              Group by rider <span>{riderGroups.length}</span>
            </button>
          </div>
        </header>
        {loading && !rows.length ? (
          <p className="dash-empty">Loading cash on delivery…</p>
        ) : rows.length === 0 ? (
          <p className="dash-empty">
            No deliveries with cash on delivery yet. Collected cash appears here
            for you to reconcile.
          </p>
        ) : viewMode === "riders" ? (
          <div className="cod-rider-groups">
            {riderGroups.map((group) => (
              <article key={group.driverId} className="cod-rider-card">
                <div className="cod-rider-header">
                  <div>
                    <span className="section-kicker">Rider custody</span>
                    <h3>{group.driverName}</h3>
                  </div>
                  {group.hasDiscrepancy && (
                    <span className="cod-discrepancy-badge is-warning">
                      <Icon name="warning" size={13} /> Discrepancy noted
                    </span>
                  )}
                </div>

                <div className="cod-rider-metrics">
                  <div
                    className={`cod-metric-cell ${group.toSettleCount > 0 ? "is-highlight" : ""}`}
                  >
                    <span className="cod-metric-label">To settle</span>
                    <strong className="cod-metric-val">
                      {currency.format(group.toSettleTotal)}
                    </strong>
                    <small>
                      {group.toSettleCount}{" "}
                      {group.toSettleCount === 1 ? "parcel" : "parcels"}
                    </small>
                  </div>
                  <div className="cod-metric-cell">
                    <span className="cod-metric-label">On road</span>
                    <strong className="cod-metric-val">
                      {currency.format(group.awaitingTotal)}
                    </strong>
                    <small>
                      {group.awaitingCount}{" "}
                      {group.awaitingCount === 1 ? "parcel" : "parcels"}
                    </small>
                  </div>
                  <div className="cod-metric-cell">
                    <span className="cod-metric-label">Settled</span>
                    <strong className="cod-metric-val">
                      {currency.format(group.settledTotal)}
                    </strong>
                    <small>
                      {group.settledCount}{" "}
                      {group.settledCount === 1 ? "parcel" : "parcels"}
                    </small>
                  </div>
                </div>

                {group.toSettleCount > 0 && (
                  <div className="cod-rider-batch-action">
                    {confirmingRider === group.driverId ? (
                      <div className="cod-ledger-confirm">
                        <span>
                          Confirm receiving{" "}
                          {currency.format(group.toSettleTotal)} from{" "}
                          {group.driverName} for all {group.toSettleCount}{" "}
                          parcels?
                        </span>
                        <button
                          type="button"
                          className="button button-primary button-small"
                          disabled={settling != null}
                          onClick={() => void settleRiderShift(group)}
                        >
                          {settling === group.driverId
                            ? "Settling shift…"
                            : "Confirm shift handover"}
                        </button>
                        <button
                          type="button"
                          className="button button-outline button-small"
                          disabled={settling != null}
                          onClick={() => setConfirmingRider(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="button button-dark button-small"
                        onClick={() => setConfirmingRider(group.driverId)}
                      >
                        <Icon name="coin" size={14} /> Settle shift (
                        {group.toSettleCount}{" "}
                        {group.toSettleCount === 1 ? "parcel" : "parcels"} ·{" "}
                        {currency.format(group.toSettleTotal)})
                      </button>
                    )}
                  </div>
                )}

                <div className="cod-rider-orders">
                  <h4>Assigned parcels ({group.rows.length})</h4>
                  <ul className="cod-rider-order-list">
                    {group.rows.map((r) => (
                      <li key={r.order.id} className="cod-rider-order-item">
                        <div className="cod-rider-order-info">
                          <strong>{r.order.tracking_code}</strong>
                          <small>{r.order.customer_name}</small>
                        </div>
                        <span
                          className={`cod-ledger-state ${STATE_TONE[r.state]}`}
                        >
                          COD · {STATE_LABEL[r.state]}
                        </span>
                        <div className="cod-rider-order-amt">
                          <span>Exp: {currency.format(r.expected)}</span>
                          <span>
                            Col:{" "}
                            {r.collected != null
                              ? currency.format(r.collected)
                              : "—"}
                          </span>
                          {r.difference !== 0 && (
                            <span className="cod-difference-alert">
                              {differenceText(r)}
                            </span>
                          )}
                        </div>
                        {r.reason && (
                          <p className="cod-ledger-reason">Note: {r.reason}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <ul className="cod-ledger-list">
            {rows.map((row) => (
              <li key={row.order.id} className="cod-ledger-row">
                <div className="cod-ledger-main">
                  <strong>{row.order.tracking_code}</strong>
                  <span className="cod-pay-method">
                    {paymentBadge(orderPaymentMethod(row.order))}
                  </span>
                  <span>
                    {row.order.driver_name ?? "Unassigned"} ·{" "}
                    {row.order.customer_name}
                  </span>
                </div>
                <span className={`cod-ledger-state ${STATE_TONE[row.state]}`}>
                  <Icon
                    name={row.state === "settled" ? "check" : "coin"}
                    size={14}
                  />
                  COD · {STATE_LABEL[row.state]}
                </span>
                <dl className="cod-ledger-amounts">
                  <div>
                    <dt>Expected</dt>
                    <dd>{currency.format(row.expected)}</dd>
                  </div>
                  <div>
                    <dt>Collected</dt>
                    <dd>
                      {row.collected == null
                        ? "—"
                        : currency.format(row.collected)}
                    </dd>
                  </div>
                  <div className={row.difference !== 0 ? "is-off" : undefined}>
                    <dt>Difference</dt>
                    <dd>
                      {differenceText(row)}
                      {row.difference !== 0 && (
                        <span className="cod-discrepancy-pill">
                          {row.difference < 0 ? "Short" : "Over"}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
                {row.reason && (
                  <p className="cod-ledger-reason">
                    Rider’s note: {row.reason}
                  </p>
                )}
                {row.state === "to_settle" &&
                  (confirming === row.order.id ? (
                    <div className="cod-ledger-confirm">
                      <span>
                        Confirm you received{" "}
                        {currency.format(row.collected ?? 0)} from the rider?
                      </span>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={settling != null}
                        onClick={() => void settle(row)}
                      >
                        {settling === row.order.id ? "Saving…" : "Yes, settled"}
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={settling != null}
                        onClick={() => setConfirming(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setConfirming(row.order.id)}
                    >
                      Mark as handed over
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
