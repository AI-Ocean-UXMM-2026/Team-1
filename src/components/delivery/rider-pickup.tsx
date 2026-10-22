"use client";

import Button from "@mui/material/Button";
import type { ReactNode } from "react";
import { useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { SwipeConfirm } from "@/components/delivery/swipe-confirm";
import {
  type DeliveryStop,
  type HandoverDraft,
  PICKUP_REASONS,
  type PickupReasonOption,
  pickupRequirements,
} from "@/lib/delivery/driver-route";
import type { DeliveryOrder } from "@/lib/delivery/types";

function ParcelLine({ order }: { order: DeliveryOrder }) {
  return (
    <span className="dv-parcel-copy">
      <strong>{order.tracking_code}</strong>
      <small>
        {order.parcel_description ?? "No description"}
        {order.parcel_weight_kg
          ? ` · declared ${order.parcel_weight_kg} kg`
          : ""}
      </small>
    </span>
  );
}

/**
 * The pickup at the customer's door, one page like the delivery handover:
 * check each parcel, optionally weigh it, then swipe to take it. "Couldn't
 * collect" records why, and the parcel then drops off the route.
 */
export function PickupPanel({
  stop,
  draft,
  onChange,
  busy,
  online,
  error,
  warning,
  onCollect,
  onCannotCollect,
}: {
  stop: DeliveryStop;
  draft: HandoverDraft;
  onChange: (patch: Partial<HandoverDraft>) => void;
  busy: boolean;
  online: boolean;
  error: ReactNode;
  /** Shown after a pickup was saved with a warning, e.g. an overloaded truck. */
  warning?: ReactNode;
  onCollect: () => void;
  onCannotCollect: (reason: PickupReasonOption["id"], note: string) => void;
}) {
  const [problem, setProblem] = useState(false);
  const [page, setPage] = useState<1 | 2>(1);
  const [reason, setReason] = useState<PickupReasonOption["id"] | null>(null);
  const [note, setNote] = useState("");
  const requirements = pickupRequirements(stop, draft);
  const missing = requirements.find((item) => !item.met);
  const verified = new Set(draft.verified);
  const weights = draft.weights ?? {};
  const locked = !!missing || busy || !online;
  const toggle = (id: string) =>
    onChange({
      verified: draft.verified.includes(id)
        ? draft.verified.filter((item) => item !== id)
        : [...draft.verified, id],
    });

  if (problem)
    return (
      <div className="dv-handover">
        <fieldset className="dv-step">
          <legend>Why couldn’t you pick it up?</legend>
          <div className="dv-reasons">
            {PICKUP_REASONS.map((item) => (
              <label
                key={item.id}
                className={`dv-check ${reason === item.id ? "is-checked" : ""}`}
              >
                <input
                  type="radio"
                  name="pickup-reason"
                  checked={reason === item.id}
                  onChange={() => setReason(item.id)}
                />
                <span className="dv-check-box" aria-hidden="true">
                  <Icon name="check" size={16} strokeWidth={2.6} />
                </span>
                <span className="dv-parcel-copy">
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </label>
            ))}
          </div>
          <label className="rf-field">
            <span>
              Note{reason === "other" ? " (required)" : " (optional)"}
            </span>
            <textarea
              value={note}
              maxLength={500}
              placeholder="What happened? Operations will see this."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <p className="rf-muted">
            This parcel comes off your route and returns to operations to
            rebook. It will not be delivered today.
          </p>
        </fieldset>
        {error}
        <div className="dv-sheet-actions">
          <SwipeConfirm
            label="Record not picked up"
            disabled={
              busy ||
              !online ||
              !reason ||
              (reason === "other" && note.trim().length < 3)
            }
            onConfirm={() => reason && onCannotCollect(reason, note)}
            hint={
              busy
                ? "Saving…"
                : !online
                  ? "Waiting for connection"
                  : !reason
                    ? "Choose a reason"
                    : reason === "other" && note.trim().length < 3
                      ? "Describe what happened"
                      : "Swipe to record"
            }
          />
          <button
            type="button"
            className="dv-text-btn"
            onClick={() => setProblem(false)}
          >
            Back to pickup
          </button>
        </div>
      </div>
    );

  const checkedAll = stop.collect.every((order) => verified.has(order.id));
  return (
    <div className="dv-handover">
      {warning}
      <output className="dv-progress">
        <strong>Page {page} of 2</strong>{" "}
        {page === 1 ? "Pickup information" : "Confirm pickup"}
      </output>

      {page === 1 && (
        <>
          <fieldset className="dv-step">
            <legend>
              <span className="dv-badge" aria-hidden="true">
                {checkedAll ? (
                  <Icon name="check" size={14} strokeWidth={2.8} />
                ) : (
                  1
                )}
              </span>
              {stop.collect.length > 1
                ? `Check ${stop.collect.length} parcels`
                : "Check the parcel"}
            </legend>
            {stop.collect.map((order) => (
              <div key={order.id} className="dv-pickup-parcel">
                <label
                  className={`dv-check ${verified.has(order.id) ? "is-checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={verified.has(order.id)}
                    onChange={() => toggle(order.id)}
                  />
                  <span className="dv-check-box" aria-hidden="true">
                    <Icon name="check" size={16} strokeWidth={2.6} />
                  </span>
                  <ParcelLine order={order} />
                </label>
                <label className="rf-field">
                  <span>Weighed on the scale (kg), optional</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={weights[order.id] ?? ""}
                    placeholder={
                      order.parcel_weight_kg
                        ? `Declared ${order.parcel_weight_kg}`
                        : "Not declared"
                    }
                    onChange={(event) =>
                      onChange({
                        weights: { ...weights, [order.id]: event.target.value },
                      })
                    }
                  />
                </label>
              </div>
            ))}
            {stop.parcels.length > stop.collect.length && (
              <p className="rf-muted">
                {stop.parcels.length - stop.collect.length} other{" "}
                {stop.parcels.length - stop.collect.length === 1
                  ? "parcel"
                  : "parcels"}{" "}
                at this address{" "}
                {stop.parcels.length - stop.collect.length === 1 ? "is" : "are"}{" "}
                already handled.
              </p>
            )}
          </fieldset>

          {error}
          <button
            type="button"
            className="dv-text-btn"
            onClick={() => setProblem(true)}
          >
            Can’t pick up this parcel
          </button>
          <div className="dv-sheet-actions">
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={!checkedAll}
              onClick={() => setPage(2)}
              endIcon={<Icon name="arrow-right" size={18} />}
              sx={{ minHeight: 52, borderRadius: 999 }}
            >
              {checkedAll ? "Next · confirm pickup" : "Check the parcels first"}
            </Button>
          </div>
        </>
      )}

      {page === 2 && (
        <div className="dv-collect-page">
          <div className="dv-collect-body">
            <p className="dv-collect-label">Parcels to pick up</p>
            <p className="dv-collect-figure">
              {stop.collect.length}{" "}
              <span>{stop.collect.length === 1 ? "parcel" : "parcels"}</span>
            </p>
            <p className="dv-collect-from">
              From {stop.recipient} · {stop.address}
            </p>
            <ul className="dv-pickup-codes">
              {stop.collect.map((order) => (
                <li key={order.id}>
                  <strong>{order.tracking_code}</strong>
                </li>
              ))}
            </ul>
            {error}
          </div>

          <div className="dv-collect-foot">
            {!online && (
              <p className="rf-dock-note">
                Your entries are kept on this phone. The pickup is sent when
                you’re back online.
              </p>
            )}
            <SwipeConfirm
              label="Confirm pickup"
              disabled={locked}
              onConfirm={onCollect}
              hint={
                busy
                  ? "Saving…"
                  : !online
                    ? "Waiting for connection"
                    : missing
                      ? missing.label
                      : "Swipe to confirm pickup"
              }
            />
            <button
              type="button"
              className="dv-text-btn"
              onClick={() => setPage(1)}
            >
              Back to pickup information
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
