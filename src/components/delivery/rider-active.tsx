"use client";

import ForkLeftRounded from "@mui/icons-material/ForkLeftRounded";
import ForkRightRounded from "@mui/icons-material/ForkRightRounded";
import MergeRounded from "@mui/icons-material/MergeRounded";
import NavigationRounded from "@mui/icons-material/NavigationRounded";
import PlaceRounded from "@mui/icons-material/PlaceRounded";
import RoundaboutRightRounded from "@mui/icons-material/RoundaboutRightRounded";
import StraightRounded from "@mui/icons-material/StraightRounded";
import TurnLeftRounded from "@mui/icons-material/TurnLeftRounded";
import TurnRightRounded from "@mui/icons-material/TurnRightRounded";
import TurnSharpLeftRounded from "@mui/icons-material/TurnSharpLeftRounded";
import TurnSharpRightRounded from "@mui/icons-material/TurnSharpRightRounded";
import TurnSlightLeftRounded from "@mui/icons-material/TurnSlightLeftRounded";
import TurnSlightRightRounded from "@mui/icons-material/TurnSlightRightRounded";
import UTurnLeftRounded from "@mui/icons-material/UTurnLeftRounded";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { StopMark, StopRow } from "@/components/delivery/rider-overview";
import { CodTag } from "@/components/delivery/rider-tools";
import type { DeliveryStop, DriverRoute } from "@/lib/delivery/driver-route";
import { formatTime } from "@/lib/delivery/format";
import {
  formatDistance,
  resolveTurnSymbol,
  type TurnSymbol,
} from "@/lib/delivery/rider-route";

export type GpsState =
  | "off"
  | "waiting"
  | "live"
  | "stale"
  | "denied"
  | "unavailable";

export type Instruction = {
  title: string;
  sub: string;
  arrow: number | null;
  turnSymbol?: TurnSymbol | null;
};

export function TurnSymbolIcon({
  instruction,
  arrived,
}: {
  instruction: Instruction;
  arrived?: boolean;
}) {
  if (instruction.arrow != null) {
    return (
      <NavigationRounded
        sx={{
          fontSize: 28,
          transform: `rotate(${instruction.arrow}deg)`,
          transition: "transform 400ms ease",
        }}
      />
    );
  }

  const symbol =
    instruction.turnSymbol ??
    (arrived ? "arrive" : resolveTurnSymbol(instruction.title));

  if (arrived || symbol === "arrive") {
    return <PlaceRounded sx={{ fontSize: 28 }} />;
  }

  switch (symbol) {
    case "turn-right":
      return <TurnRightRounded sx={{ fontSize: 28 }} />;
    case "turn-left":
      return <TurnLeftRounded sx={{ fontSize: 28 }} />;
    case "slight-right":
      return <TurnSlightRightRounded sx={{ fontSize: 28 }} />;
    case "slight-left":
      return <TurnSlightLeftRounded sx={{ fontSize: 28 }} />;
    case "sharp-right":
      return <TurnSharpRightRounded sx={{ fontSize: 28 }} />;
    case "sharp-left":
      return <TurnSharpLeftRounded sx={{ fontSize: 28 }} />;
    case "u-turn":
      return <UTurnLeftRounded sx={{ fontSize: 28 }} />;
    case "roundabout":
      return <RoundaboutRightRounded sx={{ fontSize: 28 }} />;
    case "fork-left":
      return <ForkLeftRounded sx={{ fontSize: 28 }} />;
    case "fork-right":
      return <ForkRightRounded sx={{ fontSize: 28 }} />;
    case "merge":
      return <MergeRounded sx={{ fontSize: 28 }} />;
    default:
      return <StraightRounded sx={{ fontSize: 28 }} />;
  }
}

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

/** Beyond this, "I've arrived" asks first: a mis-tap would tell the customer the rider is there. */
const FAR_FROM_STOP_KM = 0.3;

/**
 * Times for the next stops in the timeline. They are the seller's promised
 * times, not road ETAs, so one that is earlier than the stop before it is
 * flagged rather than shown as if the rider would get there first.
 */
function timelineTimes(
  previous: string | null,
  stops: DeliveryStop[],
): ({ label: string; warn: boolean } | null)[] {
  let floor = previous;
  return stops.map((item) => {
    if (!item.etaAt) return null;
    const warn = floor != null && Date.parse(item.etaAt) < Date.parse(floor);
    if (!warn) floor = item.etaAt;
    return { label: `by ${formatTime(item.etaAt)}`, warn };
  });
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
  liveEtaAt,
  distanceKm,
  onSheetHeight,
}: {
  route: DriverRoute;
  stop: DeliveryStop;
  map: ReactNode;
  instruction: Instruction;
  gps: GpsState;
  online: boolean;
  syncing: boolean;
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
  /** Arrival time from the live road route, when there is one. */
  liveEtaAt: string | null;
  /** Straight-line distance from the rider to this stop, when GPS is live. */
  distanceKm: number | null;
  /** Reports the sheet's rendered height so the map can keep the route clear of it. */
  onSheetHeight: (px: number) => void;
}) {
  const stage = stop.state;
  const arrived = stage === "ARRIVED" || stage === "HANDOVER_IN_PROGRESS";
  const done = route.stops.filter(
    (item) => item.state === "COMPLETED" || item.state === "FAILED",
  ).length;
  const sheetState = [
    handover ? "is-handover" : expanded ? "is-open" : "",
    arrived ? "is-arrived" : "is-navigating",
  ]
    .filter(Boolean)
    .join(" ");
  const [confirmFar, setConfirmFar] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = sheetRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      onSheetHeight(Math.round(entry.borderBoxSize[0]?.blockSize ?? 0)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onSheetHeight]);
  const far = distanceKm != null && distanceKm > FAR_FROM_STOP_KM;
  const headEta = liveEtaAt
    ? `ETA ${formatTime(liveEtaAt)}`
    : stop.etaAt
      ? `Due by ${formatTime(stop.etaAt)}`
      : null;
  const nextStops = route.upcoming.slice(0, 2);
  const upcomingTimes = timelineTimes(
    liveEtaAt ?? stop.etaAt,
    nextStops,
  );

  return (
    <main className="rf-app rf-nav dv-active">
      {map}

      <header className="dv-top">
        <LinearProgress
          variant="determinate"
          value={(done / Math.max(1, route.stops.length)) * 100}
          aria-label="Stops finished"
          aria-valuemin={0}
          aria-valuemax={route.stops.length}
          aria-valuenow={done}
          sx={{
            height: 4,
            bgcolor: "grey.200",
            "& .MuiLinearProgress-bar": {
              bgcolor: "primary.main",
              borderRadius: 999,
            },
          }}
        />
        {!handover && (
          <div className="rf-nav-instruction dv-instruction">
            <span className="rf-turn" aria-hidden="true">
              <TurnSymbolIcon instruction={instruction} arrived={arrived} />
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
              <Chip
                size="small"
                color="error"
                icon={<Icon name="location" size={14} />}
                label={gps === "denied" ? "Location off · Fix" : "No GPS · Fix"}
                onClick={onLocationHelp}
                sx={{ fontWeight: 650, borderRadius: 999 }}
              />
            ) : gps === "stale" ? (
              <Chip
                size="small"
                color="warning"
                icon={<Icon name="warning" size={14} />}
                label="GPS signal old"
                onClick={onLocationHelp}
                sx={{ fontWeight: 650, borderRadius: 999 }}
              />
            ) : gps === "waiting" ? (
              <Chip
                size="small"
                label="Finding GPS…"
                sx={{ fontWeight: 650, borderRadius: 999 }}
              />
            ) : null}
            {!online ? (
              <Chip
                size="small"
                color="warning"
                icon={<Icon name="warning" size={14} />}
                label="Offline"
                sx={{ fontWeight: 650, borderRadius: 999 }}
              />
            ) : syncing ? (
              <Chip
                size="small"
                icon={<Icon name="refresh" size={14} />}
                label="Saving…"
                sx={{ fontWeight: 650, borderRadius: 999 }}
              />
            ) : null}
          </div>
          <div className="dv-float-col">
            <IconButton
              className="dv-float-btn"
              onClick={onMenu}
              aria-label="Shift tools"
              sx={{
                width: 48,
                height: 48,
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: 2,
                "&:hover": { bgcolor: "grey.100" },
              }}
            >
              <Icon name="menu" size={20} />
            </IconButton>
            {!handover && (
              <IconButton
                className="dv-float-btn"
                onClick={onCautions}
                aria-label="Road conditions"
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: "background.paper",
                  color: "text.primary",
                  boxShadow: 2,
                  "&:hover": { bgcolor: "grey.100" },
                }}
              >
                <Icon name="warning" size={20} />
              </IconButton>
            )}
          </div>
        </div>
        {!handover && revision}
      </header>

      <section
        ref={sheetRef}
        className={`rf-sheet dv-sheet ${sheetState}`}
        aria-label={`Stop ${stop.number} of ${route.stops.length}`}
      >
        {handover ? (
          <>
            <div className="dv-sheet-head">
              <IconButton
                onClick={onCloseHandover}
                aria-label="Back to stop"
                disabled={busy}
                sx={{ width: 48, height: 48, color: "text.primary" }}
              >
                <Icon name="arrow-left" size={20} />
              </IconButton>
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
              <StopMark stop={stop} />
              <div className="dv-stop-title">
                <small className={arrived ? "is-arrived" : ""}>
                  {arrived ? "At the stop" : "Next stop"} · {stop.number} of{" "}
                  {route.stops.length}
                  {headEta && !arrived ? ` · ${headEta}` : ""}
                </small>
                <h2>{stop.recipient}</h2>
                <p>{stop.address}</p>
                <div className="dv-meta">
                  <span>
                    <Icon name="box" size={14} /> {stop.open.length}{" "}
                    {stop.open.length === 1 ? "parcel" : "parcels"}
                  </span>
                  <CodTag amount={stop.codDue} />
                </div>
              </div>
              {directionsHref && !arrived && (
                <a
                  className="dv-directions"
                  href={directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open turn-by-turn directions in Google Maps"
                >
                  <Icon name="navigation" size={20} />
                </a>
              )}
            </div>

            {expanded && (
              <div className="rf-sheet-body dv-details">
                <div className="dv-facts">
                  <div>
                    {stop.open.length > 1 && (
                      <h3>{stop.open.length} parcels</h3>
                    )}
                    <ul className="dv-parcel-list">
                      {stop.open.map((order) => (
                        <li key={order.id}>
                          <Icon name="box" size={16} />
                          <span>
                            <span>
                              <strong>{order.tracking_code}</strong>
                              {order.parcel_weight_kg
                                ? ` · ${order.parcel_weight_kg} kg`
                                : ""}
                            </span>
                            {order.parcel_description && (
                              <small>{order.parcel_description}</small>
                            )}
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
                  {!stop.phone && (
                    <p className="rf-muted">No phone number on this order.</p>
                  )}
                </div>
                {nextStops.length > 0 && (
                  <div className="rf-detail">
                    <h3>Then</h3>
                    <ol className="dv-stop-list is-compact">
                      {nextStops.map((item, index) => (
                        <StopRow
                          key={item.key}
                          stop={item}
                          showState={false}
                          dense
                          time={upcomingTimes[index]}
                        />
                      ))}
                    </ol>
                    {route.upcoming.length > nextStops.length && (
                      <p className="dv-more">
                        +{route.upcoming.length - nextStops.length} more{" "}
                        {route.upcoming.length - nextStops.length === 1
                          ? "stop"
                          : "stops"}{" "}
                        after these
                      </p>
                    )}
                  </div>
                )}
                <div className="dv-secondary">
                  <button type="button" onClick={onCannotDeliver}>
                    <Icon name="warning" size={16} /> Problem with this stop
                  </button>
                  {!stop.phone && (
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard?.writeText(stop.address)
                      }
                    >
                      <Icon name="copy" size={16} /> Copy address
                    </button>
                  )}
                  {arrived && (
                    <button type="button" onClick={onUndoArrived}>
                      Not here yet
                    </button>
                  )}
                </div>
              </div>
            )}

            {error}
            <div className="dv-sheet-actions">
              {stop.phone && !(confirmFar && far && !arrived) && (
                <>
                  <a
                    className="dv-round dv-round-call"
                    href={phoneHref(stop.phone, "tel")}
                    aria-label={`Call ${stop.recipient}`}
                  >
                    <Icon name="phone" size={20} />
                  </a>
                  <a
                    className="dv-round dv-round-msg"
                    href={phoneHref(stop.phone, "sms")}
                    aria-label={`Message ${stop.recipient}`}
                  >
                    <Icon name="message" size={20} />
                  </a>
                </>
              )}
              {arrived ? (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={onStartHandover}
                  endIcon={<Icon name="arrow-right" size={18} />}
                  sx={{ minHeight: 48, borderRadius: 999, flex: 1 }}
                >
                  Start handover
                </Button>
              ) : confirmFar && far ? (
                <div className="dv-confirm" role="alert">
                  <span>
                    You’re {formatDistance(distanceKm)} away. Arrived anyway?
                  </span>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => setConfirmFar(false)}
                    sx={{ minHeight: 48, borderRadius: 999 }}
                  >
                    Not yet
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      setConfirmFar(false);
                      onArrived();
                    }}
                    sx={{ minHeight: 48, borderRadius: 999 }}
                  >
                    Yes, I’m here
                  </Button>
                </div>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={() => (far ? setConfirmFar(true) : onArrived())}
                  sx={{ minHeight: 48, borderRadius: 999, flex: 1 }}
                >
                  I’ve arrived
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
