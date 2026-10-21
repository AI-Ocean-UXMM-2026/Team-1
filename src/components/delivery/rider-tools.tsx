"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

import { Icon, type IconName } from "@/components/delivery/icons";
import { currency, formatTime } from "@/lib/delivery/format";
import {
  cautionCopy,
  type energyForRoute,
  formatDistance,
  type RoadCaution,
} from "@/lib/delivery/rider-route";
import type {
  RiderRequest,
  RiderRequestCategory,
  RoadReport,
  VehicleOption,
} from "@/lib/delivery/types";

/* Shared pieces of the driver flow: notices, COD tags, and the sheets for
   shift tools, fuel, road cautions and problems that aren't about a parcel. */

export function Notice({
  tone,
  icon,
  children,
  action,
}: {
  tone: "info" | "warning" | "error" | "success" | "neutral";
  icon: IconName;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`rf-notice rf-notice-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={icon} size={18} strokeWidth={2.1} />
      <div className="rf-notice-copy">{children}</div>
      {action}
    </div>
  );
}

/** COD always shows a coin and the word, never colour alone. */
export function CodTag({
  amount,
  collected = false,
}: {
  amount: number;
  collected?: boolean;
}) {
  if (amount <= 0)
    return (
      <span className="dv-tag">
        <Icon name="check" size={14} strokeWidth={2.2} /> No COD
      </span>
    );
  return (
    <span className={`rf-cod ${collected ? "is-collected" : "is-due"}`}>
      <Icon name="coin" size={14} strokeWidth={2.1} />
      {collected ? "COD collected" : "Collect COD"} · {currency.format(amount)}
    </span>
  );
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="rf-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <section
        className="rf-sheet rf-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dv-sheet-title"
      >
        <span className="rf-handle" aria-hidden="true" />
        <div className="rf-sheet-head">
          <div>
            <h2 id="dv-sheet-title">{title}</h2>
            {subtitle && <p className="rf-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="rf-icon-btn"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="rf-panel-body">{children}</div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- menu */

const REQUEST_LABELS: Record<RiderRequestCategory, string> = {
  refuel: "Fuel stop",
  recharge: "Charging stop",
  vehicle_problem: "Vehicle problem",
  accident: "Accident",
  parcel_damaged: "Parcel damaged",
  unsafe_area: "Unsafe area",
  other: "Issue",
};

function RequestStatus({ request }: { request: RiderRequest }) {
  const label =
    request.status === "resolved"
      ? "Resolved"
      : request.status === "acknowledged"
        ? "Operations is on it"
        : "Waiting for operations";
  return (
    <span className={`rf-request-status is-${request.status}`}>{label}</span>
  );
}

export type ToolPanel = "menu" | "energy" | "cautions" | "problem";

export function ShiftMenu({
  name,
  vehicle,
  energy,
  cautionCount,
  requests,
  canPause,
  paused,
  onOpen,
  onPause,
  onResume,
  onSignOut,
  onClose,
}: {
  name: string;
  vehicle: VehicleOption | null;
  energy: ReturnType<typeof energyForRoute>;
  cautionCount: number;
  requests: RiderRequest[];
  canPause: boolean;
  paused: boolean;
  onOpen: (panel: Exclude<ToolPanel, "menu">) => void;
  onPause: () => void;
  onResume: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const items: {
    id: Exclude<ToolPanel, "menu">;
    icon: IconName;
    label: string;
    detail: string;
  }[] = [
    {
      id: "energy",
      icon: energy.source === "battery" ? "battery" : "fuel",
      label: energy.source === "battery" ? "Battery" : "Fuel",
      detail:
        energy.levelPercent == null
          ? "Level not set"
          : `${energy.levelPercent}% · ${energyStatusLabel(energy.status)}`,
    },
    {
      id: "cautions",
      icon: "warning",
      label: "Road conditions",
      detail: cautionCount
        ? `${cautionCount} on your route · report one`
        : "None on your route · report one",
    },
    {
      id: "problem",
      icon: "help",
      label: "Vehicle or safety problem",
      detail: "Breakdown, accident, unsafe area",
    },
  ];
  return (
    <Sheet
      title="Shift tools"
      subtitle={
        vehicle
          ? `${name} · ${vehicle.registration_number} · ${vehicle.vehicle_type.replace("_", "-")}`
          : name
      }
      onClose={onClose}
    >
      <ul className="rf-issue-list">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onOpen(item.id)}>
              <Icon name={item.icon} size={20} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <Icon name="arrow-right" size={18} />
            </button>
          </li>
        ))}
      </ul>
      {paused ? (
        <button
          type="button"
          className="rf-btn rf-btn-secondary"
          onClick={onResume}
        >
          Resume route
        </button>
      ) : canPause ? (
        <button
          type="button"
          className="rf-btn rf-btn-secondary"
          onClick={onPause}
        >
          Pause route
        </button>
      ) : null}
      <div className="rf-menu-block">
        <h3>Your requests to operations</h3>
        {requests.length ? (
          <ul className="rf-request-list">
            {requests.slice(0, 5).map((request) => (
              <li key={request.id}>
                <span>
                  <strong>{REQUEST_LABELS[request.category]}</strong>
                  <small>{formatTime(request.created_at)}</small>
                </span>
                <RequestStatus request={request} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rf-muted">
            Fuel, charging and problem reports you send appear here.
          </p>
        )}
      </div>
      <button type="button" className="rf-btn rf-btn-quiet" onClick={onSignOut}>
        Sign out
      </button>
    </Sheet>
  );
}

/* -------------------------------------------------------------- energy */

function energyStatusLabel(
  status: ReturnType<typeof energyForRoute>["status"],
) {
  return status === "enough"
    ? "Enough for today"
    : status === "tight"
      ? "Plan a stop"
      : status === "short"
        ? "Not enough"
        : "Range unknown";
}

function energyAdvice(
  energy: ReturnType<typeof energyForRoute>,
  word: "fuel" | "charging",
) {
  if (energy.status === "unknown")
    return energy.levelPercent == null
      ? "Set your current level to check today’s range."
      : "Range shows once the route distance is known.";
  const usable = formatDistance(energy.usableKm);
  const needed = formatDistance(energy.neededKm);
  if (energy.status === "enough")
    return `About ${usable} usable after your reserve, for ${needed} left today.`;
  if (energy.status === "tight")
    return `About ${usable} usable for ${needed} left. Plan a ${word} stop.`;
  return `Only about ${usable} usable for ${needed} left. Get ${word === "fuel" ? "fuel" : "a charge"} before your next stop.`;
}

export function EnergyPanel({
  vehicle,
  energy,
  openRequest,
  busy,
  error,
  done,
  onSaveLevel,
  onRequest,
  onClose,
}: {
  vehicle: VehicleOption | null;
  energy: ReturnType<typeof energyForRoute>;
  openRequest: RiderRequest | null;
  busy: boolean;
  error: ReactNode;
  done: string | null;
  onSaveLevel: (level: number) => Promise<boolean>;
  onRequest: (note: string) => void;
  onClose: () => void;
}) {
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const word = energy.source === "battery" ? "charging" : "fuel";
  return (
    <Sheet
      title={energy.source === "battery" ? "Battery" : "Fuel"}
      subtitle={
        vehicle
          ? `${vehicle.registration_number} · ${vehicle.vehicle_type.replace("_", "-")}`
          : "No vehicle is linked to your route"
      }
      onClose={onClose}
    >
      <div className={`rf-gauge is-${energy.status}`}>
        <div className="rf-gauge-row">
          <strong>
            {energy.levelPercent == null ? "—" : `${energy.levelPercent}%`}
          </strong>
          <span>{energyStatusLabel(energy.status)}</span>
        </div>
        <span className="rf-gauge-bar" aria-hidden="true">
          <span style={{ width: `${energy.levelPercent ?? 0}%` }} />
        </span>
        <p>{energyAdvice(energy, word)}</p>
      </div>
      {vehicle && (
        <div className="rf-inline-field">
          <label className="rf-field">
            <span>Update current level (%)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={level}
              placeholder={String(energy.levelPercent ?? "")}
              onChange={(event) => setLevel(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="rf-btn rf-btn-secondary"
            disabled={level === "" || busy}
            onClick={() =>
              void onSaveLevel(Number(level)).then((saved) => {
                if (saved) setLevel("");
              })
            }
          >
            Save
          </button>
        </div>
      )}
      {done && (
        <Notice tone="success" icon="check">
          {done}
        </Notice>
      )}
      {openRequest ? (
        <div className="rf-request-card">
          <span>
            <strong>{REQUEST_LABELS[openRequest.category]}</strong>
            <small>Requested {formatTime(openRequest.created_at)}</small>
          </span>
          <RequestStatus request={openRequest} />
        </div>
      ) : (
        !done && (
          <>
            <label className="rf-field">
              <span>Note for operations (optional)</span>
              <textarea
                value={note}
                maxLength={500}
                placeholder={
                  energy.source === "battery"
                    ? "Battery at 20%, 3 stops left"
                    : "Fuel light on, 3 stops left"
                }
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            {error}
            <button
              type="button"
              className="rf-btn rf-btn-primary"
              disabled={busy}
              onClick={() => onRequest(note)}
            >
              <Icon
                name={energy.source === "battery" ? "battery" : "fuel"}
                size={18}
              />
              {busy
                ? "Sending…"
                : energy.source === "battery"
                  ? "Request a charging stop"
                  : "Request a fuel stop"}
            </button>
          </>
        )
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------- cautions */

function CautionItem({ caution, now }: { caution: RoadCaution; now: number }) {
  const copy = cautionCopy(caution.report);
  const minutes = Math.max(
    0,
    Math.round((now - Date.parse(caution.report.reported_at)) / 60_000),
  );
  return (
    <article className={`rf-caution-item is-${caution.report.severity}`}>
      <span className="rf-caution-icon" aria-hidden="true">
        <Icon name="warning" size={18} />
      </span>
      <div>
        <strong>
          {copy.title} · {copy.impact}
        </strong>
        <p>{caution.report.description}</p>
        <p className="rf-caution-advice">{copy.advice}</p>
        <small>
          {caution.aheadKm < 0.05
            ? "Where you are"
            : `${formatDistance(caution.aheadKm)} ahead`}{" "}
          · reported {minutes < 1 ? "just now" : `${minutes} min ago`} ·{" "}
          {copy.confirmed ? "confirmed by operations" : "not yet confirmed"}
        </small>
      </div>
    </article>
  );
}

const ROAD_CATEGORIES: { id: RoadReport["category"]; label: string }[] = [
  { id: "closure", label: "Road closed" },
  { id: "flooding", label: "Flooding" },
  { id: "roadwork", label: "Roadwork" },
  { id: "congestion", label: "Heavy traffic" },
  { id: "hazard", label: "Hazard" },
];

const ROAD_SEVERITIES: { id: RoadReport["severity"]; label: string }[] = [
  { id: "low", label: "Minor" },
  { id: "medium", label: "Slow" },
  { id: "high", label: "Major" },
  { id: "blocked", label: "Blocked for trucks" },
];

export type RoadReportDraft = {
  category: RoadReport["category"];
  severity: RoadReport["severity"];
  description: string;
};

export function CautionsPanel({
  legCautions,
  laterCautions,
  now,
  canLocate,
  busy,
  error,
  done,
  onReport,
  onClose,
}: {
  legCautions: RoadCaution[];
  laterCautions: RoadCaution[];
  now: number;
  canLocate: boolean;
  busy: boolean;
  error: ReactNode;
  done: string | null;
  onReport: (draft: RoadReportDraft) => void;
  onClose: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [draft, setDraft] = useState<RoadReportDraft>({
    category: "closure",
    severity: "blocked",
    description: "",
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onReport(draft);
  };
  if (done)
    return (
      <Sheet title="Road report sent" onClose={onClose}>
        <Notice tone="success" icon="check">
          {done}
        </Notice>
        <button type="button" className="rf-btn rf-btn-primary" onClick={onClose}>
          Back to the route
        </button>
      </Sheet>
    );
  if (reporting)
    return (
      <Sheet
        title="Report a road condition"
        subtitle="Send only when you’ve stopped safely."
        onClose={onClose}
      >
        <form className="rf-form" onSubmit={submit}>
          <fieldset className="rf-option-group">
            <legend>What’s on the road?</legend>
            {ROAD_CATEGORIES.map((item) => (
              <label
                key={item.id}
                className={`rf-option ${draft.category === item.id ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="road-category"
                  checked={draft.category === item.id}
                  onChange={() => setDraft({ ...draft, category: item.id })}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
          <fieldset className="rf-option-group">
            <legend>How bad is it?</legend>
            {ROAD_SEVERITIES.map((item) => (
              <label
                key={item.id}
                className={`rf-option ${draft.severity === item.id ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="road-severity"
                  checked={draft.severity === item.id}
                  onChange={() => setDraft({ ...draft, severity: item.id })}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
          <label className="rf-field">
            <span>What did you see?</span>
            <textarea
              value={draft.description}
              minLength={3}
              maxLength={240}
              required
              placeholder="Height barrier at the bridge, trucks can’t pass"
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <p className="rf-muted">
            Operations checks reports before they change routes or ETAs. Your
            route won’t change from this report alone.
          </p>
          {!canLocate && (
            <Notice tone="warning" icon="location">
              Your location is needed to place the report. Turn on location,
              or call your dispatcher.
            </Notice>
          )}
          {error}
          <button
            type="submit"
            className="rf-btn rf-btn-primary"
            disabled={draft.description.trim().length < 3 || busy || !canLocate}
          >
            <Icon name="location" size={18} />
            {busy ? "Sending…" : "Send with my location"}
          </button>
          <button
            type="button"
            className="rf-btn rf-btn-quiet"
            onClick={() => setReporting(false)}
          >
            Back to road conditions
          </button>
        </form>
      </Sheet>
    );
  return (
    <Sheet
      title="Road conditions"
      subtitle="Reports from drivers near your route. Confirmed ones already count in ETAs."
      onClose={onClose}
    >
      {legCautions.length > 0 && (
        <section className="rf-caution-group">
          <h3>Before your next stop</h3>
          {legCautions.map((item) => (
            <CautionItem key={item.report.id} caution={item} now={now} />
          ))}
        </section>
      )}
      {laterCautions.length > 0 && (
        <section className="rf-caution-group">
          <h3>Later on today’s route</h3>
          {laterCautions.map((item) => (
            <CautionItem key={item.report.id} caution={item} now={now} />
          ))}
        </section>
      )}
      {!legCautions.length && !laterCautions.length && (
        <p className="rf-muted">No road reports near your route right now.</p>
      )}
      <button
        type="button"
        className="rf-btn rf-btn-secondary"
        onClick={() => setReporting(true)}
      >
        <Icon name="warning" size={18} /> Report a road condition
      </button>
    </Sheet>
  );
}

/* ------------------------------------------------------------- problems */

type ProblemChoice = Exclude<
  RiderRequestCategory,
  "refuel" | "recharge" | "parcel_damaged"
>;

const PROBLEMS: { id: ProblemChoice; label: string; detail: string }[] = [
  {
    id: "vehicle_problem",
    label: "Vehicle problem",
    detail: "Breakdown, flat tyre, won’t start",
  },
  { id: "accident", label: "Accident", detail: "You or someone needs help" },
  {
    id: "unsafe_area",
    label: "I don’t feel safe here",
    detail: "Operations can reroute or send help",
  },
  { id: "other", label: "Something else", detail: "Tell operations in a note" },
];

export function ProblemPanel({
  stopLabel,
  busy,
  error,
  done,
  canPause,
  onSend,
  onPause,
  onClose,
}: {
  stopLabel: string | null;
  busy: boolean;
  error: ReactNode;
  done: string | null;
  canPause: boolean;
  onSend: (category: ProblemChoice, note: string) => void;
  onPause: () => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<ProblemChoice | null>(null);
  const [note, setNote] = useState("");
  const picked = PROBLEMS.find((item) => item.id === choice);
  return (
    <Sheet
      title={picked?.label ?? "Vehicle or safety problem"}
      subtitle={
        choice
          ? undefined
          : "For a problem with a parcel or recipient, use the stop’s “Can’t deliver” instead."
      }
      onClose={onClose}
    >
      {done ? (
        <>
          <Notice tone="success" icon="check">
            {done}
          </Notice>
          {canPause && choice === "vehicle_problem" && (
            <button
              type="button"
              className="rf-btn rf-btn-secondary"
              onClick={onPause}
            >
              Pause route while it’s fixed
            </button>
          )}
          <button
            type="button"
            className="rf-btn rf-btn-primary"
            onClick={onClose}
          >
            Back to the route
          </button>
        </>
      ) : !choice ? (
        <ul className="rf-issue-list">
          {PROBLEMS.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setChoice(item.id)}>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <Icon name="arrow-right" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form
          className="rf-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSend(choice, note);
          }}
        >
          {choice === "accident" && (
            <Notice tone="error" icon="warning">
              <strong>If anyone is hurt, get help first.</strong> Call
              emergency services, then send this so operations can cover your
              deliveries.
            </Notice>
          )}
          <p className="rf-muted">
            Operations gets your location
            {stopLabel ? `, ${stopLabel}` : ""} and vehicle with this.
          </p>
          <label className="rf-field">
            <span>
              {choice === "other"
                ? "What happened?"
                : "Anything they should know? (optional)"}
            </span>
            <textarea
              value={note}
              maxLength={500}
              required={choice === "other"}
              placeholder={
                choice === "vehicle_problem"
                  ? "Rear tyre flat near Hledan junction"
                  : "Short note for the dispatcher"
              }
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {error}
          <button
            type="submit"
            className="rf-btn rf-btn-primary"
            disabled={busy || (choice === "other" && note.trim().length < 3)}
          >
            {busy ? "Sending…" : "Send to operations"}
          </button>
          <button
            type="button"
            className="rf-btn rf-btn-quiet"
            onClick={() => setChoice(null)}
          >
            Choose a different problem
          </button>
        </form>
      )}
    </Sheet>
  );
}

export type { ProblemChoice };
