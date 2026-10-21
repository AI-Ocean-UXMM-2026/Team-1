"use client";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import type { ReactNode } from "react";
import { useState } from "react";

import { Brand } from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { CodTag, Notice } from "@/components/delivery/rider-tools";
import {
  type DeliveryStop,
  type DriverRoute,
  openStops,
  PARCEL_STATE_LABELS,
  parcelState,
} from "@/lib/delivery/driver-route";
import { currency, formatTime } from "@/lib/delivery/format";
import type { VehicleOption } from "@/lib/delivery/types";

const STOP_STATE_LABELS: Record<DeliveryStop["state"], string> = {
  PENDING: "Upcoming",
  NAVIGATING: "Current stop",
  ARRIVED: "Arrived",
  HANDOVER_IN_PROGRESS: "Handing over",
  COMPLETED: "Delivered",
  FAILED: "Not delivered",
  RESCHEDULED: "Rescheduled",
};

export function StopMark({ stop }: { stop: DeliveryStop }) {
  return (
    <span
      className={`dv-stop-mark is-${stop.state.toLowerCase()}`}
      aria-hidden="true"
    >
      {stop.state === "COMPLETED" ? (
        <Icon name="check" size={16} strokeWidth={2.6} />
      ) : stop.state === "FAILED" ? (
        <Icon name="close" size={16} strokeWidth={2.6} />
      ) : (
        stop.number
      )}
    </span>
  );
}

/** One stop in a route list: number, recipient, place, parcels, COD, state. */
const compactMoney = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function StopRow({
  stop,
  showState = true,
  dense = false,
  time,
}: {
  stop: DeliveryStop;
  showState?: boolean;
  /** One line: number, name and area on the left; COD and time pinned right. */
  dense?: boolean;
  /** Dense rows only: the time to show, and whether it is out of route order. */
  time?: { label: string; warn: boolean } | null;
}) {
  const finished = stop.state === "COMPLETED" || stop.state === "FAILED";
  const parcelCount = stop.parcels.length;
  if (dense) {
    return (
      <li className={`dv-stop-row is-dense is-${stop.state.toLowerCase()}`}>
        <StopMark stop={stop} />
        <span className="dv-stop-copy">
          <strong>{stop.recipient}</strong>
          <span className="dv-stop-address">{stop.address}</span>
        </span>
        <span className="dv-dense-end">
          {!finished && time && (
            <small
              className={`dv-stop-state${time.warn ? " is-warn" : ""}`}
              title={
                time.warn
                  ? "Promised earlier than the stop before it"
                  : undefined
              }
            >
              {time.label}
            </small>
          )}
          {!finished && stop.codDue > 0 && (
            <small
              className="dv-dense-cod"
              title={`Collect COD · ${compactMoney.format(stop.codDue)} MMK`}
            >
              {compactMoney.format(stop.codDue)} cash
            </small>
          )}
        </span>
      </li>
    );
  }
  return (
    <li className={`dv-stop-row is-${stop.state.toLowerCase()}`}>
      <StopMark stop={stop} />
      <div className="dv-stop-copy">
        <span className="dv-stop-top">
          <strong>{stop.recipient}</strong>
          {showState && (
            <small className="dv-stop-state">
              {STOP_STATE_LABELS[stop.state]}
            </small>
          )}
        </span>
        <span className="dv-stop-address">{stop.address}</span>
        <span className="dv-meta">
          <span>
            <Icon name="box" size={14} /> {parcelCount}{" "}
            {parcelCount === 1 ? "parcel" : "parcels"}
          </span>
          {!finished && stop.etaAt && (
            <span>
              <Icon name="history" size={14} /> ETA {formatTime(stop.etaAt)}
            </span>
          )}
          {!finished && <CodTag amount={stop.codDue} />}
          {stop.notLoaded.length > 0 && (
            <span className="dv-tag is-warning">
              {stop.notLoaded.length} not on truck
            </span>
          )}
        </span>
      </div>
    </li>
  );
}

export type RouteMetrics = {
  /** e.g. "23 km by road" or "18 km straight-line". */
  distance: string | null;
  /** Driving time only; stop time is not included. */
  driveTime: string | null;
  /** Latest promised ETA among open stops. */
  finishBy: string | null;
};

function MetricGrid({
  route,
  metrics,
}: {
  route: DriverRoute;
  metrics: RouteMetrics;
}) {
  const stopsLeft = openStops(route).length;
  return (
    <dl className="dv-metrics" aria-label="Route summary">
      <div>
        <dt>Stops</dt>
        <dd>
          {stopsLeft}
          <small> of {route.stops.length} left</small>
        </dd>
      </div>
      <div>
        <dt>Parcels</dt>
        <dd>
          {route.parcels.length}
          <small> · {route.onBoard.length} on truck</small>
        </dd>
      </div>
      <div className="dv-metric-cod">
        <dt>
          <Icon name="coin" size={14} /> COD to collect
        </dt>
        <dd>{currency.format(route.codToCollect)}</dd>
      </div>
      <div>
        <dt>Finish by</dt>
        <dd>
          {metrics.finishBy ? formatTime(metrics.finishBy) : "—"}
          {metrics.distance && (
            <small className="dv-metric-sub">
              {metrics.distance}
              {metrics.driveTime ? `, ${metrics.driveTime} driving` : ""}
            </small>
          )}
        </dd>
      </div>
    </dl>
  );
}

/** The manifest grouped by stop, with a tick per parcel loaded onto the truck. */
function LoadCheck({
  route,
  busy,
  online,
  onConfirm,
  onReportMissing,
}: {
  route: DriverRoute;
  busy: boolean;
  online: boolean;
  onConfirm: (orderIds: string[]) => void;
  onReportMissing: (orderIds: string[]) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const toLoad = new Set(route.toLoad.map((order) => order.id));
  const stops = route.stops.filter((stop) =>
    stop.parcels.some((order) => toLoad.has(order.id)),
  );
  const missing = route.toLoad
    .map((order) => order.id)
    .filter((id) => !checked.includes(id));
  return (
    <section className="dv-load" aria-labelledby="dv-load-title">
      <div className="dv-section-head">
        <h2 id="dv-load-title">Check your load</h2>
        <span className="dv-count">
          {checked.length} of {route.toLoad.length}
        </span>
      </div>
      <p className="rf-muted">
        Tick each parcel as it goes on the truck. Match the code on the label.
      </p>
      <button
        type="button"
        className="rf-link"
        onClick={() =>
          setChecked(
            checked.length === route.toLoad.length
              ? []
              : route.toLoad.map((order) => order.id),
          )
        }
      >
        {checked.length === route.toLoad.length ? "Clear all" : "Tick all"}
      </button>
      {stops.map((stop) => (
        <fieldset key={stop.key} className="dv-group">
          <legend>
            <StopMark stop={stop} /> {stop.recipient} · {stop.address}
          </legend>
          {stop.parcels
            .filter((order) => toLoad.has(order.id))
            .map((order) => (
              <label
                key={order.id}
                className={`dv-check ${checked.includes(order.id) ? "is-checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked.includes(order.id)}
                  onChange={() =>
                    setChecked((ids) =>
                      ids.includes(order.id)
                        ? ids.filter((id) => id !== order.id)
                        : [...ids, order.id],
                    )
                  }
                />
                <span className="dv-check-box" aria-hidden="true">
                  <Icon name="check" size={16} strokeWidth={2.6} />
                </span>
                <span className="dv-parcel-copy">
                  <strong>{order.tracking_code}</strong>
                  <small>
                    {order.parcel_description ?? "No description"}
                    {order.parcel_weight_kg
                      ? ` · ${order.parcel_weight_kg} kg`
                      : ""}
                  </small>
                </span>
              </label>
            ))}
        </fieldset>
      ))}
      <div className="rf-dock">
        <Button
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          disabled={!checked.length || busy || !online}
          onClick={() => onConfirm(checked)}
          sx={{ minHeight: 52, borderRadius: 999 }}
        >
          {busy
            ? "Saving…"
            : !online
              ? "Waiting for connection"
              : checked.length === route.toLoad.length
                ? `Confirm ${checked.length} ${checked.length === 1 ? "parcel" : "parcels"} loaded`
                : `Confirm ${checked.length} of ${route.toLoad.length} loaded`}
        </Button>
        {checked.length > 0 && missing.length > 0 && (
          <Button
            fullWidth
            variant="text"
            color="inherit"
            disabled={busy || !online}
            onClick={() => onReportMissing(missing)}
            sx={{
              minHeight: 44,
              borderRadius: 999,
              mt: 1,
              color: "text.secondary",
            }}
          >
            Tell operations {missing.length}{" "}
            {missing.length === 1 ? "parcel is" : "parcels are"} missing
          </Button>
        )}
      </div>
    </section>
  );
}

function RouteClose({
  route,
  busy,
  online,
  error,
  sessionSaved,
  onClose,
}: {
  route: DriverRoute;
  busy: boolean;
  online: boolean;
  error: ReactNode;
  sessionSaved: boolean;
  onClose: (declared: number) => void;
}) {
  const [cash, setCash] = useState(String(route.codCollected));
  const declared = Number(cash);
  const awaiting = route.parcels
    .filter((order) => order.cod_status === "collected")
    .reduce((sum, order) => sum + order.cod_amount, 0);
  const valid =
    cash.trim() !== "" && Number.isFinite(declared) && declared >= 0;
  return (
    <>
      <section className="dv-summary">
        <h2>Deliveries</h2>
        <dl>
          <div>
            <dt>Delivered</dt>
            <dd className="is-success">{route.delivered}</dd>
          </div>
          <div>
            <dt>Not delivered</dt>
            <dd className={route.failed ? "is-failed" : ""}>{route.failed}</dd>
          </div>
          <div>
            <dt>Stops visited</dt>
            <dd>{route.stops.length}</dd>
          </div>
        </dl>
      </section>
      {route.returns.length > 0 && (
        <section className="dv-summary">
          <h2>
            <Icon name="box" size={18} /> Return to depot
          </h2>
          <ul className="dv-returns">
            {route.returns.map((order) => (
              <li key={order.id}>
                <strong>{order.tracking_code}</strong>
                <span>{order.recipient_name ?? order.customer_name}</span>
                <small>{PARCEL_STATE_LABELS[parcelState(order)]}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="dv-summary">
        <h2>
          <Icon name="coin" size={18} /> Cash on delivery
        </h2>
        <dl>
          <div>
            <dt>Expected today</dt>
            <dd>{currency.format(route.codExpected)}</dd>
          </div>
          <div>
            <dt>Collected</dt>
            <dd>{currency.format(route.codCollected)}</dd>
          </div>
          <div>
            <dt>Not collected</dt>
            <dd
              className={
                route.codExpected - route.codCollected ? "is-warning" : ""
              }
            >
              {currency.format(route.codExpected - route.codCollected)}
            </dd>
          </div>
        </dl>
        <label className="rf-field">
          <span>Cash you are handing in (MMK)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={cash}
            onChange={(event) => setCash(event.target.value)}
          />
        </label>
        {valid && declared !== awaiting && (
          <Notice tone="warning" icon="warning">
            {currency.format(declared)} differs from the{" "}
            {currency.format(awaiting)} recorded as collected. Operations will
            check it when you hand in.
          </Notice>
        )}
      </section>
      {!sessionSaved && (
        <Notice tone="neutral" icon="shield">
          Route closing isn’t set up on the server yet. Hand in the cash and
          returns to operations as usual.
        </Notice>
      )}
      {error}
      <div className="rf-dock">
        <Button
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          disabled={!valid || busy || !online || !sessionSaved}
          onClick={() => onClose(declared)}
          sx={{ minHeight: 52, borderRadius: 999 }}
        >
          {busy
            ? "Closing…"
            : !online
              ? "Waiting for connection"
              : `Close route · hand in ${currency.format(valid ? declared : 0)}`}
        </Button>
      </div>
    </>
  );
}

export function RouteOverview({
  route,
  vehicle,
  dayLabel,
  metrics,
  map,
  notices,
  online,
  busy,
  error,
  sessionSaved,
  closedAt,
  declaredCod,
  onMenu,
  onAcknowledge,
  onLoad,
  onReportMissing,
  onStart,
  onResume,
  onCloseRoute,
}: {
  route: DriverRoute;
  vehicle: VehicleOption | null;
  dayLabel: string;
  metrics: RouteMetrics;
  map: ReactNode;
  notices: ReactNode;
  online: boolean;
  busy: string | null;
  error: ReactNode;
  sessionSaved: boolean;
  closedAt: string | null;
  declaredCod: number | null;
  onMenu: () => void;
  onAcknowledge: () => void;
  onLoad: (orderIds: string[]) => void;
  onReportMissing: (orderIds: string[]) => void;
  onStart: () => void;
  onResume: () => void;
  onCloseRoute: (declared: number) => void;
}) {
  const state = route.state;
  const title =
    state === "COMPLETED"
      ? "All stops done"
      : state === "CLOSED"
        ? "Route closed"
        : state === "PAUSED"
          ? "Route paused"
          : "Today’s route";
  const status: Record<typeof state, string> = {
    NONE: "No route",
    ASSIGNED: "New route",
    MANIFEST_VERIFICATION: "Load check",
    READY: "Ready to start",
    IN_PROGRESS: "In progress",
    PAUSED: "Paused",
    COMPLETED: "Ready to close",
    CLOSED: "Closed",
  };
  const showList = state !== "MANIFEST_VERIFICATION" && route.stops.length > 0;

  return (
    <main className="rf-app dv-overview">
      <header className="rf-overview-head">
        <Brand href="/rider" />
        <Chip
          label={status[state]}
          color={
            state === "IN_PROGRESS"
              ? "info"
              : state === "COMPLETED" || state === "CLOSED"
                ? "success"
                : state === "PAUSED"
                  ? "warning"
                  : "default"
          }
          size="small"
          sx={{ fontWeight: 700, borderRadius: 999 }}
        />
        <IconButton
          onClick={onMenu}
          aria-label="Shift tools"
          sx={{ width: 44, height: 44, color: "text.primary" }}
        >
          <Icon name="menu" size={20} />
        </IconButton>
      </header>
      <h1>{title}</h1>
      <p className="rf-muted rf-subtitle">
        {dayLabel}
        {vehicle
          ? ` · ${vehicle.registration_number} · ${vehicle.vehicle_type.replace("_", "-")}`
          : ""}
      </p>
      {notices}
      {error}

      {state === "NONE" ? (
        <section className="rf-empty">
          <span className="rf-result-mark is-neutral">
            <Icon name="truck" size={26} />
          </span>
          <h2>No route assigned yet</h2>
          <p>
            When operations assigns you a route it appears here with its parcels
            and stops. You don’t need to refresh.
          </p>
        </section>
      ) : (
        <>
          {state !== "CLOSED" && state !== "COMPLETED" && (
            <MetricGrid route={route} metrics={metrics} />
          )}
          {state === "ASSIGNED" && (
            <Notice tone="info" icon="bell">
              <strong>
                Operations assigned you {route.parcels.length}{" "}
                {route.parcels.length === 1 ? "parcel" : "parcels"} for{" "}
                {route.stops.length}{" "}
                {route.stops.length === 1 ? "stop" : "stops"}.
              </strong>{" "}
              This route is already yours. Acknowledge it so dispatch knows
              you’ve seen it.
            </Notice>
          )}
          {state === "PAUSED" && route.current && (
            <Notice tone="warning" icon="history">
              <strong>Paused at stop {route.current.number}.</strong> Customers
              still see their parcels as on the way. Resume when you’re back on
              the road.
            </Notice>
          )}
          {state === "CLOSED" && (
            <Notice tone="success" icon="check">
              Closed{closedAt ? ` at ${formatTime(closedAt)}` : ""}
              {declaredCod != null
                ? ` · ${currency.format(declaredCod)} declared for hand-in`
                : ""}
              . See you next shift.
            </Notice>
          )}
          {map && state !== "MANIFEST_VERIFICATION" && (
            <div className="rf-preview-map">{map}</div>
          )}
          {state === "MANIFEST_VERIFICATION" && (
            <LoadCheck
              route={route}
              busy={busy === "load"}
              online={online}
              onConfirm={onLoad}
              onReportMissing={onReportMissing}
            />
          )}
          {state === "COMPLETED" && (
            <RouteClose
              route={route}
              busy={busy === "close"}
              online={online}
              error={null}
              sessionSaved={sessionSaved}
              onClose={onCloseRoute}
            />
          )}
          {showList && (
            <section aria-labelledby="dv-stops-title">
              <div className="dv-section-head">
                <h2 id="dv-stops-title">
                  {state === "COMPLETED" || state === "CLOSED"
                    ? "Stops today"
                    : "Delivery order"}
                </h2>
                <span className="dv-count">
                  {route.stops.length} stops · {route.parcels.length} parcels
                </span>
              </div>
              <ol className="dv-stop-list">
                {route.stops.map((stop) => (
                  <StopRow key={stop.key} stop={stop} />
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {(state === "ASSIGNED" || state === "READY" || state === "PAUSED") && (
        <div className="rf-dock">
          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            disabled={busy != null || !online}
            onClick={
              state === "ASSIGNED"
                ? onAcknowledge
                : state === "READY"
                  ? onStart
                  : onResume
            }
            endIcon={
              busy == null && online ? (
                <Icon name="arrow-right" size={18} />
              ) : undefined
            }
            sx={{ minHeight: 52, borderRadius: 999 }}
          >
            {busy
              ? "Saving…"
              : !online
                ? "Waiting for connection"
                : state === "ASSIGNED"
                  ? "Acknowledge route"
                  : state === "READY"
                    ? `Start route · ${route.stops.length} stops`
                    : `Resume at stop ${route.current?.number ?? ""}`}
          </Button>
        </div>
      )}
    </main>
  );
}
