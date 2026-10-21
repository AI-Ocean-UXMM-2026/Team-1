"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { LocationMap } from "@/components/delivery/location-map";
import {
  CardHeader,
  KpiCell,
  Sparkline,
} from "@/components/delivery/manager-ui-components";
import type { attentionSummary } from "@/lib/delivery/dashboard";
import { currency, formatTime } from "@/lib/delivery/format";
import type { DeliveryOrder, RiderRequest, VehicleOption } from "@/lib/delivery/types";
import type { useWorkspace } from "@/lib/delivery/use-workspace";

type Workspace = ReturnType<typeof useWorkspace>;

export type ManagerHomeViewProps = {
  workspace: Workspace;
  movingCount: number;
  activeCount: number;
  deliveredCount: number;
  atRiskCount: number;
  hourly: number[];
  movingOrders: DeliveryOrder[];
  recentList: DeliveryOrder[];
  summary: ReturnType<typeof attentionSummary>;
  openRequests: RiderRequest[];
  freeRiders: number;
  availableVehicles: VehicleOption[];
};

export function ManagerHomeView({
  workspace,
  movingCount,
  activeCount,
  deliveredCount,
  atRiskCount,
  hourly,
  movingOrders,
  recentList,
  summary,
  openRequests,
  freeRiders,
  availableVehicles,
}: ManagerHomeViewProps) {
  const attentionTotal =
    summary.needsRider +
    summary.delayed +
    summary.codPending +
    openRequests.length +
    summary.pendingReports;

  return (
    <div className="dash-overview">
      <div className="dash-main">
        <section className="dash-card" aria-label="Delivery metrics">
          <div className="dash-kpi-grid">
            <KpiCell
              label="Live now"
              value={movingCount}
              hint="On the road"
              tone="live"
            />
            <KpiCell
              label="Active"
              value={activeCount}
              hint="Assigned or moving"
            />
            <KpiCell
              label="Delivered"
              value={deliveredCount}
              hint="All time"
              tone="success"
            />
            <KpiCell
              label="At risk"
              value={atRiskCount}
              hint="Delayed or failed"
              tone="warning"
            />
          </div>
          <div className="dash-trend">
            <span>Orders created · last 12 h</span>
            {hourly.some((count) => count > 0) ? (
              <Sparkline values={hourly} />
            ) : (
              <span className="dash-trend-empty">None in the last 12 h</span>
            )}
          </div>
        </section>

        <section className="dash-card" aria-label="Live map">
          <CardHeader title="Live map" meta={`${movingCount} live`} />
          <div className="dash-map">
            <LocationMap
              order={null}
              orders={movingOrders}
              mode="manager"
              isDemo={workspace.isDemo}
              compact
            />
            {movingCount === 0 && (
              <p className="dash-map-empty">No parcels on the move</p>
            )}
          </div>
        </section>

        <section className="dash-card" aria-label="Recent deliveries">
          <CardHeader title="Recent deliveries">
            <Link className="dash-link" href="/manager/order">
              View queue
            </Link>
          </CardHeader>
          <table className="dash-table">
            <caption className="visually-hidden">Recent deliveries</caption>
            <thead>
              <tr>
                <th scope="col">Delivery</th>
                <th scope="col">Status</th>
                <th scope="col">Rider</th>
                <th scope="col">ETA</th>
                <th scope="col">COD</th>
              </tr>
            </thead>
            <tbody>
              {recentList.map((order) => (
                <tr key={order.id} className="dash-table-row">
                  <td className="dash-cell-main">
                    <Link href={`/manager/order?id=${order.id}`}>
                      <strong>{order.tracking_code}</strong>
                    </Link>
                    <small>{order.customer_name}</small>
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="dash-cell-truncate">
                    {order.driver_name || "Unassigned"}
                  </td>
                  <td>{formatTime(order.estimated_delivery_at)}</td>
                  <td
                    className={
                      order.cod_amount > 0 ? "dash-cell-cod" : undefined
                    }
                  >
                    {order.cod_amount > 0
                      ? currency.format(order.cod_amount)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recentList.length && (
            <p className="dash-empty">No deliveries yet.</p>
          )}
        </section>
      </div>

      <aside className="dash-rail">
        <section className="dash-card" aria-label="Needs attention">
          <CardHeader
            title="Needs attention"
            meta={
              <span
                className={
                  attentionTotal ? "dash-pill-alert" : "dash-pill-clear"
                }
              >
                {attentionTotal ? `${attentionTotal} open` : "All clear"}
              </span>
            }
          />
          <ul className="dash-list">
            {(
              [
                [
                  "Needs rider",
                  summary.needsRider,
                  "/manager/order?filter=unassigned",
                  "unassigned",
                ],
                [
                  "Delayed on route",
                  summary.delayed,
                  "/manager/track",
                  "delayed",
                ],
                [
                  "COD to settle",
                  summary.codPending,
                  "/manager/order?filter=cod",
                  "cod",
                ],
                [
                  "Rider requests",
                  openRequests.length,
                  "/manager/track#rider-requests",
                  "requests",
                ],
                [
                  "Road reports",
                  summary.pendingReports,
                  "/manager/track#road-knowledge",
                  "reports",
                ],
              ] as const
            ).map(([label, value, href, category]) => (
              <li
                key={label}
                className={`${value > 0 ? "is-alert" : "is-clear"} dash-alert-${category}`}
              >
                <Link href={href}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <Icon name="arrow-right" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card" aria-label="Fleet status">
          <CardHeader title="Fleet" />
          <ul className="dash-list">
            <li>
              <Link href="/manager/profile">
                <span>Riders free</span>
                <strong>
                  {workspace.data.drivers.length ? (
                    <>
                      {freeRiders}
                      <small> / {workspace.data.drivers.length}</small>
                    </>
                  ) : (
                    "—"
                  )}
                </strong>
                <Icon name="arrow-right" size={14} />
              </Link>
            </li>
            <li>
              <Link href="/manager/profile">
                <span>Vehicles ready</span>
                <strong>
                  {workspace.data.vehicles.length ? (
                    <>
                      {availableVehicles.length}
                      <small> / {workspace.data.vehicles.length}</small>
                    </>
                  ) : (
                    "—"
                  )}
                </strong>
                <Icon name="arrow-right" size={14} />
              </Link>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
