"use client";

import { type FormEvent, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  ActionToast,
  DemoBadge,
  LoadingBlock,
  MobileNav,
  PageHeader,
  SignInGate,
  StatusBadge,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { createDelivery } from "@/lib/delivery/actions";
import {
  createCommerceIntegration,
  importExternalShipment,
  updateExternalShipmentStatus,
} from "@/lib/delivery/operations-actions";
import type { DeliveryStatus } from "@/lib/delivery/types";
import { useOperationsWorkspace } from "@/lib/delivery/use-operations-workspace";
import { createClient } from "@/lib/supabase/client";

const sellerNavItems = [
  {
    id: "seller-overview",
    label: "Overview",
    href: "#seller-overview",
    icon: "history",
  },
  {
    id: "seller-orders",
    label: "Orders",
    href: "#seller-orders",
    icon: "package",
  },
  {
    id: "seller-channels",
    label: "Channels",
    href: "#seller-channels",
    icon: "settings",
  },
  {
    id: "seller-import",
    label: "Import",
    href: "#seller-import",
    icon: "plus",
  },
] as const;

const BEFORE_TRANSIT = ["pending", "accepted", "picked_up"];

function previewOrLoadingNotice(isDemo: boolean) {
  return isDemo
    ? "Preview mode: sign in with a seller account to save this change."
    : "Your seller account is still loading. Try again in a moment.";
}

export function SellerApp() {
  const workspace = useOperationsWorkspace("seller");
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const activeShipments = workspace.data.externalShipments.filter(
    (shipment) =>
      !["delivered", "failed", "cancelled"].includes(shipment.status),
  );
  const localOrders = workspace.data.orders;
  const deliveredCount =
    workspace.data.externalShipments.filter(
      (item) => item.status === "delivered",
    ).length + localOrders.filter((item) => item.status === "delivered").length;
  const providerOptions = useMemo(
    () => workspace.data.integrations.map((item) => item.provider_name),
    [workspace.data.integrations],
  );

  /** Resolves true once saved, so the form can clear for the next entry. */
  async function runAction(action: () => Promise<unknown>, message: string) {
    if (workspace.isDemo) {
      setNotice(previewOrLoadingNotice(true));
      return false;
    }
    setSaving(true);
    setNotice(null);
    try {
      await action();
      await workspace.refresh();
      setNotice(message);
      return true;
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Could not save the change.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function connectChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) {
      setNotice(previewOrLoadingNotice(workspace.isDemo));
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await runAction(
      () =>
        createCommerceIntegration(createClient(), {
          sellerId: profile.id,
          providerName: String(form.get("provider")),
          storeName: String(form.get("store")),
          providerType: String(form.get("type")) as
            | "ecommerce"
            | "marketplace"
            | "carrier",
          externalAccountId: String(form.get("account") || ""),
        }),
      "Sales channel connected.",
    );
    if (saved) formElement.reset();
  }

  async function importShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) {
      setNotice(previewOrLoadingNotice(workspace.isDemo));
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const provider = String(form.get("provider"));
    const integration = workspace.data.integrations.find(
      (item) => item.provider_name === provider,
    );
    const saved = await runAction(
      () =>
        importExternalShipment(createClient(), {
          sellerId: profile.id,
          integrationId: integration?.id,
          providerName: provider,
          trackingCode: String(form.get("tracking")),
          externalOrderReference: String(form.get("reference") || ""),
          originLabel: String(form.get("origin") || ""),
          destinationLabel: String(form.get("destination") || ""),
          trackingUrl: String(form.get("trackingUrl") || ""),
        }),
      "External order imported.",
    );
    if (saved) formElement.reset();
  }

  async function requestDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) {
      setNotice(previewOrLoadingNotice(workspace.isDemo));
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await runAction(
      () =>
        createDelivery(createClient(), {
          managerId: profile.id,
          customerId: profile.id,
          pickupAddress: String(form.get("pickup")),
          deliveryAddress: String(form.get("delivery")),
          recipientName: String(form.get("recipient")),
          recipientPhone: String(form.get("phone")),
          parcelDescription: String(form.get("parcel")),
          codAmount: Number(form.get("cod") || 0),
        }),
      "Delivery request submitted to operations.",
    );
    if (saved) formElement.reset();
  }

  if (workspace.isLoading)
    return <LoadingBlock title="Opening seller operations…" />;
  const signedOut = !workspace.isAuthenticated && !workspace.isDemo;

  return (
    <main className="operations-app seller-app">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <span className="workspace-role-label">Seller console</span>
          {/* Signed out, the page body already offers sign-in. */}
          {!signedOut && (
            <UserActions
              profile={workspace.profile}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={() => void signOut()}
              label="Seller"
            />
          )}
        </div>
      </header>

      <div className="operations-shell" id="seller-overview">
        <PageHeader
          title="Deliveries"
          description="Request Oern deliveries and follow orders from connected channels in one queue."
        />

        {workspace.isDemo && (
          <div className="workspace-demo">
            <DemoBadge>Seller preview</DemoBadge>
            <span>
              Forms and shipment changes are illustrative until a seller account
              signs in.
            </span>
          </div>
        )}
        {workspace.error && (
          <div className="error-notice" role="alert">
            {workspace.error}
          </div>
        )}

        {signedOut ? (
          <SignInGate
            title="Sign in to the seller console"
            body="Seller accounts are set up by Oern operations. Sign in to request deliveries and import carrier orders."
            onSignIn={() => setAuthOpen(true)}
          />
        ) : (
          <>
            <section className="operations-kpis" aria-label="Seller summary">
              <div>
                <span>Connected channels</span>
                <strong>{workspace.data.integrations.length}</strong>
              </div>
              <div>
                <span>Oern deliveries</span>
                <strong>{localOrders.length}</strong>
              </div>
              <div>
                <span>Carrier orders in progress</span>
                <strong>{activeShipments.length}</strong>
              </div>
              <div>
                <span>Delivered</span>
                <strong>{deliveredCount}</strong>
              </div>
            </section>

            <section className="operations-grid" id="seller-orders">
              <div className="operations-panel operations-panel-wide">
                <div className="section-head-inline">
                  <h2>Unified order queue</h2>
                  <span>Local and provider deliveries</span>
                </div>
                <div className="operations-list">
                  {workspace.data.externalShipments.map((shipment) => (
                    <article className="operations-list-item" key={shipment.id}>
                      <span className="operations-provider-mark">
                        {shipment.provider_name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{shipment.tracking_code}</strong>
                        <span>
                          {shipment.provider_name} ·{" "}
                          {shipment.destination_label || "Destination pending"}
                        </span>
                      </div>
                      <StatusBadge status={shipment.status as DeliveryStatus} />
                      {/* Only offered while it would change something. */}
                      {BEFORE_TRANSIT.includes(shipment.status) && (
                        <button
                          className="button button-outline button-small"
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void runAction(
                              () =>
                                updateExternalShipmentStatus(
                                  createClient(),
                                  shipment.id,
                                  "in_transit",
                                ),
                              "Shipment status updated.",
                            )
                          }
                        >
                          Mark in transit
                        </button>
                      )}
                    </article>
                  ))}
                  {localOrders.map((order) => (
                    <article className="operations-list-item" key={order.id}>
                      <span className="operations-provider-mark operations-provider-local">
                        OE
                      </span>
                      <div>
                        <strong>{order.tracking_code}</strong>
                        <span>Oern · {order.delivery_address}</span>
                      </div>
                      <StatusBadge status={order.status as DeliveryStatus} />
                    </article>
                  ))}
                  {!workspace.data.externalShipments.length &&
                    !localOrders.length && (
                      <p className="empty-small-copy">
                        No orders yet. Request an Oern delivery or import a
                        carrier order to see it here.
                      </p>
                    )}
                </div>
              </div>

              <form
                className="operations-panel operations-form"
                onSubmit={requestDelivery}
              >
                <div className="section-head-inline">
                  <h2>Request an Oern delivery</h2>
                </div>
                <label>
                  Pickup address
                  <input name="pickup" required />
                </label>
                <label>
                  Delivery address
                  <input name="delivery" required />
                </label>
                <div className="operations-form-row">
                  <label>
                    Recipient
                    <input name="recipient" required />
                  </label>
                  <label>
                    Phone
                    <input name="phone" inputMode="tel" required />
                  </label>
                </div>
                <label>
                  Parcel description
                  <input name="parcel" required />
                </label>
                <label>
                  COD amount
                  <input
                    name="cod"
                    type="number"
                    min="0"
                    step="100"
                    defaultValue="0"
                  />
                </label>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={saving}
                >
                  Submit delivery
                </button>
              </form>
            </section>

            <section className="operations-grid" id="seller-channels">
              <form
                className="operations-panel operations-form"
                onSubmit={connectChannel}
              >
                <div className="section-head-inline">
                  <h2>Connect a sales channel</h2>
                </div>
                <label>
                  Provider
                  <input
                    name="provider"
                    placeholder="Shopify, WooCommerce, marketplace"
                    required
                  />
                </label>
                <label>
                  Store name
                  <input name="store" required />
                </label>
                <div className="operations-form-row">
                  <label>
                    Channel type
                    <select name="type" defaultValue="ecommerce">
                      <option value="ecommerce">E-commerce</option>
                      <option value="marketplace">Marketplace</option>
                      <option value="carrier">Carrier</option>
                    </select>
                  </label>
                  <label>
                    External account ID
                    <input name="account" />
                  </label>
                </div>
                <button
                  className="button button-dark"
                  type="submit"
                  disabled={saving}
                >
                  Connect channel
                </button>
              </form>

              <div className="operations-panel" id="seller-import">
                <form className="operations-form" onSubmit={importShipment}>
                  <div className="section-head-inline">
                    <h2>Import a provider order</h2>
                  </div>
                  <label>
                    Provider
                    <input
                      name="provider"
                      list="seller-provider-list"
                      required
                    />
                  </label>
                  <datalist id="seller-provider-list">
                    {providerOptions.map((item) => (
                      <option value={item} key={item} />
                    ))}
                  </datalist>
                  <div className="operations-form-row">
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
                      Order reference
                      <input name="reference" />
                    </label>
                  </div>
                  <label>
                    Origin
                    <input name="origin" />
                  </label>
                  <label>
                    Destination
                    <input name="destination" />
                  </label>
                  <label>
                    Carrier tracking URL
                    <input name="trackingUrl" type="url" />
                  </label>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={saving}
                  >
                    Import order
                  </button>
                </form>
              </div>
            </section>
          </>
        )}
      </div>
      {!signedOut && <MobileNav label="Seller app" items={sellerNavItems} />}
      <ActionToast message={notice} onDismiss={() => setNotice(null)} />
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
