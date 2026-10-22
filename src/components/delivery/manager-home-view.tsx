"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/delivery/common";
import "./manager-home.css";
import { Icon } from "@/components/delivery/icons";
import { LocationMap } from "@/components/delivery/location-map";
import {
  CardHeader,
  KpiCell,
} from "@/components/delivery/manager-ui-components";
import {
  type attentionSummary,
  managerExceptions,
} from "@/lib/delivery/dashboard";
import { currency, formatTime } from "@/lib/delivery/format";
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
  movingOrders: DeliveryOrder[];
  recentList: DeliveryOrder[];
  summary: ReturnType<typeof attentionSummary>;
  freeRiders: number;
  availableVehicles: VehicleOption[];
  tasks: { requests: number; queued: number; open: number } | null;
};

function RecentDeliveries({ orders }: { orders: DeliveryOrder[] }) {
  return (
    <section className="dash-card" aria-label="Recent deliveries">
      <CardHeader title="Recent deliveries" icon="package">
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
          {orders.map((order) => (
            <tr key={order.id} className="dash-table-row">
              <td className="dash-cell-main">
                <Link
                  href={`/manager/order?id=${order.id}`}
                  aria-label={`Open delivery ${order.tracking_code} for ${order.customer_name}`}
                >
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
                className={order.cod_amount > 0 ? "dash-cell-cod" : undefined}
              >
                {order.cod_amount > 0 ? currency.format(order.cod_amount) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="dash-delivery-list" aria-label="Recent deliveries">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/manager/order?id=${order.id}`}
              aria-label={`Open delivery ${order.tracking_code} for ${order.customer_name}`}
            >
              <span className="dash-delivery-heading">
                <strong>{order.tracking_code}</strong>
                <StatusBadge status={order.status} />
              </span>
              <span className="dash-delivery-customer">
                {order.customer_name}
              </span>
              <span className="dash-delivery-facts">
                <span>
                  <small>Rider</small>
                  {order.driver_name || "Unassigned"}
                </span>
                <span>
                  <small>ETA</small>
                  {formatTime(order.estimated_delivery_at)}
                </span>
                <span>
                  <small>COD</small>
                  {order.cod_amount > 0
                    ? currency.format(order.cod_amount)
                    : "None"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!orders.length && (
        <p className="dash-empty">No deliveries have been created yet.</p>
      )}
    </section>
  );
}

export function ManagerHomeView({
  workspace,
  movingCount,
  deliveredCount,
  atRiskCount,
  refreshing,
  onRefresh,
  movingOrders,
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
  const hasOperationalData =
    workspace.data.orders.length > 0 ||
    workspace.data.drivers.length > 0 ||
    workspace.data.vehicles.length > 0;

  if (!hasOperationalData) {
    return (
      <section
        className="dash-card manager-zero-state"
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
          <Link className="button button-primary" href="/manager/order">
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

  return (
    <div className="dash-overview">
      <section
        className="dash-card dash-priority"
        aria-label="Priority exceptions"
      >
        <CardHeader
          title="Act now"
          icon="warning"
          meta={
            exceptions.length ? (
              <span className="dash-pill-alert">
                {exceptions.length} prioritised
              </span>
            ) : (
              <span className="dash-pill-clear">Operations checked</span>
            )
          }
        />
        {exceptions.length ? (
          <ol className="dash-exception-list">
            {exceptions.map((item) => (
              <li key={item.id} className={`is-${item.tone}`}>
                <Link href={item.href}>
                  <span className="dash-exception-icon" aria-hidden="true">
                    <Icon
                      name={item.title.includes("cash") ? "coin" : "warning"}
                      size={17}
                    />
                  </span>
                  <span className="dash-exception-copy">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <span className="dash-exception-meta">{item.meta}</span>
                  <Icon name="arrow-right" size={15} />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="dash-healthy-state">
            <Icon name="check" size={18} />
            <span>
              <strong>No urgent intervention needed</strong>
              <small>
                Live data loaded and no stale locations, delays, unassigned
                deliveries, rider requests, or unsettled cash were found.
              </small>
            </span>
          </div>
        )}
      </section>

      <div className="dash-main">
        <section className="dash-card" aria-label="Delivery metrics">
          <div className="dash-kpi-grid">
            <KpiCell
              label="On route"
              value={movingCount}
              hint={`${summary.gpsLive} GPS live · ${summary.staleLocations} stale`}
              tone="live"
              icon="track"
              href="/manager/track"
            />
            <KpiCell
              label="Needs rider"
              value={summary.needsRider}
              hint="Awaiting assignment"
              icon="user"
              tone={summary.needsRider ? "warning" : undefined}
              href="/manager/order?filter=unassigned"
            />
            <KpiCell
              label="Delivered today"
              value={deliveredCount}
              hint="Local time"
              tone="success"
              icon="check"
              href="/manager/order"
            />
            <KpiCell
              label="At risk"
              value={atRiskCount}
              hint="Delayed or failed"
              icon="warning"
              tone={atRiskCount ? "warning" : undefined}
              href="/manager/order"
            />
          </div>
        </section>

        <section className="dash-card" aria-label="Live map">
          <CardHeader
            title="Route locations"
            icon="location"
            meta={`${summary.gpsLive} GPS live`}
          />
          <div className="dash-map">
            <LocationMap
              order={null}
              orders={movingOrders}
              mode="manager"
              isDemo={workspace.isDemo}
              roadReports={workspace.data.roadReports}
              compact
            />
            {movingCount === 0 && (
              <p className="dash-map-empty">
                No parcels are currently on route
              </p>
            )}
          </div>
        </section>

        <RecentDeliveries orders={recentList} />
      </div>

      <aside className="dash-rail">
        <section className="dash-card" aria-label="Cash on delivery status">
          <CardHeader title="Cash on delivery" icon="coin">
            <Link className="dash-link" href="/manager/cod">
              Open ledger
            </Link>
          </CardHeader>
          <dl className="dash-money-list">
            <div>
              <dt>COD due</dt>
              <dd>{currency.format(summary.codPendingTotal)}</dd>
              <small>{summary.codPending} awaiting collection</small>
            </div>
            <div className={summary.codToSettle ? "is-warning" : undefined}>
              <dt>Collected · not settled</dt>
              <dd>{currency.format(summary.codToSettleTotal)}</dd>
              <small>{summary.codToSettle} awaiting handover</small>
            </div>
          </dl>
        </section>

        <section className="dash-card" aria-label="Task automation">
          <CardHeader title="Task automation" icon="spark">
            <Link className="dash-link" href="/manager/jobs">
              Open
            </Link>
          </CardHeader>
          <ul className="dash-list">
            {[
              { label: "Requests waiting", value: tasks?.requests },
              { label: "In queue", value: tasks?.queued },
              { label: "Open tasks", value: tasks?.open },
            ].map((row) => (
              <li key={row.label}>
                <Link href="/manager/jobs">
                  <span>{row.label}</span>
                  <strong>{row.value ?? "—"}</strong>
                  <Icon name="arrow-right" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card" aria-label="Fleet status">
          <CardHeader title="Fleet" icon="truck">
            <Link className="dash-link" href="/manager/vehicles">
              Open
            </Link>
          </CardHeader>
          <ul className="dash-list">
            <li>
              <Link href="/manager/profile?tab=riders">
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
              <Link href="/manager/vehicles">
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
