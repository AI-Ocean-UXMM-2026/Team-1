"use client";

import Button from "@mui/material/Button";
import type { ReactNode } from "react";
import { useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { Notice, Sheet } from "@/components/delivery/rider-tools";
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

function ParcelLine({ order }: { order: DeliveryOrder }) {
  return (
    <span className="dv-parcel-copy">
      <strong>{order.tracking_code}</strong>
      <small>
        {order.parcel_description ?? "No description"}
        {order.parcel_weight_kg ? ` · ${order.parcel_weight_kg} kg` : ""}
        {order.cod_amount > 0 && order.cod_status === "pending"
          ? ` · COD ${currency.format(order.cod_amount)}`
          : ""}
      </small>
    </span>
  );
}

/**
 * The handover step at the current stop: check each parcel, record who took
 * it, settle COD. "Complete delivery" stays disabled until every requirement
 * for this stop is met, and says which one is missing.
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
  const [stage, setStage] = useState(0);
  const requirements = handoverRequirements(stop, draft);
  const missing = requirements.find((item) => !item.met);
  const amount = Number(draft.codAmount);
  const verifiedIds = new Set(draft.verified);
  const parcelReady = stop.open.every((order) => verifiedIds.has(order.id));
  const recipientReady = draft.receivedBy.trim().length > 0;
  const paymentReady = stop.codDue <= 0 || requirements.at(-1)?.met === true;
  const stageReady = [parcelReady, recipientReady, paymentReady];
  const stageLabels = ["Parcel", "Recipient", "Payment"];
  const toggle = (id: string) =>
    onChange({
      verified: draft.verified.includes(id)
        ? draft.verified.filter((item) => item !== id)
        : [...draft.verified, id],
    });
  return (
    <div className="dv-handover">
      <ol className="dv-handover-steps" aria-label="Handover progress">
        {stageLabels.map((label, index) => (
          <li
            key={label}
            className={`${stage === index ? "is-current" : ""} ${stageReady[index] ? "is-met" : ""}`}
          >
            <button
              type="button"
              aria-current={stage === index ? "step" : undefined}
              onClick={() => setStage(index)}
            >
              <span>
                {stageReady[index] ? (
                  <Icon name="check" size={14} strokeWidth={2.6} />
                ) : (
                  index + 1
                )}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <section className="dv-handover-stage" aria-live="polite">
        {stage === 0 ? (
          <fieldset className="dv-group">
            <legend>
              {stop.open.length > 1
                ? `Verify ${stop.open.length} parcels`
                : "Verify the parcel"}
            </legend>
            <p className="rf-muted">
              Match each parcel ID with its label before handing it over.
            </p>
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
                <ParcelLine order={order} />
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
        ) : stage === 1 ? (
          <div className="dv-recipient-stage">
            <div>
              <h3>Verify the receiver</h3>
              <p className="rf-muted">
                Intended recipient: <strong>{stop.recipient}</strong>
              </p>
            </div>
            <label className="rf-field">
              <span>Actual receiver</span>
              <input
                value={draft.receivedBy}
                autoComplete="off"
                placeholder="Name of the person taking the parcels"
                onChange={(event) =>
                  onChange({ receivedBy: event.target.value })
                }
              />
            </label>
            {draft.receivedBy !== stop.recipient && (
              <button
                type="button"
                className="rf-btn rf-btn-secondary"
                onClick={() => onChange({ receivedBy: stop.recipient })}
              >
                Recipient is receiving
              </button>
            )}
            <label className="rf-field">
              <span>Handover note (optional)</span>
              <textarea
                value={draft.note}
                maxLength={500}
                placeholder="For example: authorized building security"
                onChange={(event) => onChange({ note: event.target.value })}
              />
            </label>
          </div>
        ) : (
          <div className="dv-payment-stage">
            {stop.codDue > 0 ? (
              <fieldset className="rf-cod-panel">
                <legend>
                  <Icon name="coin" size={17} /> Collect payment
                </legend>
                <div className="rf-cod-due">
                  <span>COD due</span>
                  <strong>{currency.format(stop.codDue)}</strong>
                </div>
                <div className="rf-reasons">
                  <label
                    className={`rf-reason is-positive ${draft.codMode === "full" ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="cod-mode"
                      checked={draft.codMode === "full"}
                      onChange={() => onChange({ codMode: "full" })}
                    />
                    I received the full amount in cash
                  </label>
                  <label
                    className={`rf-reason ${draft.codMode === "different" ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="cod-mode"
                      checked={draft.codMode === "different"}
                      onChange={() => onChange({ codMode: "different" })}
                    />
                    I received a different amount
                  </label>
                </div>
                {draft.codMode === "different" && (
                  <>
                    <label className="rf-field">
                      <span>Amount received (MMK)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={draft.codAmount}
                        onChange={(event) =>
                          onChange({ codAmount: event.target.value })
                        }
                      />
                    </label>
                    <label className="rf-field">
                      <span>Why is it different?</span>
                      <textarea
                        value={draft.codReason}
                        maxLength={240}
                        placeholder="Explain what happened for operations"
                        onChange={(event) =>
                          onChange({ codReason: event.target.value })
                        }
                      />
                    </label>
                    {draft.codAmount !== "" && Number.isFinite(amount) && (
                      <p className="rf-field-warn">
                        <Icon name="warning" size={15} />{" "}
                        {currency.format(amount)} of{" "}
                        {currency.format(stop.codDue)}. COD stays open for
                        operations to review.
                      </p>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="rf-link"
                  onClick={onCannotDeliver}
                >
                  Recipient can’t pay? Record the exception
                </button>
              </fieldset>
            ) : (
              <div className="dv-no-payment">
                <Icon name="check" size={22} strokeWidth={2.4} />
                <div>
                  <strong>No payment to collect</strong>
                  <p>This stop has no cash-on-delivery amount.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {stage < 2 && (
        <div className="dv-sheet-actions">
          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            disabled={!stageReady[stage]}
            onClick={() => setStage(stage + 1)}
            endIcon={<Icon name="arrow-right" size={18} />}
            sx={{ minHeight: 52, borderRadius: 999 }}
          >
            {stage === 0 ? "Continue to recipient" : "Continue to payment"}
          </Button>
          <Button
            fullWidth
            variant="text"
            color="inherit"
            onClick={() => setStage(Math.max(0, stage - 1))}
            disabled={stage === 0}
            sx={{
              minHeight: 44,
              borderRadius: 999,
              mt: 1,
              color: "text.secondary",
            }}
          >
            Back
          </Button>
        </div>
      )}

      {error}
      {stage === 2 && (
        <div className="dv-sheet-actions">
          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            disabled={!!missing || busy || !online}
            onClick={onComplete}
            sx={{ minHeight: 52, borderRadius: 999 }}
          >
            {busy
              ? "Saving…"
              : !online
                ? "Waiting for connection"
                : missing
                  ? missing.label
                  : stop.open.length > 1
                    ? `Complete delivery · ${stop.open.length} parcels`
                    : "Complete delivery"}
          </Button>
          {!online && (
            <p className="rf-dock-note">
              Your entries are kept on this phone. Completion is sent when
              you’re back online.
            </p>
          )}
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={() => setStage(1)}
            disabled={busy}
            sx={{ minHeight: 48, borderRadius: 999, mt: 1 }}
          >
            Review recipient
          </Button>
        </div>
      )}
    </div>
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
