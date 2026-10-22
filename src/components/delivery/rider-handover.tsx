"use client";

import Button from "@mui/material/Button";
import type { ReactNode } from "react";
import { useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { Notice, Sheet } from "@/components/delivery/rider-tools";
import { SwipeConfirm } from "@/components/delivery/swipe-confirm";
import {
  type DeliveryStop,
  EXCEPTION_OPTIONS,
  type ExceptionReason,
  type HandoverDraft,
  handoverRequirements,
  NEXT_ACTION_LABELS,
  type NextAction,
} from "@/lib/delivery/driver-route";
import { currency } from "@/lib/delivery/format";
import type { DeliveryOrder } from "@/lib/delivery/types";

function ParcelLine({
  order,
  showCod = true,
}: {
  order: DeliveryOrder;
  showCod?: boolean;
}) {
  return (
    <span className="dv-parcel-copy">
      <strong>{order.tracking_code}</strong>
      <small>
        {order.parcel_description ?? "No description"}
        {order.parcel_weight_kg ? ` · ${order.parcel_weight_kg} kg` : ""}
        {showCod && order.cod_amount > 0 && order.cod_status === "pending"
          ? ` · COD ${currency.format(order.cod_amount)}`
          : ""}
      </small>
    </span>
  );
}

/**
 * The handover at the current stop, in two short pages. Page one is the
 * delivery information: check each parcel and say who took it. Page two is the
 * amount to collect and one swipe to confirm. The swipe stays locked until
 * every requirement for this stop is met, and its label says which is missing.
 */
export function HandoverPanel({
  stop,
  draft,
  onChange,
  busy,
  online,
  error,
  onComplete,
  onCannotDeliver,
}: {
  stop: DeliveryStop;
  draft: HandoverDraft;
  onChange: (patch: Partial<HandoverDraft>) => void;
  busy: boolean;
  online: boolean;
  error: ReactNode;
  onComplete: () => void;
  onCannotDeliver: () => void;
}) {
  const [page, setPage] = useState<1 | 2>(1);
  const requirements = handoverRequirements(stop, draft);
  const missing = requirements.find((item) => !item.met);
  const verifiedIds = new Set(draft.verified);
  const [someoneElse, setSomeoneElse] = useState(
    draft.receivedBy !== "" && draft.receivedBy !== stop.recipient,
  );
  const toggle = (id: string) =>
    onChange({
      verified: draft.verified.includes(id)
        ? draft.verified.filter((item) => item !== id)
        : [...draft.verified, id],
    });
  const locked = !!missing || busy || !online;
  const parcelDone = stop.open.every((order) => verifiedIds.has(order.id));
  const receiverDone = draft.receivedBy.trim().length > 0;
  const infoDone = parcelDone && receiverDone;
  const hasCash = stop.codDue > 0;
  const cashDone = requirements.find((item) => item.key === "cod")?.met ?? true;

  return (
    <div className="dv-handover">
      <p className="dv-progress" role="status">
        <strong>Page {page} of 2</strong>{" "}
        {page === 1 ? "Delivery information" : "Amount to collect"}
      </p>

      {page === 1 && (
        <>
          <fieldset className="dv-step">
            <legend>
              <StepBadge n={1} done={parcelDone} />
              {stop.open.length > 1
                ? `Verify ${stop.open.length} parcels`
                : "Verify the parcel"}
            </legend>
            {stop.open.map((order) => (
              <label
                key={order.id}
                className={`dv-check ${verifiedIds.has(order.id) ? "is-checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={verifiedIds.has(order.id)}
                  onChange={() => toggle(order.id)}
                />
                <span className="dv-check-box" aria-hidden="true">
                  <Icon name="check" size={16} strokeWidth={2.6} />
                </span>
                <ParcelLine order={order} showCod={false} />
              </label>
            ))}
            {stop.notLoaded.length > 0 && (
              <p className="rf-muted">
                {stop.notLoaded.length} more{" "}
                {stop.notLoaded.length === 1 ? "parcel" : "parcels"} for this
                recipient {stop.notLoaded.length === 1 ? "isn’t" : "aren’t"} on
                your truck. Deliver what you have; operations follows up on the
                rest.
              </p>
            )}
          </fieldset>

          <fieldset className="dv-step">
            <legend>
              <StepBadge n={2} done={receiverDone} />
              Who received it?
            </legend>
            <div className="dv-seg">
              <label
                className={
                  !someoneElse && draft.receivedBy === stop.recipient
                    ? "is-on"
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="receiver"
                  checked={!someoneElse && draft.receivedBy === stop.recipient}
                  onChange={() => {
                    setSomeoneElse(false);
                    onChange({ receivedBy: stop.recipient });
                  }}
                />
                <span>{stop.recipient}</span>
              </label>
              <label className={someoneElse ? "is-on" : undefined}>
                <input
                  type="radio"
                  name="receiver"
                  checked={someoneElse}
                  onChange={() => {
                    setSomeoneElse(true);
                    if (draft.receivedBy === stop.recipient)
                      onChange({ receivedBy: "" });
                  }}
                />
                <span>Someone else</span>
              </label>
            </div>
            {someoneElse && (
              <label className="rf-field">
                <span className="rf-sr-only">Actual receiver</span>
                <input
                  value={draft.receivedBy}
                  autoComplete="off"
                  aria-label="Actual receiver"
                  placeholder="Name of the person taking the parcels"
                  onChange={(event) =>
                    onChange({ receivedBy: event.target.value })
                  }
                />
              </label>
            )}
          </fieldset>

          <button type="button" className="dv-text-btn" onClick={onCannotDeliver}>
            Can’t deliver this stop
          </button>
          <div className="dv-sheet-actions">
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={!infoDone}
              onClick={() => setPage(2)}
              endIcon={<Icon name="arrow-right" size={18} />}
              sx={{ minHeight: 52, borderRadius: 999 }}
            >
              {!infoDone
                ? "Check the parcels and receiver"
                : hasCash
                  ? "Next · amount to collect"
                  : "Next · confirm delivery"}
            </Button>
          </div>
        </>
      )}

      {page === 2 && (
        <>
          {hasCash ? (
            <fieldset className="dv-step dv-cash-step">
              <legend>
                <StepBadge n={3} done={cashDone} />
                Amount to collect
              </legend>
              <div className="dv-cash-card">
                <div className="dv-cash-due">
                  <span>Total to collect</span>
                  <div className="dv-collect-amount-block">
                    <div className="dv-collect-amount-row">
                      <span className="dv-collect-currency">MMK</span>
                      <span className="dv-collect-amount">
                        {stop.codDue.toLocaleString()}
                      </span>
                    </div>
                    <p className="dv-collect-subtitle">From {stop.recipient}</p>
                  </div>
                </div>
                <div className="dv-seg">
                  <label
                    className={draft.codMode === "full" ? "is-on" : undefined}
                  >
                    <input
                      type="radio"
                      name="cod-mode"
                      checked={draft.codMode === "full"}
                      onChange={() => onChange({ codMode: "full" })}
                    />
                    <span>I received the full amount in cash</span>
                  </label>
                </div>
              </div>
            </fieldset>
          ) : (
            <section className="dv-step">
              <p className="rf-muted">No cash to collect at this stop.</p>
            </section>
          )}

          <details className="dv-note">
            <summary>
              <Icon name="message" size={16} /> Add a note
            </summary>
            <textarea
              aria-label="Handover note"
              value={draft.note}
              maxLength={500}
              placeholder="For example: authorized building security"
              onChange={(event) => onChange({ note: event.target.value })}
            />
          </details>

          {error}
          <div className="dv-sheet-actions">
            {!online && (
              <p className="rf-dock-note">
                Your entries are kept on this phone. Completion is sent when
                you’re back online.
              </p>
            )}
            <SwipeConfirm
              label="Confirm delivery"
              disabled={locked}
              onConfirm={onComplete}
              className={hasCash ? "is-green" : ""}
              hint={
                busy
                  ? "Saving…"
                  : !online
                    ? "Waiting for connection"
                    : missing
                      ? missing.label
                      : "Swipe to confirm delivery"
              }
            />
            <button
              type="button"
              className="dv-text-btn"
              onClick={() => setPage(1)}
            >
              Back to delivery information
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** A numbered step that turns into a check once its part of the handover is done. */
function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`dv-badge${done ? " is-done" : ""}`} aria-hidden="true">
      {done ? <Icon name="check" size={14} strokeWidth={2.8} /> : n}
    </span>
  );
}

export type ExceptionDraft = {
  reason: ExceptionReason;
  parcelIds: string[];
  nextAction: NextAction;
  note: string;
};

const NEXT_ACTION_DETAIL: Record<NextAction, string> = {
  retry_later:
    "Moves this stop to the end of your route. Nothing is recorded yet.",
  reschedule:
    "Recorded as not delivered today. Parcels stay on the truck for operations to rebook.",
  return_to_depot:
    "Recorded as not delivered. Bring the parcels back to the depot.",
};

/** Can’t-deliver flow: reason, which parcels, and what happens next. */
export function ExceptionPanel({
  stop,
  initialReason,
  busy,
  online,
  error,
  onSubmit,
  onClose,
}: {
  stop: DeliveryStop;
  initialReason: ExceptionReason | null;
  busy: boolean;
  online: boolean;
  error: ReactNode;
  onSubmit: (draft: ExceptionDraft) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ExceptionReason | null>(initialReason);
  const [parcelIds, setParcelIds] = useState<string[]>(
    stop.open.map((order) => order.id),
  );
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const [note, setNote] = useState("");
  const option = EXCEPTION_OPTIONS.find((item) => item.id === reason);
  const chooseParcels = option?.perParcel && stop.open.length > 1;
  const action =
    nextAction && option?.actions.includes(nextAction)
      ? nextAction
      : (option?.actions[0] ?? null);
  const needsServer = action !== "retry_later";
  const ready =
    option != null &&
    action != null &&
    parcelIds.length > 0 &&
    (reason !== "other" || note.trim().length >= 3) &&
    (!needsServer || online);

  return (
    <Sheet
      title={option ? option.label : "Can’t deliver"}
      subtitle={`Stop ${stop.number} · ${stop.recipient} · ${stop.address}`}
      onClose={onClose}
    >
      {!option ? (
        <ul className="rf-issue-list">
          {EXCEPTION_OPTIONS.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setReason(item.id)}>
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
            if (ready && action)
              onSubmit({
                reason: option.id,
                parcelIds,
                nextAction: action,
                note,
              });
          }}
        >
          {chooseParcels && (
            <fieldset className="dv-group">
              <legend>Which parcels?</legend>
              {stop.open.map((order) => (
                <label
                  key={order.id}
                  className={`dv-check ${parcelIds.includes(order.id) ? "is-checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={parcelIds.includes(order.id)}
                    onChange={() =>
                      setParcelIds((ids) =>
                        ids.includes(order.id)
                          ? ids.filter((id) => id !== order.id)
                          : [...ids, order.id],
                      )
                    }
                  />
                  <span className="dv-check-box" aria-hidden="true">
                    <Icon name="check" size={16} strokeWidth={2.6} />
                  </span>
                  <ParcelLine order={order} />
                </label>
              ))}
              {parcelIds.length < stop.open.length && parcelIds.length > 0 && (
                <p className="rf-muted">
                  The other parcels stay at this stop for you to hand over.
                </p>
              )}
            </fieldset>
          )}
          <fieldset className="rf-reasons">
            <legend>What happens next?</legend>
            {option.actions.map((item) => (
              <label
                key={item}
                className={`rf-reason ${action === item ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="next-action"
                  checked={action === item}
                  onChange={() => setNextAction(item)}
                />
                <span>
                  <strong>{NEXT_ACTION_LABELS[item]}</strong>
                  <small>{NEXT_ACTION_DETAIL[item]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="rf-field">
            <span>
              {reason === "other"
                ? "Describe what happened"
                : "Note for operations (optional)"}
            </span>
            <textarea
              value={note}
              maxLength={500}
              placeholder="Called twice, no answer. Gate locked."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {needsServer && !online && (
            <Notice tone="warning" icon="warning">
              You’re offline. This needs a connection to record.
            </Notice>
          )}
          {error}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={!ready || busy}
            sx={{ minHeight: 52, borderRadius: 999 }}
          >
            {busy
              ? "Saving…"
              : action === "retry_later"
                ? "Move to end of route"
                : parcelIds.length > 1
                  ? `Record ${parcelIds.length} parcels not delivered`
                  : "Record not delivered"}
          </Button>
          <Button
            fullWidth
            variant="text"
            color="inherit"
            onClick={() => setReason(null)}
            sx={{
              minHeight: 44,
              borderRadius: 999,
              mt: 1,
              color: "text.secondary",
            }}
          >
            Choose a different reason
          </Button>
        </form>
      )}
    </Sheet>
  );
}
