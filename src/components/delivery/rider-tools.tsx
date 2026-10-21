"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/delivery/icons";
import type { GpsState } from "@/components/delivery/rider-active";
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
  const severity = tone === "neutral" ? "info" : tone;
  return (
    <Alert
      severity={severity}
      role={tone === "error" ? "alert" : "status"}
      icon={<Icon name={icon} size={20} strokeWidth={2.1} />}
      action={action}
      sx={{
        borderRadius: "12px",
        alignItems: "center",
        my: 1,
        "& .MuiAlert-message": {
          width: "100%",
          fontSize: "14px",
          lineHeight: 1.45,
        },
        ...(tone === "neutral" && {
          bgcolor: "grey.100",
          color: "text.primary",
          border: 1,
          borderColor: "divider",
          "& .MuiAlert-icon": {
            color: "text.secondary",
          },
        }),
      }}
    >
      {children}
    </Alert>
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
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstControl = panel.current?.querySelector<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    );
    (firstControl ?? panel.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
      ) ?? [],
    ).filter((control) => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      panel.current?.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === panel.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop only dismisses on pointer input; the dialog handles Escape and focus.
    <div
      className="rf-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        ref={panel}
        className="rf-sheet rf-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <span className="rf-handle" aria-hidden="true" />
        <div className="rf-sheet-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="rf-muted">{subtitle}</p>}
          </div>
          <IconButton
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            sx={{ width: 44, height: 44, color: "text.primary" }}
          >
            <Icon name="close" size={20} />
          </IconButton>
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
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          onClick={onResume}
          sx={{ minHeight: 48, borderRadius: 999, mt: 1 }}
        >
          Resume route
        </Button>
      ) : canPause ? (
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          onClick={onPause}
          sx={{ minHeight: 48, borderRadius: 999, mt: 1 }}
        >
          Pause route
        </Button>
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
      <Button
        fullWidth
        variant="text"
        color="inherit"
        onClick={onSignOut}
        sx={{
          minHeight: 44,
          borderRadius: 999,
          mt: 1.5,
          color: "text.secondary",
        }}
      >
        Sign out
      </Button>
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
          <Button
            variant="outlined"
            color="secondary"
            disabled={level === "" || busy}
            onClick={() =>
              void onSaveLevel(Number(level)).then((saved) => {
                if (saved) setLevel("");
              })
            }
            sx={{ minHeight: 48, borderRadius: 999, px: 3 }}
          >
            Save
          </Button>
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
            <Button
              fullWidth
              variant="contained"
              color="primary"
              disabled={busy}
              onClick={() => onRequest(note)}
              startIcon={
                <Icon
                  name={energy.source === "battery" ? "battery" : "fuel"}
                  size={18}
                />
              }
              sx={{ minHeight: 48, borderRadius: 999, mt: 1.5 }}
            >
              {busy
                ? "Sending…"
                : energy.source === "battery"
                  ? "Request a charging stop"
                  : "Request a fuel stop"}
            </Button>
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
  onLocationHelp,
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
  onLocationHelp?: () => void;
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
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={onClose}
          sx={{ minHeight: 48, borderRadius: 999, mt: 2 }}
        >
          Back to the route
        </Button>
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
            <Notice
              tone="warning"
              icon="location"
              action={
                onLocationHelp ? (
                  <button
                    type="button"
                    className="rf-link"
                    onClick={onLocationHelp}
                  >
                    Fix location
                  </button>
                ) : null
              }
            >
              Your location is needed to place the report. Turn on location, or
              call your dispatcher.
            </Notice>
          )}
          {error}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="primary"
            disabled={draft.description.trim().length < 3 || busy || !canLocate}
            startIcon={<Icon name="location" size={18} />}
            sx={{ minHeight: 48, borderRadius: 999, mt: 1.5 }}
          >
            {busy ? "Sending…" : "Send with my location"}
          </Button>
          <Button
            fullWidth
            variant="text"
            color="inherit"
            onClick={() => setReporting(false)}
            sx={{ minHeight: 44, borderRadius: 999, mt: 1 }}
          >
            Back to road conditions
          </Button>
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
      <Button
        fullWidth
        variant="outlined"
        color="secondary"
        startIcon={<Icon name="warning" size={18} />}
        onClick={() => setReporting(true)}
        sx={{ minHeight: 48, borderRadius: 999, mt: 2 }}
      >
        Report a road condition
      </Button>
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
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={onPause}
              sx={{ minHeight: 48, borderRadius: 999, mt: 1.5 }}
            >
              Pause route while it’s fixed
            </Button>
          )}
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={onClose}
            sx={{ minHeight: 48, borderRadius: 999, mt: 1.5 }}
          >
            Back to the route
          </Button>
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
              <strong>If anyone is hurt, get help first.</strong> Call emergency
              services, then send this so operations can cover your deliveries.
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
          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="primary"
            disabled={busy || (choice === "other" && note.trim().length < 3)}
            sx={{ minHeight: 48, borderRadius: 999, mt: 1.5 }}
          >
            {busy ? "Sending…" : "Send to operations"}
          </Button>
          <Button
            fullWidth
            variant="text"
            color="inherit"
            onClick={() => setChoice(null)}
            sx={{ minHeight: 44, borderRadius: 999, mt: 1 }}
          >
            Choose a different problem
          </Button>
        </form>
      )}
    </Sheet>
  );
}

export function LocationHelpSheet({
  gpsState,
  onRetry,
  onClose,
}: {
  gpsState: GpsState;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      title={gpsState === "stale" ? "GPS signal is old" : "Location is off"}
      onClose={onClose}
    >
      <p>
        {gpsState === "stale"
          ? "Your phone hasn’t sent a fresh position for over a minute. The map shows where you were last seen."
          : "Oern can’t read your location, so the map shows your stops without your position, and customers won’t see you live."}
      </p>
      <ol className="dv-steps">
        <li>
          <strong>Safari (iOS):</strong> Tap <em>aA</em> or the settings icon in
          the address bar → Website Settings → Location → Allow.
        </li>
        <li>
          <strong>Chrome / Android:</strong> Tap the lock or tune icon in the
          address bar → Permissions → Location → Allow.
        </li>
        <li>Come back and tap Try again.</li>
      </ol>
      <p className="rf-muted">
        Deliveries, COD and proof still work without location.
      </p>
      <Button
        fullWidth
        variant="contained"
        color="primary"
        onClick={() => {
          onRetry();
          onClose();
        }}
        sx={{ minHeight: 48, borderRadius: 999, mt: 2 }}
      >
        Try again
      </Button>
      <Button
        fullWidth
        variant="text"
        color="inherit"
        onClick={onClose}
        sx={{ minHeight: 44, borderRadius: 999, mt: 1 }}
      >
        Continue without live location
      </Button>
    </Sheet>
  );
}

export type { ProblemChoice };
