"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/delivery/icons";
import {
  createManualDeliveryOrder,
  type ManualOrderItem,
} from "@/lib/delivery/actions";
import { currency } from "@/lib/delivery/format";
import { createClient } from "@/lib/supabase/client";

type DraftItem = ManualOrderItem & { id: number };
type CreatedOrder = Awaited<ReturnType<typeof createManualDeliveryOrder>>;
const firstItem = (): DraftItem => ({
  id: 0,
  description: "",
  quantity: 1,
  unitPrice: 0,
});

export function ManagerCreateOrder({ canCreate }: { canCreate: boolean }) {
  const [items, setItems] = useState<DraftItem[]>(() => [firstItem()]);
  const [codAmount, setCodAmount] = useState<number | string>(0);
  const nextItemId = useRef(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedOrder | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const senderField = useRef<HTMLInputElement>(null);
  const focusSender = useRef(false);

  const itemsTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Math.max(1, item.quantity) * Math.max(0, item.unitPrice),
        0,
      ),
    [items],
  );

  useEffect(() => {
    if (created) {
      successHeading.current?.focus();
    } else if (focusSender.current) {
      focusSender.current = false;
      senderField.current?.focus();
    }
  }, [created]);

  function updateItem(id: number, change: Partial<ManualOrderItem>) {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!canCreate) {
      setError("Your manager account is unavailable. Refresh and try again.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const result = await createManualDeliveryOrder(createClient(), {
        senderName: String(form.get("senderName") || ""),
        senderPhone: String(form.get("senderPhone") || ""),
        pickupAddress: String(form.get("pickupAddress") || ""),
        receiverName: String(form.get("receiverName") || ""),
        receiverPhone: String(form.get("receiverPhone") || ""),
        deliveryAddress: String(form.get("deliveryAddress") || ""),
        items,
        codAmount: Number(form.get("codAmount") || 0),
        notes: String(form.get("notes") || ""),
      });
      setCreated(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the order. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <section
        className="operations-panel manual-order-success"
        aria-labelledby="manual-order-success-title"
      >
        <Icon name="check" size={28} />
        <h2
          id="manual-order-success-title"
          ref={successHeading}
          tabIndex={-1}
          aria-describedby="manual-order-created-instructions manual-order-created-code manual-order-created-assignment"
        >
          Order created
        </h2>
        <p id="manual-order-created-instructions">
          Share this tracking ID with the sender or receiver.
        </p>
        <strong id="manual-order-created-code" className="manual-order-code">
          {created.tracking_code}
        </strong>
        <p id="manual-order-created-assignment">
          {created.assigned_driver_id
            ? "A rider has been assigned automatically."
            : "This order is waiting for an available rider."}
        </p>
        <div className="manual-order-actions">
          <Link
            className="button button-primary"
            href={`/manager/order?id=${encodeURIComponent(created.id)}`}
          >
            {created.assigned_driver_id ? (
              <>
                <Icon name="box" size={16} /> View order
              </>
            ) : (
              <>
                <Icon name="user" size={16} /> Assign rider now
              </>
            )}
          </Link>
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              focusSender.current = true;
              setCreated(null);
              setError(null);
              setCodAmount(0);
              setItems([firstItem()]);
            }}
          >
            Create another order
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      className="operations-panel operations-form manual-order-form"
      onSubmit={submit}
      aria-label="Create manual order"
      aria-busy={saving}
    >
      <p className="manual-order-required-note">
        <span aria-hidden="true">*</span> Required fields
      </p>
      <fieldset disabled={saving} className="manual-order-fields">
        <legend>
          <span>Pickup contact</span>
          <small>Who should the rider contact at collection?</small>
        </legend>
        <div className="operations-form-row">
          <label>
            <span className="manual-order-label">
              Sender or shop name <span aria-hidden="true">*</span>
            </span>
            <input
              name="senderName"
              ref={senderField}
              autoComplete="off"
              placeholder="e.g. Aye Aye Store"
              required
            />
          </label>
          <label>
            <span className="manual-order-label">
              Pickup phone <span aria-hidden="true">*</span>
            </span>
            <input
              name="senderPhone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="e.g. 09 123 456 789"
              required
            />
          </label>
        </div>
        <label>
          <span className="manual-order-label">
            Pickup address <span aria-hidden="true">*</span>
          </span>
          <textarea
            name="pickupAddress"
            rows={3}
            placeholder="Township, street, building and nearby landmark"
            aria-describedby="pickup-address-help"
            required
          />
          <small id="pickup-address-help" className="manual-order-field-help">
            Include enough detail for the rider to find the pickup quickly.
          </small>
        </label>
      </fieldset>
      <fieldset disabled={saving} className="manual-order-fields">
        <legend>
          <span>Delivery contact</span>
          <small>Who will receive the parcel?</small>
        </legend>
        <div className="operations-form-row">
          <label>
            <span className="manual-order-label">
              Receiver name <span aria-hidden="true">*</span>
            </span>
            <input
              name="receiverName"
              autoComplete="off"
              placeholder="e.g. Ko Min"
              required
            />
          </label>
          <label>
            <span className="manual-order-label">
              Receiver phone <span aria-hidden="true">*</span>
            </span>
            <input
              name="receiverPhone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="e.g. 09 123 456 789"
              required
            />
          </label>
        </div>
        <label>
          <span className="manual-order-label">
            Delivery address <span aria-hidden="true">*</span>
          </span>
          <textarea
            name="deliveryAddress"
            rows={3}
            placeholder="Township, street, building and nearby landmark"
            aria-describedby="delivery-address-help"
            required
          />
          <small id="delivery-address-help" className="manual-order-field-help">
            Include access notes such as a floor, gate or building entrance.
          </small>
        </label>
      </fieldset>
      <fieldset disabled={saving} className="manual-order-fields">
        <legend>
          <span>Parcel contents</span>
          <small>
            Add each item so the rider and customer know what to expect.
          </small>
        </legend>
        {items.map((item, index) => (
          <div className="manual-order-item" key={item.id}>
            <div className="manual-order-item-header">
              <strong>Item {index + 1}</strong>
              {items.length > 1 && (
                <button
                  type="button"
                  className="manual-order-remove"
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() =>
                    setItems((previous) =>
                      previous.filter((current) => current.id !== item.id),
                    )
                  }
                >
                  Remove
                </button>
              )}
            </div>
            <label className="manual-order-description">
              <span className="manual-order-label">
                Item description <span aria-hidden="true">*</span>
              </span>
              <input
                aria-label={`Item ${index + 1} description`}
                placeholder="e.g. 2 cotton shirts"
                value={item.description}
                onChange={(event) =>
                  updateItem(item.id, { description: event.target.value })
                }
                required
              />
            </label>
            <div className="operations-form-row">
              <label>
                <span className="manual-order-label">
                  Quantity <span aria-hidden="true">*</span>
                </span>
                <input
                  aria-label={`Item ${index + 1} quantity`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(item.id, {
                      quantity: Number(event.target.value),
                    })
                  }
                  required
                />
              </label>
              <label>
                <span className="manual-order-label">
                  Price per item (MMK) <span aria-hidden="true">*</span>
                </span>
                <input
                  aria-label={`Item ${index + 1} unit price`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="100"
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateItem(item.id, {
                      unitPrice: Number(event.target.value),
                    })
                  }
                  required
                />
              </label>
            </div>
            <div className="manual-item-subtotal-row">
              <span className="manual-item-subtotal">
                Item total{" "}
                <strong>
                  {currency.format(
                    Math.max(1, item.quantity) * Math.max(0, item.unitPrice),
                  )}
                </strong>
              </span>
            </div>
          </div>
        ))}
        <div className="manual-items-footer">
          <button
            type="button"
            className="button button-outline manual-order-add"
            onClick={() => {
              const id = nextItemId.current++;
              setItems((previous) => [...previous, { ...firstItem(), id }]);
            }}
          >
            <Icon name="plus" size={18} /> Add item
          </button>
          <div className="manual-items-summary">
            <span>Order items total:</span>
            <strong>{currency.format(itemsTotal)}</strong>
          </div>
        </div>
      </fieldset>
      <fieldset disabled={saving} className="manual-order-fields">
        <legend>
          <span>Cash collection and rider notes</span>
          <small>
            Confirm what the rider should collect and any special instructions.
          </small>
        </legend>
        <div className="manual-cod-row">
          <label>
            Cash to collect (MMK)
            <input
              name="codAmount"
              type="number"
              inputMode="numeric"
              min="0"
              step="100"
              value={codAmount}
              onChange={(e) => setCodAmount(e.target.value)}
              aria-describedby="cod-amount-help"
            />
            <small id="cod-amount-help" className="manual-order-field-help">
              Enter 0 if the rider should not collect cash on delivery.
            </small>
          </label>
          {itemsTotal > 0 && (
            <button
              type="button"
              className="button button-small button-outline manual-cod-match"
              onClick={() => setCodAmount(itemsTotal)}
            >
              Match items total ({currency.format(itemsTotal)})
            </button>
          )}
        </div>
        <label>
          Rider instructions (optional)
          <textarea
            name="notes"
            rows={3}
            placeholder="e.g. Call before arrival; use the east gate"
          />
        </label>
      </fieldset>
      <div className="manual-order-outcome">
        <strong>What happens next</strong>
        <span>
          We’ll generate a tracking ID and assign an available rider
          automatically. If no rider is available, the order will stay ready for
          assignment.
        </span>
      </div>
      {!canCreate && (
        <p className="error-notice" role="alert">
          Order creation is unavailable for this manager account. Refresh the
          page or sign in again.
        </p>
      )}
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      <div className="manual-order-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={saving || !canCreate}
        >
          {saving ? "Creating order…" : "Create order"}
        </button>
        {!saving && (
          <Link className="button button-outline" href="/manager/order">
            Back to orders
          </Link>
        )}
      </div>
    </form>
  );
}
