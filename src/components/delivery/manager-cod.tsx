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
  const [settling, setSettling] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when orders or the key change
  useEffect(() => {
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
        <header className="dash-card-header">
          <h2>Cash by delivery</h2>
        </header>
        {loading && !rows.length ? (
          <p className="dash-empty">Loading cash on delivery…</p>
        ) : rows.length === 0 ? (
          <p className="dash-empty">
            No deliveries with cash on delivery yet. Collected cash appears here
            for you to reconcile.
          </p>
        ) : (
          <ul className="cod-ledger-list">
            {rows.map((row) => (
              <li key={row.order.id} className="cod-ledger-row">
                <div className="cod-ledger-main">
                  <strong>{row.order.tracking_code}</strong>
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
                    <dd>{differenceText(row)}</dd>
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
