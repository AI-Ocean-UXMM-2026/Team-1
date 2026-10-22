"use client";

import Button from "@mui/material/Button";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

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

/** Downscales a camera photo so it stays small enough to keep with the draft. */
async function compressPhoto(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.7);
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
  const [step, setStep] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
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
  const photoDone = !!draft.photo;
  const infoDone = parcelDone && receiverDone && photoDone;
  const stepsDone = [parcelDone, receiverDone, photoDone].filter(
    Boolean,
  ).length;
  const nextStepLabel = !parcelDone
    ? stop.open.length > 1
      ? "Check all parcels to continue"
      : "Check the parcel to continue"
    : !receiverDone
      ? "Say who received it to continue"
      : "Take a photo to continue";
  const takePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    try {
      onChange({ photo: await compressPhoto(file) });
    } catch {
      setPhotoError("Couldn’t read that photo. Try again.");
    }
  };
  const hasCash = stop.codDue > 0;

  const steps = ["parcels", "receiver", "photo", ...(hasCash ? ["cash"] : [])];
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const singleParcel = stop.open.length === 1;
  const stepDone = [parcelDone, receiverDone, photoDone][step] ?? true;
  const advance = () => {
    if (steps[step + 1] === "cash") onChange({ codMode: "full" });
    setStep((value) => Math.min(value + 1, steps.length - 1));
  };
  const continueLabel =
    current === "parcels"
      ? singleParcel
        ? "Confirm this parcel"
        : "Continue"
      : "Continue";
  const hintFor: Record<string, string> = {
    parcels: "Check all parcels to continue",
    receiver: "Say who received it to continue",
    photo: "Take a photo to continue",
  };
  const stepTitle: Record<string, string> = {
    parcels: "Delivery information",
    receiver: "Delivery information",
    photo: "Proof of delivery",
    cash: "Cash to collect",
  };

  const swipe = (
    <>
      {!online && (
        <p className="rf-dock-note">
          Your entries are kept on this phone. Completion is sent when you’re
          back online.
        </p>
      )}
      <SwipeConfirm
        label="Confirm delivery"
        disabled={locked}
        onConfirm={onComplete}
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
    </>
  );

  const noteField = (
    <details className="dv-note">
      <summary>
        <Icon name="message" size={16} /> Add a note
      </summary>
      <textarea
        aria-label="Delivery note"
        value={draft.note}
        maxLength={500}
        placeholder="For example: authorized building security"
        onChange={(event) => onChange({ note: event.target.value })}
      />
    </details>
  );

  return (
    <div className="dv-handover">
      <output className="dv-progress">
        <span className="dv-progress-bar" aria-hidden="true">
          {steps.map((name, index) => (
            <i
              key={name}
              className={
                index < step || (index === step && stepDone && index < 3)
                  ? "is-done"
                  : index === step
                    ? "is-current"
                    : ""
              }
              style={{ gridColumn: "auto" }}
            />
          ))}
        </span>
        <span className="dv-progress-row">
          <span>
            <strong>
              Step {step + 1} of {steps.length}
            </strong>
            {" · "}
            {stepTitle[current]}
          </span>
          {step > 0 && (
            <button
              type="button"
              className="dv-progress-back"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
        </span>
      </output>

      <div className="dv-collect-page">
        <div className="dv-info-body">
          {current === "parcels" && (
            <fieldset className="dv-step">
              <legend>
                <StepBadge n={1} done={parcelDone} />
                {singleParcel
                  ? "Check the parcel"
                  : `Verify ${stop.open.length} parcels`}
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
                  recipient {stop.notLoaded.length === 1 ? "isn’t" : "aren’t"}{" "}
                  on your truck. Deliver what you have; operations follows up on
                  the rest.
                </p>
              )}
            </fieldset>
          )}

          {current === "receiver" && (
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
                    checked={
                      !someoneElse && draft.receivedBy === stop.recipient
                    }
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
          )}

          {current === "photo" && (
            <fieldset className="dv-step">
              <legend>
                <StepBadge n={3} done={photoDone} />
                Photo of the parcel
              </legend>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="rf-sr-only"
                aria-label="Take a photo of the parcel"
                onChange={(event) => {
                  void takePhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {draft.photo ? (
                <div className="dv-photo is-taken">
                  {/* biome-ignore lint/performance/noImgElement: local data URL */}
                  <img src={draft.photo} alt="Parcel at the door" />
                  <button
                    type="button"
                    className="dv-photo-retake"
                    onClick={() => photoInput.current?.click()}
                  >
                    <Icon name="refresh" size={16} /> Retake
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="dv-photo dv-photo-empty"
                  onClick={() => photoInput.current?.click()}
                >
                  <Icon name="camera" size={28} />
                  <strong>Take a photo</strong>
                  <small>
                    Show the parcel where you left it or handed it over
                  </small>
                </button>
              )}
              {photoError && (
                <p className="rf-muted" role="alert">
                  {photoError}
                </p>
              )}
              {!hasCash && noteField}
            </fieldset>
          )}

          {current === "cash" && (
            <div className="dv-collect-body">
              <p className="dv-collect-label">Total to collect</p>
              <p className="dv-collect-figure">
                <span>MMK</span> {stop.codDue.toLocaleString()}
              </p>
              <p className="dv-collect-from">From {stop.recipient}</p>
              {noteField}
            </div>
          )}
          {error}
        </div>

        <div className="dv-collect-foot">
          {isLast && (current === "cash" || !hasCash) ? (
            swipe
          ) : (
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={!stepDone && !(current === "parcels" && singleParcel)}
              onClick={() => {
                if (current === "parcels" && singleParcel)
                  onChange({ verified: stop.open.map((order) => order.id) });
                advance();
              }}
              endIcon={<Icon name="arrow-right" size={18} />}
              sx={{ minHeight: 52, borderRadius: 999 }}
            >
              {current === "parcels" && singleParcel
                ? continueLabel
                : stepDone
                  ? continueLabel
                  : hintFor[current]}
            </Button>
          )}
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            onClick={onCannotDeliver}
            sx={{ minHeight: 48, borderRadius: 999 }}
          >
            Can’t deliver this stop
          </Button>
        </div>
      </div>
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

  const submit = () => {
    if (ready && option && action)
      onSubmit({ reason: option.id, parcelIds, nextAction: action, note });
  };
  const hint = !option
    ? "Choose a reason"
    : reason === "other" && note.trim().length < 3
      ? "Describe what happened"
      : needsServer && !online
        ? "Waiting for connection"
        : "Swipe to record";

  return (
    <Sheet
      title="Can’t deliver this stop"
      subtitle={`Stop ${stop.number} · ${stop.recipient} · ${stop.address}`}
      onClose={onClose}
    >
      <fieldset className="dv-step">
        <legend>Why can’t you deliver?</legend>
        <div className="dv-chips">
          {EXCEPTION_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={reason === item.id}
              className={`dv-chip${reason === item.id ? " is-on" : ""}`}
              onClick={() => {
                setReason(item.id);
                setNextAction(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      {option && (
        <>
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
            </fieldset>
          )}

          {option.actions.length > 1 ? (
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
          ) : (
            action && (
              <p className="rf-muted">
                <strong>{NEXT_ACTION_LABELS[action]}.</strong>{" "}
                {NEXT_ACTION_DETAIL[action]}
              </p>
            )
          )}

          {reason === "other" ? (
            <label className="rf-field">
              <span>Describe what happened</span>
              <textarea
                value={note}
                maxLength={500}
                placeholder="Called twice, no answer. Gate locked."
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          ) : (
            <details className="dv-note">
              <summary>
                <Icon name="message" size={16} /> Add a note
              </summary>
              <textarea
                aria-label="Note for operations"
                value={note}
                maxLength={500}
                placeholder="Called twice, no answer. Gate locked."
                onChange={(event) => setNote(event.target.value)}
              />
            </details>
          )}

          {needsServer && !online && (
            <Notice tone="warning" icon="warning">
              You’re offline. This needs a connection to record.
            </Notice>
          )}
          {error}
          <SwipeConfirm
            label={
              action === "retry_later"
                ? "Move to end of route"
                : parcelIds.length > 1
                  ? `Record ${parcelIds.length} parcels not delivered`
                  : "Record not delivered"
            }
            hint={busy ? "Saving…" : hint}
            disabled={!ready || busy}
            onConfirm={submit}
          />
        </>
      )}
    </Sheet>
  );
}
