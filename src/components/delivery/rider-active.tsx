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
import type {
  CSSProperties,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { StopRow } from "@/components/delivery/rider-overview";
import { SwipeConfirm } from "@/components/delivery/swipe-confirm";
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

/**
 * One line of text that slides back and forth when it is wider than its box,
 * so a long address stays whole without taking extra rows. With reduced
 * motion it wraps instead (see rider-delivery.css).
 */
function MarqueeText({ children }: { children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const outer = box.current;
    const inner = text.current;
    if (!outer || !inner) return;
    const measure = () =>
      setShift(Math.max(0, inner.scrollWidth - outer.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);
  return (
    <span ref={box} className="dv-marquee">
      <span
        ref={text}
        className={shift > 0 ? "is-moving" : undefined}
        style={
          shift > 0
            ? ({
                "--shift": `-${shift}px`,
                "--dur": `${Math.max(6, shift / 24 + 4)}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}

/**
 * Posted limit with the rider's live speed beside it, as in Google Maps and
 * Waze. The limit only shows when the road has one; the speed turns red while
 * the rider is over it. Nothing renders until there is something to show.
 */
function SpeedSign({
  currentKmh,
  limitKmh,
}: {
  currentKmh: number | null;
  limitKmh: number | null;
}) {
  if (currentKmh == null && limitKmh == null) return null;
  const over = currentKmh != null && limitKmh != null && currentKmh > limitKmh;
  return (
    <fieldset className="dv-speed">
      <legend className="sr-only">
        {limitKmh != null
          ? `Speed limit ${limitKmh} kilometres per hour`
          : "Speed"}
      </legend>
      {limitKmh != null && (
        <span className="dv-limit" aria-hidden="true">
          {limitKmh}
        </span>
      )}
      {currentKmh != null && (
        <span className={`dv-now${over ? " is-over" : ""}`}>
          <strong>{currentKmh}</strong>
          <small>km/h</small>
        </span>
      )}
    </fieldset>
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
  speed,
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
  /** Live speed and the posted limit (km/h); null when there is no GPS fix. */
  speed: { currentKmh: number | null; limitKmh: number | null } | null;
  /** Straight-line distance from the rider to this stop, when GPS is live. */
  distanceKm: number | null;
  /** Reports the sheet's rendered height so the map can keep the route clear of it. */
  onSheetHeight: (px: number) => void;
}) {
  const stage = stop.state;
  const arrived = stage === "ARRIVED" || stage === "HANDOVER_IN_PROGRESS";
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
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry.borderBoxSize[0]?.blockSize ?? 0);
      node.parentElement?.style.setProperty("--dv-sheet-h", `${height}px`);
      onSheetHeight(height);
    });
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
  const upcomingTimes = timelineTimes(liveEtaAt ?? stop.etaAt, nextStops);

  return (
    <main className="rf-app rf-nav dv-active">
      {map}

      <header className="dv-top">
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

      {speed && !handover && !expanded && <SpeedSign {...speed} />}

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
                <p>{stop.address}</p>
              </div>
            </div>
            {handover}
          </>
        ) : (
          <>
            <SheetHandle open={expanded} onToggle={onExpand} />
            <div className="dv-stage">
              <div className="dv-stage-line">
                <small className={arrived ? "is-arrived" : ""}>
                  {arrived ? "At the stop" : "Next stop"} · {stop.number} of{" "}
                  {route.stops.length}
                </small>
                {headEta && !arrived && <strong>{headEta}</strong>}
              </div>
            </div>
            <div className="dv-stop-head">
              <div className="dv-stop-title">
                <h2>
                  <MarqueeText>{stop.address}</MarqueeText>
                </h2>
                <p>
                  <Icon name="user" size={14} />
                  <MarqueeText>
                    {stop.recipient} · {stop.open.length}{" "}
                    {stop.open.length === 1 ? "parcel" : "parcels"}
                  </MarqueeText>
                </p>
              </div>
            </div>
            <fieldset className="dv-strip">
              <legend className="sr-only">Stop actions</legend>
              {stop.phone ? (
                <>
                  <a
                    href={phoneHref(stop.phone, "tel")}
                    aria-label={`Call ${stop.recipient}`}
                  >
                    <Icon name="phone" size={20} />
                    <span>Call</span>
                  </a>
                  <a
                    href={phoneHref(stop.phone, "sms")}
                    aria-label={`Message ${stop.recipient}`}
                  >
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
              <button
                type="button"
                onClick={onCannotDeliver}
                aria-label="Problem with this stop"
              >
                <Icon name="warning" size={20} />
                <span>Problem</span>
              </button>
            </fieldset>

            {expanded && (
              <div className="rf-sheet-body dv-details">
                <dl className="dv-rows">
                  {stop.open.map((order) => (
                    <div key={order.id}>
                      <dt>Parcel</dt>
                      <dd>
                        <strong>{order.tracking_code}</strong>
                        <small>
                          {[
                            order.parcel_description,
                            order.parcel_weight_kg
                              ? `${order.parcel_weight_kg} kg`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </dd>
                    </div>
                  ))}
                  {stop.phone && (
                    <div>
                      <dt>Phone</dt>
                      <dd>{stop.phone}</dd>
                    </div>
                  )}
                  {stop.notLoaded.length > 0 && (
                    <div>
                      <dt>Not on truck</dt>
                      <dd>{stop.notLoaded.length} more for this recipient</dd>
                    </div>
                  )}
                </dl>
                {nextStops.length > 0 && (
                  <div className="dv-next">
                    <h3>Next stops</h3>
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
                {arrived && (
                  <button
                    type="button"
                    className="dv-text-btn"
                    onClick={onUndoArrived}
                  >
                    Not here yet — back to navigation
                  </button>
                )}
              </div>
            )}

            {error}
            {(arrived || confirmFar || expanded) && (
              <div className="dv-sheet-actions">
                {arrived ? (
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={onStartHandover}
                    endIcon={<Icon name="arrow-right" size={18} />}
                    sx={{ minHeight: 56, borderRadius: 999 }}
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
                  <SwipeConfirm
                    label="I’ve arrived"
                    hint="Swipe to confirm arrival"
                    onConfirm={() => (far ? setConfirmFar(true) : onArrived())}
                  />
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
