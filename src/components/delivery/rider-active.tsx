"use client";

import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef } from "react";

import { Icon } from "@/components/delivery/icons";
import { StopMark, StopRow } from "@/components/delivery/rider-overview";
import { CodTag } from "@/components/delivery/rider-tools";
import type { DeliveryStop, DriverRoute } from "@/lib/delivery/driver-route";
import { formatTime } from "@/lib/delivery/format";

export type GpsState =
  | "off"
  | "waiting"
  | "live"
  | "stale"
  | "denied"
  | "unavailable";

export type Instruction = { title: string; sub: string; arrow: number | null };

function SheetHandle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const start = useRef<{ id: number; y: number } | null>(null);
  const dragged = useRef(false);
  useEffect(() => {
    const cancelDrag = () => {
      start.current = null;
      dragged.current = false;
    };
    window.addEventListener("blur", cancelDrag);
    return () => window.removeEventListener("blur", cancelDrag);
  }, []);
  return (
    <button
      type="button"
      className="rf-handle-btn"
      aria-expanded={open}
      aria-label={open ? "Show less" : "Show stop details and full route"}
      onClick={() => {
        // A drag already toggled the sheet; ignore the click that follows it.
        if (dragged.current) dragged.current = false;
        else onToggle(!open);
      }}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        if (start.current) return;
        start.current = { id: event.pointerId, y: event.clientY };
        dragged.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event: ReactPointerEvent<HTMLButtonElement>) => {
        if (start.current?.id !== event.pointerId) return;
        const delta = event.clientY - start.current.y;
        start.current = null;
        if (Math.abs(delta) > 24) {
          dragged.current = true;
          onToggle(delta < 0);
        }
      }}
      onPointerCancel={(event) => {
        if (start.current?.id === event.pointerId) start.current = null;
        dragged.current = false;
      }}
      onLostPointerCapture={(event) => {
        if (start.current?.id === event.pointerId) start.current = null;
      }}
    >
      <span className="rf-handle" />
    </button>
  );
}

function phoneHref(phone: string, scheme: "tel" | "sms") {
  return `${scheme}:${phone.replace(/\s+/g, "")}`;
}

/**
 * The map-first screen while a route is in progress. The map and the current
 * stop stay on screen throughout; the sheet grows for details, the full
 * route and the handover, and shrinks back without losing the stop.
 */
export function ActiveDelivery({
  route,
  stop,
  map,
  instruction,
  gps,
  online,
  syncing,
  sharingCount,
  revision,
  expanded,
  onExpand,
  handover,
  directionsHref,
  error,
  busy,
  onArrived,
  onUndoArrived,
  onStartHandover,
  onCloseHandover,
  onCannotDeliver,
  onMenu,
  onCautions,
  onLocationHelp,
  cautionBanner,
}: {
  route: DriverRoute;
  stop: DeliveryStop;
  map: ReactNode;
  instruction: Instruction;
  gps: GpsState;
  online: boolean;
  syncing: boolean;
  sharingCount: number | null;
  revision: ReactNode;
  expanded: boolean;
  onExpand: (open: boolean) => void;
  /** The handover form, rendered in the sheet when the driver starts it. */
  handover: ReactNode | null;
  directionsHref: string | null;
  error: ReactNode;
  busy: boolean;
  onArrived: () => void;
  onUndoArrived: () => void;
  onStartHandover: () => void;
  onCloseHandover: () => void;
  onCannotDeliver: () => void;
  onMenu: () => void;
  onCautions: () => void;
  onLocationHelp: () => void;
  cautionBanner: ReactNode;
}) {
  const stage = stop.state;
  const arrived = stage === "ARRIVED" || stage === "HANDOVER_IN_PROGRESS";
  const done = route.stops.filter(
    (item) => item.state === "COMPLETED" || item.state === "FAILED",
  ).length;
  const sheetState = handover ? "is-handover" : expanded ? "is-open" : "";

  return (
    <main className="rf-app rf-nav dv-active">
      {map}

      <header className="dv-top">
        <div
          className="rf-route-progress"
          role="progressbar"
          aria-label="Stops finished"
          aria-valuemin={0}
          aria-valuemax={route.stops.length}
          aria-valuenow={done}
        >
          <span
            style={{ width: `${(done / Math.max(1, route.stops.length)) * 100}%` }}
          />
        </div>
        {!handover && (
          <div className="rf-nav-instruction dv-instruction">
            <span className="rf-turn" aria-hidden="true">
              {instruction.arrow != null ? (
                <svg
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                  style={{ transform: `rotate(${instruction.arrow}deg)` }}
                >
                  <path d="M16 3 26 27l-10-6-10 6Z" />
                </svg>
              ) : (
                <Icon
                  name={arrived ? "location" : "compass"}
                  size={26}
                  strokeWidth={2.2}
                />
              )}
            </span>
            <div>
              <strong>{instruction.title}</strong>
              <span>{instruction.sub}</span>
            </div>
          </div>
        )}
        {!handover && cautionBanner}
        <div className="dv-top-row">
          <div className="dv-chips">
            {gps === "denied" || gps === "unavailable" ? (
              <button
                type="button"
                className="rf-chip is-error dv-chip-btn"
                onClick={onLocationHelp}
              >
                <Icon name="location" size={14} />
                {gps === "denied" ? "Location off" : "No GPS"} · Fix
              </button>
            ) : gps === "stale" ? (
              <button
                type="button"
                className="rf-chip is-warning dv-chip-btn"
                onClick={onLocationHelp}
              >
                <Icon name="warning" size={14} /> GPS signal old
              </button>
            ) : gps === "waiting" ? (
              <span className="rf-chip">Finding GPS…</span>
            ) : sharingCount ? (
              <span className="rf-chip is-live">
                <span className="rf-live-dot" /> Live to {sharingCount}{" "}
                {sharingCount === 1 ? "customer" : "customers"}
              </span>
            ) : null}
            {!online ? (
              <span className="rf-chip is-warning">
                <Icon name="warning" size={14} /> Offline
              </span>
            ) : syncing ? (
              <span className="rf-chip">
                <Icon name="refresh" size={14} /> Saving…
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="rf-icon-btn dv-float-btn"
            onClick={onMenu}
            aria-label="Shift tools"
          >
            <Icon name="menu" size={20} />
          </button>
        </div>
        {!handover && revision}
      </header>

      <section
        className={`rf-sheet dv-sheet ${sheetState}`}
        aria-label={`Stop ${stop.number} of ${route.stops.length}`}
      >
        {handover ? (
          <>
            <div className="dv-sheet-head">
              <button
                type="button"
                className="rf-icon-btn"
                onClick={onCloseHandover}
                aria-label="Back to stop"
                disabled={busy}
              >
                <Icon name="arrow-left" size={20} />
              </button>
              <div>
                <small>
                  Stop {stop.number} of {route.stops.length} · Handover
                </small>
                <h2>{stop.recipient}</h2>
              </div>
            </div>
            {handover}
          </>
        ) : (
          <>
            <SheetHandle open={expanded} onToggle={onExpand} />
            <div className="dv-stop-head">
              <div className="dv-stop-count">
                <StopMark stop={stop} />
                <small>
                  of {route.stops.length}
                </small>
              </div>
              <div className="dv-stop-title">
                <small className={arrived ? "is-arrived" : ""}>
                  {arrived ? "At the stop" : "Next stop"}
                </small>
                <h2>{stop.recipient}</h2>
                <p>{stop.address}</p>
              </div>
              {directionsHref && !arrived && (
                <a
                  className="rg-navigate"
                  href={directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open turn-by-turn directions in Google Maps"
                >
                  <Icon name="navigation" size={22} />
                  <span>Directions</span>
                </a>
              )}
            </div>
            <div className="dv-meta">
              <span>
                <Icon name="box" size={14} /> {stop.open.length}{" "}
                {stop.open.length === 1 ? "parcel" : "parcels"}
              </span>
              {stop.etaAt && (
                <span>
                  <Icon name="history" size={14} /> ETA {formatTime(stop.etaAt)}
                </span>
              )}
              <CodTag amount={stop.codDue} />
            </div>

            <fieldset className="rg-actions dv-quick">
              <legend className="rf-sr-only">Contact the recipient</legend>
              {stop.phone ? (
                <>
                  <a href={phoneHref(stop.phone, "tel")}>
                    <Icon name="phone" size={20} />
                    <span>Call</span>
                  </a>
                  <a href={phoneHref(stop.phone, "sms")}>
                    <Icon name="message" size={20} />
                    <span>Message</span>
                  </a>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard?.writeText(stop.address)
                  }
                >
                  <Icon name="copy" size={20} />
                  <span>Copy address</span>
                </button>
              )}
              <button type="button" onClick={() => onExpand(!expanded)}>
                <Icon name="list" size={20} />
                <span>{expanded ? "Less" : "Details"}</span>
              </button>
            </fieldset>

            {expanded && (
              <div className="rf-sheet-body dv-details">
                {!stop.phone && (
                  <p className="rf-muted">
                    No phone number on this order. Use “Can’t deliver” if you
                    can’t find the recipient.
                  </p>
                )}
                <div className="rf-detail">
                  <h3>
                    {stop.open.length > 1
                      ? `${stop.open.length} parcels to hand over`
                      : "Parcel to hand over"}
                  </h3>
                  <ul className="dv-parcel-list">
                    {stop.open.map((order) => (
                      <li key={order.id}>
                        <strong>{order.tracking_code}</strong>
                        <span>
                          {order.parcel_description ?? "No description"}
                          {order.parcel_weight_kg
                            ? ` · ${order.parcel_weight_kg} kg`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {stop.notLoaded.length > 0 && (
                    <p className="rf-muted">
                      {stop.notLoaded.length} more for this recipient{" "}
                      {stop.notLoaded.length === 1 ? "is" : "are"} not on your
                      truck.
                    </p>
                  )}
                </div>
                <div className="rf-detail">
                  <h3>Delivery instructions</h3>
                  <p className="rf-muted">
                    No instructions from the sender. Call the recipient if the
                    address is hard to find.
                  </p>
                </div>
                {route.upcoming.length > 0 && (
                  <div className="rf-detail">
                    <h3>Then · {route.upcoming.length} more stops</h3>
                    <ol className="dv-stop-list is-compact">
                      {route.upcoming.map((item) => (
                        <StopRow key={item.key} stop={item} showState={false} />
                      ))}
                    </ol>
                  </div>
                )}
                {route.stops.some(
                  (item) =>
                    item.state === "COMPLETED" || item.state === "FAILED",
                ) && (
                  <details className="dv-done">
                    <summary>
                      {done} {done === 1 ? "stop" : "stops"} finished
                    </summary>
                    <ol className="dv-stop-list is-compact">
                      {route.stops
                        .filter(
                          (item) =>
                            item.state === "COMPLETED" ||
                            item.state === "FAILED",
                        )
                        .map((item) => (
                          <StopRow key={item.key} stop={item} />
                        ))}
                    </ol>
                  </details>
                )}
                <div className="dv-secondary">
                  <button
                    type="button"
                    className="rf-btn rf-btn-secondary"
                    onClick={onCannotDeliver}
                  >
                    Can’t deliver this stop
                  </button>
                  <button
                    type="button"
                    className="rf-btn rf-btn-secondary"
                    onClick={onCautions}
                  >
                    <Icon name="warning" size={18} /> Road conditions
                  </button>
                  {arrived && (
                    <button
                      type="button"
                      className="rf-btn rf-btn-quiet"
                      onClick={onUndoArrived}
                    >
                      Not here yet — back to navigation
                    </button>
                  )}
                </div>
              </div>
            )}

            {error}
            <div className="dv-sheet-actions">
              {arrived ? (
                <>
                  <button
                    type="button"
                    className="rf-btn rf-btn-primary"
                    onClick={onStartHandover}
                  >
                    Start handover
                    <Icon name="arrow-right" size={18} />
                  </button>
                  {!expanded && (
                    <button
                      type="button"
                      className="rf-btn rf-btn-quiet"
                      onClick={onCannotDeliver}
                    >
                      Can’t deliver
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="rf-btn rf-btn-primary"
                  onClick={onArrived}
                >
                  I’ve arrived
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
