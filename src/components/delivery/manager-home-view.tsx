"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { StatusBadge } from "@/components/delivery/common";
import "./manager-home.css";
import "./manager-home-simple.css";
import { Icon } from "@/components/delivery/icons";
import {
  type attentionSummary,
  managerExceptions,
} from "@/lib/delivery/dashboard";
import { currency, formatTime } from "@/lib/delivery/format";
import {
  orderPaymentMethod,
  paymentBadge,
} from "@/lib/delivery/payment-methods";
import type { DeliveryOrder, VehicleOption } from "@/lib/delivery/types";
import type { useWorkspace } from "@/lib/delivery/use-workspace";

type Workspace = ReturnType<typeof useWorkspace>;

export type ManagerHomeViewProps = {
  workspace: Workspace;
  movingCount: number;
  deliveredCount: number;
  atRiskCount: number;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  recentList: DeliveryOrder[];
  summary: ReturnType<typeof attentionSummary>;
  freeRiders: number;
  availableVehicles: VehicleOption[];
  tasks: { requests: number; queued: number; open: number } | null;
};

const VISIBLE_EXCEPTIONS = 4;

type Tone = "success" | "warning" | "error" | "info" | "muted";

type Metric = {
  label: string;
  value: number;
  hint: string;
  href: string;
  tone: Tone;
};

type HealthRow = {
  service: string;
  tone: Tone;
  status: string;
  detail: string;
  href: string;
};

function ratio(part: number, total: number) {
  return total ? `${part} / ${total}` : "—";
}

/** Cloudscape-style status indicator: a small outlined glyph and a label. */
function StatusIndicator({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span className={`mh-status is-${tone}`}>
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {tone === "success" && (
          <>
            <circle cx="8" cy="8" r="6.2" />
            <path d="m5.2 8.2 2 2 3.6-4" />
          </>
        )}
        {tone === "warning" && (
          <>
            <path d="M8 2 14.2 13H1.8L8 2Z" />
            <path d="M8 6.5v3M8 11.4v.1" />
          </>
        )}
        {tone === "error" && (
          <>
            <circle cx="8" cy="8" r="6.2" />
            <path d="m5.8 5.8 4.4 4.4M10.2 5.8l-4.4 4.4" />
          </>
        )}
        {tone === "info" && (
          <>
            <circle cx="8" cy="8" r="6.2" />
            <path d="M8 7.2v3.6M8 5.1v.1" />
          </>
        )}
        {tone === "muted" && (
          <>
            <circle cx="8" cy="8" r="6.2" />
            <path d="M5.4 8h5.2" />
          </>
        )}
      </svg>
      {children}
    </span>
  );
}

function Container({
  id,
  title,
  count,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  count?: number | string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mh-card" aria-labelledby={id}>
      <header className="mh-card-head">
        <div className="mh-card-title">
          <h2 id={id}>
            {title}
            {count !== undefined && (
              <span className="mh-card-count"> ({count})</span>
            )}
          </h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function SummaryContainer({ metrics }: { metrics: Metric[] }) {
  return (
    <Container
      id="mh-summary-title"
      title="Delivery summary"
      description="Live counts for the current shift. Select a figure to open its list."
    >
      <ul className="mh-metrics">
        {metrics.map((metric) => (
          <li key={metric.label}>
            <Link href={metric.href}>
              <span className="mh-metric-label">{metric.label}</span>
              <strong className={`is-${metric.tone}`}>{metric.value}</strong>
              <StatusIndicator tone={metric.tone}>
                {metric.hint}
              </StatusIndicator>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}

function Alerts({
  exceptions,
}: {
  exceptions: ReturnType<typeof managerExceptions>;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? exceptions : exceptions.slice(0, VISIBLE_EXCEPTIONS);
  const hidden = exceptions.length - VISIBLE_EXCEPTIONS;
  const severity = {
    critical: { tone: "error", label: "Critical" },
    warning: { tone: "warning", label: "Warning" },
    info: { tone: "info", label: "Info" },
  } as const;

  return (
    <Container
      id="mh-alerts-title"
      title="Alerts"
      count={exceptions.length}
      description="Items that need a dispatcher decision, most urgent first."
    >
      {exceptions.length ? (
        <>
          <div className="mh-table-wrap">
            <table className="mh-table">
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Alert</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const level = severity[item.tone];
                  return (
                    <tr key={item.id}>
                      <td>
                        <StatusIndicator tone={level.tone}>
                          {level.label}
                        </StatusIndicator>
                      </td>
                      <td>
                        <Link className="mh-link" href={item.href}>
                          {item.title}
                        </Link>
                      </td>
                      <td className="mh-muted">
                        {item.detail} · {item.meta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hidden > 0 && (
            <button
              type="button"
              className="mh-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? "Show fewer alerts" : `Show ${hidden} more`}
            </button>
          )}
        </>
      ) : (
        <p className="mh-empty">
          <StatusIndicator tone="success">No active alerts</StatusIndicator>
          Locations are live, and no delays, unassigned deliveries or unsettled
          cash were found.
        </p>
      )}
    </Container>
  );
}

function RecentDeliveries({ orders }: { orders: DeliveryOrder[] }) {
  return (
    <Container
      id="mh-recent-title"
      title="Recent deliveries"
      count={orders.length}
      action={
        <Link className="button button-outline mh-action" href="/manager/order">
          View all deliveries
        </Link>
      }
    >
      {orders.length ? (
        <div className="mh-table-wrap">
          <table className="mh-table">
            <thead>
              <tr>
                <th scope="col">Delivery</th>
                <th scope="col">Customer</th>
                <th scope="col">Status</th>
                <th scope="col">Payment</th>
                <th scope="col">Rider</th>
                <th scope="col">ETA</th>
                <th scope="col" className="mh-num">
                  COD
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="mh-nowrap">
                    <Link
                      className="mh-link"
                      href={`/manager/order?id=${order.id}`}
                    >
                      {order.tracking_code}
                    </Link>
                  </td>
                  <td>{order.customer_name}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="mh-nowrap">
                    {paymentBadge(orderPaymentMethod(order))}
                  </td>
                  <td>
                    {order.driver_name || (
                      <span className="mh-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="mh-nowrap">
                    {formatTime(order.estimated_delivery_at)}
                  </td>
                  <td className="mh-num">
                    {order.cod_amount > 0 ? (
                      currency.format(order.cod_amount)
                    ) : (
                      <span className="mh-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mh-empty">No deliveries have been created yet.</p>
      )}
    </Container>
  );
}

function OperationalHealth({ rows }: { rows: HealthRow[] }) {
  const attention = rows.filter((row) => row.tone !== "success").length;
  return (
    <Container
      id="mh-health-title"
      title="Operational health"
      description={
        attention
          ? `${attention} of ${rows.length} checks need attention.`
          : "All checks are passing."
      }
    >
      <ul className="mh-health">
        {rows.map((row) => (
          <li key={row.service}>
            <Link href={row.href}>
              <span className="mh-health-copy">
                <strong>{row.service}</strong>
                <small>{row.detail}</small>
              </span>
              <StatusIndicator tone={row.tone}>{row.status}</StatusIndicator>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}

function Capacity({
  riders,
  vehicles,
  cash,
  tasks,
}: {
  riders: { free: number; total: number };
  vehicles: { ready: number; total: number };
  cash: { value: string; detail: string; warn: boolean };
  tasks: { open: number; detail: string } | null;
}) {
  const bars = [
    {
      label: "Riders free",
      href: "/manager/profile?tab=riders",
      ...riders,
      part: riders.free,
    },
    {
      label: "Vehicles ready",
      href: "/manager/vehicles",
      ...vehicles,
      part: vehicles.ready,
    },
  ];
  return (
    <Container id="mh-capacity-title" title="Fleet and cash">
      <div className="mh-capacity">
        {bars.map((bar) => (
          <Link key={bar.label} href={bar.href} className="mh-bar">
            <span className="mh-bar-head">
              <span>{bar.label}</span>
              <strong>{ratio(bar.part, bar.total)}</strong>
            </span>
            <progress
              max={bar.total || 1}
              value={bar.part}
              aria-label={`${bar.label}: ${bar.part} of ${bar.total}`}
            />
          </Link>
        ))}
        <dl className="mh-kv">
          <div>
            <dt>Cash to settle</dt>
            <dd className={cash.warn ? "is-warning" : undefined}>
              <Link href="/manager/cod">{cash.value}</Link>
              <small>{cash.detail}</small>
            </dd>
          </div>
          <div>
            <dt>Open tasks</dt>
            <dd>
              <Link href="/manager/jobs">{tasks ? tasks.open : "—"}</Link>
              {tasks && <small>{tasks.detail}</small>}
            </dd>
          </div>
        </dl>
      </div>
    </Container>
  );
}

export function ManagerHomeView({
  workspace,
  movingCount,
  deliveredCount,
  atRiskCount,
  refreshing,
  onRefresh,
  recentList,
  summary,
  freeRiders,
  availableVehicles,
  tasks,
}: ManagerHomeViewProps) {
  const exceptions = managerExceptions(
    workspace.data.orders,
    workspace.data.riderRequests ?? [],
  );
  const { drivers, vehicles, orders } = workspace.data;
  const hasOperationalData =
    orders.length > 0 || drivers.length > 0 || vehicles.length > 0;

  if (!hasOperationalData) {
    return (
      <section
        className="mh-card manager-zero-state"
        aria-labelledby="manager-zero-title"
      >
        <span className="manager-zero-icon" aria-hidden="true">
          <Icon name="delivery" size={24} />
        </span>
        <div>
          <h2 id="manager-zero-title">Set up your dispatch workspace</h2>
          <p>
            There are no deliveries, riders, or vehicles to monitor yet. Add
            operational data before this overview can report a healthy shift.
          </p>
        </div>
        <div className="manager-zero-actions">
          <Link className="button button-primary" href="/manager/order/create">
            Create a delivery <Icon name="arrow-right" size={16} />
          </Link>
          <Link className="button button-outline" href="/manager/profile">
            Add team or vehicles
          </Link>
          <button
            type="button"
            className="button button-outline"
            onClick={() => void onRefresh()}
            disabled={refreshing}
          >
            <Icon name="refresh" size={15} />
            {refreshing ? "Refreshing…" : "Check again"}
          </button>
        </div>
      </section>
    );
  }

  const metrics: Metric[] = [
    {
      label: "On route",
      value: movingCount,
      hint: `${summary.gpsLive} GPS live`,
      href: "/manager/track",
      tone: "info",
    },
    {
      label: "Needs rider",
      value: summary.needsRider,
      hint: summary.needsRider ? "Awaiting assignment" : "All assigned",
      href: "/manager/order?filter=unassigned",
      tone: summary.needsRider ? "warning" : "success",
    },
    {
      label: "Delivered today",
      value: deliveredCount,
      hint: "Local time",
      href: "/manager/order",
      tone: "success",
    },
    {
      label: "At risk",
      value: atRiskCount,
      hint: atRiskCount ? "Delayed or failed" : "None at risk",
      href: "/manager/order",
      tone: atRiskCount ? "error" : "success",
    },
  ];

  const onRoute = summary.gpsLive + summary.staleLocations;
  const health: HealthRow[] = [
    {
      service: "Rider GPS",
      tone: summary.staleLocations ? "error" : "success",
      status: summary.staleLocations ? "Stale" : "Normal",
      detail: onRoute
        ? `${summary.gpsLive} of ${onRoute} on-route locations are live`
        : "No deliveries on route",
      href: "/manager/track",
    },
    {
      service: "Dispatch queue",
      tone: summary.needsRider ? "warning" : "success",
      status: summary.needsRider ? "Needs rider" : "Normal",
      detail: `${summary.needsRider} awaiting assignment`,
      href: "/manager/order?filter=unassigned",
    },
    {
      service: "Traffic delays",
      tone: summary.delayed ? "warning" : "success",
      status: summary.delayed ? "Delayed" : "Normal",
      detail: `${summary.delayed} active deliveries running late`,
      href: "/manager/track",
    },
    {
      service: "Cash settlement",
      tone: summary.codToSettle ? "warning" : "success",
      status: summary.codToSettle ? "To settle" : "Normal",
      detail: `${summary.codToSettle} collected, ${summary.codPending} still due`,
      href: "/manager/cod",
    },
    {
      service: "Road reports",
      tone: summary.pendingReports ? "info" : "success",
      status: summary.pendingReports ? "To review" : "Normal",
      detail: `${summary.pendingReports} pending review`,
      href: "/manager/track",
    },
  ];

  return (
    <div className="mh-page">
      <SummaryContainer metrics={metrics} />
      <div className="mh-columns">
        <div className="mh-stack">
          <Alerts exceptions={exceptions} />
          <RecentDeliveries orders={recentList} />
        </div>
        <div className="mh-stack">
          <OperationalHealth rows={health} />
          <Capacity
            riders={{ free: freeRiders, total: drivers.length }}
            vehicles={{
              ready: availableVehicles.length,
              total: vehicles.length,
            }}
            cash={{
              value: currency.format(summary.codToSettleTotal),
              detail: `${currency.format(summary.codPendingTotal)} still due`,
              warn: summary.codToSettle > 0,
            }}
            tasks={
              tasks
                ? {
                    open: tasks.open,
                    detail: `${tasks.requests} requests · ${tasks.queued} queued`,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
