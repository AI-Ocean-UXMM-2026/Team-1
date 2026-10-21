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
      <fieldset disabled={saving} className="manual-order-fields">
        <legend>Sender</legend>
        <div className="operations-form-row">
          <label>
            Sender name
            <input
              name="senderName"
              ref={senderField}
              autoComplete="off"
              required
            />
          </label>
          <label>
            Sender phone
            <input name="senderPhone" type="tel" required />
          </label>
        </div>
        <label>
          Pickup address
          <textarea name="pickupAddress" rows={2} required />
        </label>
      </fieldset>
      <fieldset disabled={saving} className="manual-order-fields">
        <legend>Receiver</legend>
        <div className="operations-form-row">
          <label>
            Receiver name
            <input name="receiverName" autoComplete="off" required />
          </label>
          <label>
            Receiver phone
            <input name="receiverPhone" type="tel" required />
          </label>
        </div>
        <label>
          Delivery address
          <textarea name="deliveryAddress" rows={2} required />
        </label>
      </fieldset>
      <fieldset disabled={saving} className="manual-order-fields">
        <legend>Items</legend>
        {items.map((item, index) => (
          <div className="manual-order-item" key={item.id}>
            <label className="manual-order-description">
              Description
              <input
                aria-label={`Item ${index + 1} description`}
                value={item.description}
                onChange={(event) =>
                  updateItem(item.id, { description: event.target.value })
                }
                required
              />
            </label>
            <div className="operations-form-row">
              <label>
                Quantity
                <input
                  aria-label={`Item ${index + 1} quantity`}
                  type="number"
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
                Unit price (MMK)
                <input
                  aria-label={`Item ${index + 1} unit price`}
                  type="number"
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
                Subtotal:{" "}
                <strong>
                  {currency.format(
                    Math.max(1, item.quantity) * Math.max(0, item.unitPrice),
                  )}
                </strong>
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  className="button button-outline button-small"
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() =>
                    setItems((previous) =>
                      previous.filter((current) => current.id !== item.id),
                    )
                  }
                >
                  Remove item
                </button>
              )}
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
        <legend>Payment and notes</legend>
        <div className="manual-cod-row">
          <label>
            COD amount (MMK)
            <input
              name="codAmount"
              type="number"
              min="0"
              step="100"
              value={codAmount}
              onChange={(e) => setCodAmount(e.target.value)}
            />
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
          Notes (optional)
          <textarea
            name="notes"
            rows={3}
            placeholder="Delivery instructions or anything the rider should know"
          />
        </label>
      </fieldset>
      <p className="manual-order-hint">
        A tracking ID is generated. A rider is assigned if one is available.
      </p>
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
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
