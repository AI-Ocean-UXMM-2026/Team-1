import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type CodOrder = {
  id: string;
  tracking_code: string;
  status: string;
  cod_amount: number;
  driver_id?: string | null;
  driver_name: string | null;
  customer_name: string;
};
export type CodPayment = {
  order_id: string;
  amount: number;
  status: string;
  collected_at: string;
  settled_at: string | null;
};
export type CodReport = {
  order_id: string;
  cod_collected: number | null;
  cod_discrepancy_reason: string | null;
  reported_at: string;
};

export type CodState = "awaiting" | "not_collected" | "to_settle" | "settled";

export type CodRow = {
  order: CodOrder;
  expected: number;
  collected: number | null;
  /** Collected minus expected; zero when the cash matches. */
  difference: number;
  reason: string | null;
  state: CodState;
};

/**
 * One row per order that owes cash. Failed and cancelled orders owe nothing, so
 * they are left out; a delivered order with no recorded cash is an exception.
 */
export function buildCodLedger(
  orders: CodOrder[],
  payments: CodPayment[],
  reports: CodReport[],
): CodRow[] {
  const paymentByOrder = new Map(payments.map((item) => [item.order_id, item]));
  const reportByOrder = new Map<string, CodReport>();
  for (const report of reports) {
    const current = reportByOrder.get(report.order_id);
    if (!current || report.reported_at > current.reported_at)
      reportByOrder.set(report.order_id, report);
  }

  const rows: CodRow[] = [];
  for (const order of orders) {
    if (order.cod_amount <= 0) continue;
    if (order.status === "failed" || order.status === "cancelled") continue;
    const payment = paymentByOrder.get(order.id);
    const report = reportByOrder.get(order.id);
    const expected = order.cod_amount;
    const collected = payment?.amount ?? report?.cod_collected ?? null;
    const reason = report?.cod_discrepancy_reason ?? null;
    if (payment) {
      rows.push({
        order,
        expected,
        collected: payment.amount,
        difference: payment.amount - expected,
        reason,
        state: payment.status === "settled" ? "settled" : "to_settle",
      });
    } else if (order.status === "delivered") {
      rows.push({
        order,
        expected,
        collected,
        difference: (collected ?? 0) - expected,
        reason,
        state: "not_collected",
      });
    } else {
      rows.push({
        order,
        expected,
        collected: null,
        difference: 0,
        reason: null,
        state: "awaiting",
      });
    }
  }
  const rank: Record<CodState, number> = {
    not_collected: 0,
    to_settle: 1,
    awaiting: 2,
    settled: 3,
  };
  return rows.sort(
    (left, right) =>
      rank[left.state] - rank[right.state] ||
      Number(right.difference !== 0) - Number(left.difference !== 0),
  );
}

export function summariseCodLedger(rows: CodRow[]) {
  const sum = (items: CodRow[], pick: (row: CodRow) => number) =>
    items.reduce((total, row) => total + pick(row), 0);
  const toSettle = rows.filter((row) => row.state === "to_settle");
  return {
    awaitingTotal: sum(
      rows.filter((row) => row.state === "awaiting"),
      (row) => row.expected,
    ),
    toSettleTotal: sum(toSettle, (row) => row.collected ?? 0),
    toSettleCount: toSettle.length,
    settledTotal: sum(
      rows.filter((row) => row.state === "settled"),
      (row) => row.collected ?? 0,
    ),
    exceptionCount: rows.filter(
      (row) => row.state === "not_collected" || row.difference !== 0,
    ).length,
  };
}

type Client = SupabaseClient<Database>;

export async function loadCodLedgerData(supabase: Client) {
  const [payments, reports] = await Promise.all([
    supabase
      .from("cod_payments")
      .select("order_id, amount, status, collected_at, settled_at"),
    supabase
      .from("delivery_outcome_reports")
      .select("order_id, cod_collected, cod_discrepancy_reason, reported_at")
      .order("reported_at", { ascending: false }),
  ]);
  const error = payments.error ?? reports.error;
  if (error) throw new Error(error.message);
  return {
    payments: (payments.data ?? []) as CodPayment[],
    reports: (reports.data ?? []) as CodReport[],
  };
}

/** Marks collected cash as handed over to the office. Only managers may do so. */
export async function settleCodPayment(supabase: Client, orderId: string) {
  const { data, error } = await supabase
    .from("cod_payments")
    .update({ status: "settled", settled_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("status", "collected")
    .select("order_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error("This cash was already settled or is no longer available.");
}
