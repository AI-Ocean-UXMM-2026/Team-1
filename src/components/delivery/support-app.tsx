"use client";

import { useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  Brand,
  DemoBadge,
  LoadingBlock,
  MobileNav,
  StatusBadge,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { formatDateTime } from "@/lib/delivery/format";
import { updateSupportCase } from "@/lib/delivery/operations-actions";
import type { SupportCase } from "@/lib/delivery/operations-types";
import type { DeliveryStatus } from "@/lib/delivery/types";
import { useOperationsWorkspace } from "@/lib/delivery/use-operations-workspace";
import { createClient } from "@/lib/supabase/client";

const supportNavItems = [
  { id: "support-queue", label: "Cases", href: "#support-queue", icon: "help" },
  {
    id: "support-orders",
    label: "Orders",
    href: "#support-orders",
    icon: "package",
  },
  {
    id: "support-providers",
    label: "Providers",
    href: "#support-providers",
    icon: "track",
  },
  {
    id: "support-account",
    label: "Profile",
    href: "#support-account",
    icon: "user",
  },
] as const;

function caseTone(item: SupportCase) {
  if (item.status === "resolved" || item.status === "closed")
    return "status-success";
  if (item.priority === "urgent" || item.priority === "high")
    return "status-danger";
  return "status-warm";
}

export function SupportApp() {
  const workspace = useOperationsWorkspace("support");
  const [authOpen, setAuthOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [resolution, setResolution] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCases = useMemo(
    () =>
      workspace.data.supportCases.filter((item) => {
        const order = workspace.data.orders.find(
          (entry) => entry.id === item.order_id,
        );
        return (
          !normalizedQuery ||
          `${item.subject} ${item.description} ${order?.tracking_code ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery)
        );
      }),
    [normalizedQuery, workspace.data.orders, workspace.data.supportCases],
  );
  const selectedCase =
    filteredCases.find((item) => item.id === selectedId) ??
    filteredCases[0] ??
    null;
  const selectedOrder = selectedCase?.order_id
    ? (workspace.data.orders.find(
        (item) => item.id === selectedCase.order_id,
      ) ?? null)
    : null;
  const openCount = workspace.data.supportCases.filter(
    (item) => item.status === "open" || item.status === "in_progress",
  ).length;
  const urgentCount = workspace.data.supportCases.filter(
    (item) => item.priority === "urgent" || item.priority === "high",
  ).length;

  async function saveCase(status: "in_progress" | "resolved") {
    if (!selectedCase || !workspace.profile) return;
    if (workspace.isDemo) {
      setNotice(
        "Preview mode: sign in with a support account to update cases.",
      );
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await updateSupportCase(createClient(), {
        caseId: selectedCase.id,
        supportId: workspace.profile.id,
        status,
        resolutionNotes: resolution,
      });
      await workspace.refresh();
      setNotice(
        status === "resolved" ? "Case resolved." : "Case assigned to you.",
      );
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Could not update the case.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (workspace.isLoading)
    return <LoadingBlock title="Opening customer support…" />;

  return (
    <main className="operations-app support-app">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <Brand href="/support" />
          <span className="workspace-role-label">Customer support</span>
          <UserActions
            profile={workspace.profile}
            isAuthenticated={workspace.isAuthenticated}
            onSignIn={() => setAuthOpen(true)}
            onSignOut={() => void signOut()}
            label="Support"
          />
        </div>
      </header>

      <div className="operations-shell" id="support-queue">
        <section className="operations-hero">
          <div>
            <span className="eyebrow">DELIVERY HELP DESK</span>
            <h1>Resolve issues with the full delivery context.</h1>
            <p>
              Search Oern and provider shipments, inspect order history, and
              record a clear resolution.
            </p>
          </div>
          <div className="operations-health operations-health-alert">
            <Icon name="warning" size={20} />
            <span>
              <strong>{urgentCount}</strong> priority cases
            </span>
          </div>
        </section>

        {workspace.isDemo && (
          <div className="workspace-demo">
            <DemoBadge>Support preview</DemoBadge>
            <span>
              Case actions are illustrative until a support account signs in.
            </span>
          </div>
        )}
        {notice && <output className="operations-notice">{notice}</output>}
        {workspace.error && (
          <div className="error-notice" role="alert">
            {workspace.error}
          </div>
        )}

        <section className="operations-kpis">
          <div>
            <span>Open cases</span>
            <strong>{openCount}</strong>
          </div>
          <div>
            <span>Priority cases</span>
            <strong>{urgentCount}</strong>
          </div>
          <div>
            <span>Oern orders</span>
            <strong>{workspace.data.orders.length}</strong>
          </div>
          <div>
            <span>Provider shipments</span>
            <strong>{workspace.data.externalShipments.length}</strong>
          </div>
        </section>

        <div className="support-search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search case subject, description, or tracking code"
            aria-label="Search support records"
          />
        </div>

        <section className="support-layout">
          <div className="operations-panel support-queue-panel">
            <div className="section-head-inline">
              <h2>Case queue</h2>
              <span>{filteredCases.length} results</span>
            </div>
            <div className="support-case-list">
              {filteredCases.map((item) => (
                <button
                  type="button"
                  className={`support-case-row ${selectedCase?.id === item.id ? "is-selected" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={`status-badge ${caseTone(item)}`}>
                    {item.priority}
                  </span>
                  <strong>{item.subject}</strong>
                  <small>
                    {item.status.replace("_", " ")} ·{" "}
                    {formatDateTime(item.updated_at)}
                  </small>
                </button>
              ))}
              {!filteredCases.length && (
                <p className="empty-small-copy">No cases match this search.</p>
              )}
            </div>
          </div>

          <aside className="operations-panel support-case-detail">
            {selectedCase ? (
              <>
                <div className="section-head-inline">
                  <h2>{selectedCase.subject}</h2>
                  <span>{selectedCase.priority} priority</span>
                </div>
                <p>{selectedCase.description}</p>
                <dl className="operations-detail-list">
                  <div>
                    <dt>Case status</dt>
                    <dd>{selectedCase.status.replace("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Opened</dt>
                    <dd>{formatDateTime(selectedCase.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Tracking</dt>
                    <dd>
                      {selectedOrder?.tracking_code ?? "No Oern order linked"}
                    </dd>
                  </div>
                  <div>
                    <dt>Delivery state</dt>
                    <dd>
                      {selectedOrder?.status.replace("_", " ") ?? "Unavailable"}
                    </dd>
                  </div>
                </dl>
                {selectedOrder && (
                  <div className="support-order-context">
                    <StatusBadge
                      status={selectedOrder.status as DeliveryStatus}
                    />
                    <strong>{selectedOrder.delivery_address}</strong>
                    <span>
                      {selectedOrder.recipient_name ||
                        "Recipient name unavailable"}{" "}
                      · {selectedOrder.recipient_phone || "No phone"}
                    </span>
                  </div>
                )}
                <label className="operations-field">
                  Resolution notes
                  <textarea
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    rows={4}
                    placeholder="Record the action taken and what the customer should expect."
                  />
                </label>
                <div className="operations-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={saving || !workspace.isAuthenticated}
                    onClick={() => void saveCase("in_progress")}
                  >
                    Assign to me
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={
                      saving || !workspace.isAuthenticated || !resolution.trim()
                    }
                    onClick={() => void saveCase("resolved")}
                  >
                    Resolve case
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h2>No case selected</h2>
                <p>Select a case to see delivery context.</p>
              </div>
            )}
          </aside>
        </section>

        <section className="operations-grid" id="support-orders">
          <div className="operations-panel operations-panel-wide">
            <div className="section-head-inline">
              <h2>Delivery history</h2>
              <span>Oern network</span>
            </div>
            <div className="operations-list">
              {workspace.data.orders.slice(0, 8).map((order) => (
                <article className="operations-list-item" key={order.id}>
                  <span className="operations-provider-mark operations-provider-local">
                    OE
                  </span>
                  <div>
                    <strong>{order.tracking_code}</strong>
                    <span>{order.delivery_address}</span>
                  </div>
                  <StatusBadge status={order.status as DeliveryStatus} />
                </article>
              ))}
            </div>
          </div>
          <div className="operations-panel" id="support-providers">
            <div className="section-head-inline">
              <h2>Provider tracking</h2>
              <span>External network</span>
            </div>
            <div className="operations-list">
              {workspace.data.externalShipments.slice(0, 6).map((shipment) => (
                <article
                  className="operations-list-item operations-list-item-compact"
                  key={shipment.id}
                >
                  <span className="operations-provider-mark">
                    {shipment.provider_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{shipment.tracking_code}</strong>
                    <span>{shipment.provider_name}</span>
                  </div>
                  <StatusBadge status={shipment.status as DeliveryStatus} />
                </article>
              ))}
            </div>
          </div>
        </section>
        <div id="support-account" />
      </div>
      <MobileNav label="Support app" items={supportNavItems} />
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
