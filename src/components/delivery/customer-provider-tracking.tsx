"use client";

import { type FormEvent, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { formatDateTime } from "@/lib/delivery/format";
import {
  addCustomerShipment,
  createSupportCase,
} from "@/lib/delivery/operations-actions";
import { useOperationsWorkspace } from "@/lib/delivery/use-operations-workspace";
import { createClient } from "@/lib/supabase/client";

export function CustomerProviderTracking() {
  const workspace = useOperationsWorkspace("customer");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(action: () => Promise<void>, message: string) {
    if (workspace.isDemo) {
      setNotice("Sign in to add provider tracking to your account.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await action();
      await workspace.refresh();
      setNotice(message);
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Could not save this shipment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    await save(
      () =>
        addCustomerShipment(createClient(), {
          customerId: profile.id,
          providerName: String(form.get("provider")),
          trackingCode: String(form.get("tracking")),
          trackingUrl: String(form.get("trackingUrl") || ""),
        }),
      "Provider shipment added.",
    );
  }

  async function requestHelp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    await save(
      () =>
        createSupportCase(createClient(), {
          requesterId: profile.id,
          subject: String(form.get("subject")),
          description: String(form.get("description")),
          priority: "normal",
        }),
      "Support request created.",
    );
  }

  return (
    <section className="provider-tracking-section shell-width" id="providers">
      <div className="section-head-block">
        <div>
          <span className="eyebrow">MULTI-PROVIDER TRACKING</span>
          <h2>All your parcels, one delivery view</h2>
        </div>
        <span className="provider-count">
          {workspace.data.externalShipments.length} connected
        </span>
      </div>
      {notice && <output className="operations-notice">{notice}</output>}
      <div className="provider-tracking-grid">
        <div className="provider-shipment-list">
          {workspace.data.externalShipments.map((shipment) => (
            <article className="provider-shipment-card" key={shipment.id}>
              <span className="operations-provider-mark">
                {shipment.provider_name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{shipment.tracking_code}</strong>
                <span>
                  {shipment.provider_name} · {shipment.status.replace("_", " ")}
                </span>
                <small>
                  Updated{" "}
                  {formatDateTime(
                    shipment.latest_event_at || shipment.updated_at,
                  )}
                </small>
              </div>
              {shipment.tracking_url && (
                <a
                  href={shipment.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${shipment.provider_name} tracking`}
                >
                  <Icon name="external" size={16} />
                </a>
              )}
            </article>
          ))}
          {!workspace.data.externalShipments.length && (
            <div className="empty-state">
              <Icon name="track" size={24} />
              <h2>No provider shipments</h2>
              <p>Add a tracking code from another carrier.</p>
            </div>
          )}
        </div>
        <div className="provider-actions-panel">
          <form className="operations-form" onSubmit={addShipment}>
            <h3>Add another provider</h3>
            <label>
              Carrier or store
              <input name="provider" required />
            </label>
            <label>
              Tracking code
              <input
                name="tracking"
                required
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              Tracking URL
              <input name="trackingUrl" type="url" />
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={saving || !workspace.isAuthenticated}
            >
              Add tracking
            </button>
          </form>
          <form
            className="operations-form provider-help-form"
            onSubmit={requestHelp}
          >
            <h3>Need delivery help?</h3>
            <label>
              Issue
              <input name="subject" required />
            </label>
            <label>
              Details
              <textarea name="description" rows={3} required />
            </label>
            <button
              className="button button-outline"
              type="submit"
              disabled={saving || !workspace.isAuthenticated}
            >
              Contact support
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
