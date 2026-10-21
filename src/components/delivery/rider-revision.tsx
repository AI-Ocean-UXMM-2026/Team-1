"use client";

import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import type { ReactNode } from "react";

import { Icon } from "@/components/delivery/icons";
import type {
  DeliveryStop,
  DriverRoute,
  RouteRevision,
  RouteSnapshot,
} from "@/lib/delivery/driver-route";
import { currency, formatTime } from "@/lib/delivery/format";
import type { DeliveryOrder } from "@/lib/delivery/types";

export type AcknowledgedState = {
  snapshot: RouteSnapshot;
  current: string | null;
  finishBy: string | null;
};

export type RouteRevisionNoticeProps = {
  route: DriverRoute;
  started: boolean;
  revision: RouteRevision | null;
  revisionOpen: boolean;
  onOpenChange: (open: boolean) => void;
  stop: DeliveryStop | null;
  finishEstimate: (route: DriverRoute) => string | null;
  acknowledged: AcknowledgedState | null;
  errorBanner: ReactNode;
  busy: string | null;
  online: boolean;
  onAcknowledge: () => void;
  onLoadParcels: (ids: string[]) => void;
  onDismiss: () => void;
};

export function RouteRevisionNotice({
  route,
  started,
  revision,
  revisionOpen,
  onOpenChange,
  stop,
  finishEstimate,
  acknowledged,
  errorBanner,
  busy,
  online,
  onAcknowledge,
  onLoadParcels,
  onDismiss,
}: RouteRevisionNoticeProps) {
  const waitingToLoad = started ? route.toLoad : [];
  const unacknowledged = started ? route.unacknowledged : [];
  if (!revision && !waitingToLoad.length && !unacknowledged.length) {
    return null;
  }

  const added = revision?.addedParcels ?? unacknowledged;
  const addedStops = route.stops.filter((item: DeliveryStop) =>
    item.parcels.some((order: DeliveryOrder) =>
      added.some((other) => other.id === order.id),
    ),
  );
  const finishNow = finishEstimate(route);
  const summary = [
    added.length
      ? `${addedStops.length} ${addedStops.length === 1 ? "stop" : "stops"} added`
      : null,
    revision?.removedParcels.length
      ? `${revision.removedParcels.length} ${revision.removedParcels.length === 1 ? "parcel" : "parcels"} removed`
      : null,
    revision?.reordered ? "order changed" : null,
    !added.length && waitingToLoad.length
      ? `${waitingToLoad.length} to load`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const needsAck = unacknowledged.length > 0;

  if (!revisionOpen) {
    return (
      <button
        type="button"
        className={`dv-revision ${revision?.currentChanged ? "is-urgent" : ""}`}
        onClick={() => onOpenChange(true)}
        aria-expanded="false"
      >
        <Icon name="bell" size={18} />
        <span>
          <strong>Route updated by dispatch</strong>
          <small>{summary}</small>
        </span>
        <span className="dv-revision-cta">{needsAck ? "Review" : "View"}</span>
      </button>
    );
  }

  return (
    <section className="dv-revision is-open" aria-label="Route update">
      <div className="dv-revision-head">
        <Icon name="bell" size={18} />
        <strong>Route updated by dispatch</strong>
        <IconButton
          onClick={() => onOpenChange(false)}
          aria-label="Hide route update"
          sx={{ width: 36, height: 36, color: "inherit", ml: "auto" }}
        >
          <Icon name="close" size={18} />
        </IconButton>
      </div>
      <ul>
        {addedStops.map((item: DeliveryStop) => (
          <li key={item.key}>
            <strong>
              + Stop {item.number} · {item.recipient}
            </strong>
            <span>
              {item.address} · {item.parcels.length}{" "}
              {item.parcels.length === 1 ? "parcel" : "parcels"}
              {item.codDue > 0 ? ` · COD ${currency.format(item.codDue)}` : ""}
            </span>
          </li>
        ))}
        {revision?.reordered && (
          <li>
            <strong>Delivery order changed</strong>
            <span>The stop list below shows the new order.</span>
          </li>
        )}
        {revision?.removedParcels.length ? (
          <li>
            <strong>
              {revision.removedParcels.length}{" "}
              {revision.removedParcels.length === 1 ? "parcel" : "parcels"}{" "}
              taken off your route
            </strong>
            <span>Keep them on the truck until operations says otherwise.</span>
          </li>
        ) : null}
        <li>
          <strong>
            {revision?.currentChanged && stop
              ? `Your next stop is now stop ${stop.number} · ${stop.recipient}`
              : "Your current stop hasn’t changed"}
          </strong>
          <span>
            {finishNow
              ? `Finish by ${formatTime(finishNow)}${
                  acknowledged?.finishBy && acknowledged.finishBy !== finishNow
                    ? ` (was ${formatTime(acknowledged.finishBy)})`
                    : ""
                }`
              : "No finish time from dispatch"}
          </span>
        </li>
        {waitingToLoad.length > 0 && (
          <li>
            <strong>
              {waitingToLoad.length}{" "}
              {waitingToLoad.length === 1 ? "parcel isn’t" : "parcels aren’t"}{" "}
              on your truck yet
            </strong>
            <span>
              Collect from {waitingToLoad[0].pickup_address} as dispatch
              arranges, then mark it loaded.
            </span>
          </li>
        )}
      </ul>
      {errorBanner}
      {needsAck ? (
        <Button
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          disabled={busy != null || !online}
          onClick={onAcknowledge}
          sx={{ minHeight: 48, borderRadius: 999 }}
        >
          {busy === "acknowledge" ? "Saving…" : "Acknowledge changes"}
        </Button>
      ) : waitingToLoad.length ? (
        <Button
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          disabled={busy != null || !online}
          onClick={() =>
            onLoadParcels(waitingToLoad.map((order: DeliveryOrder) => order.id))
          }
          sx={{ minHeight: 48, borderRadius: 999 }}
        >
          {busy === "load" ? "Saving…" : `Mark ${waitingToLoad.length} loaded`}
        </Button>
      ) : (
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          onClick={onDismiss}
          sx={{ minHeight: 48, borderRadius: 999 }}
        >
          Got it
        </Button>
      )}
    </section>
  );
}
