"use client";

import { useEffect, useMemo, useState } from "react";

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
import { Icon } from "@/components/delivery/icons";
import { classifyComplaint } from "@/lib/delivery/classify-api";
import { formatDateTime, sentenceCase } from "@/lib/delivery/format";
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
  const [classifying, setClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<
    | {
        priority: string;
        category: string;
        confidence: number | null;
        mode: string;
      }
    | null
  >(null);

  useEffect(() => {
    void selectedId;
    setResolution("");
  }, [selectedId]);
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
  // Resolved cases no longer need attention, whatever their priority was.
  const urgentCount = workspace.data.supportCases.filter(
    (item) =>
      (item.priority === "urgent" || item.priority === "high") &&
      (item.status === "open" || item.status === "in_progress"),
  ).length;
  const assignedToMe =
    !!selectedCase &&
    !!workspace.profile &&
    selectedCase.assigned_to === workspace.profile.id;
  const caseClosed =
    selectedCase?.status === "resolved" || selectedCase?.status === "closed";

  async function classifySelectedCase() {
    if (!selectedCase) return;
    setClassifying(true);
    setNotice(null);
    try {
      const result = await classifyComplaint(selectedCase.description);
      setClassificationResult({
        priority: result.priority,
        category: result.category,
        confidence: result.categoryConfidence,
        mode: result.mode,
      });
      setNotice(
        `Classified as ${result.priority} priority (${result.mode} mode)`,
      );
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Could not classify the case.",
      );
    } finally {
      setClassifying(false);
    }
  }

  async function saveCase(status: "in_progress" | "resolved") {
    if (!selectedCase) return;
    if (workspace.isDemo || !workspace.profile) {
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
  const signedOut = !workspace.isAuthenticated && !workspace.isDemo;

  return (
    <main className="operations-app support-app">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <span className="workspace-role-label">Customer support</span>
          {/* Signed out, the page body already offers sign-in. */}
          {!signedOut && (
            <UserActions
              profile={workspace.profile}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={() => void signOut()}
              label="Support"
            />
          )}
        </div>
      </header>

      <div className="operations-shell" id="support-queue">
        <PageHeader
          title="Cases"
          description="Find the delivery behind each request and record how it was resolved."
        />

        {workspace.isDemo && (
          <div className="workspace-demo">
            <DemoBadge>Support preview</DemoBadge>
            <span>
              Case actions are illustrative until a support account signs in.
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
            title="Sign in to the support desk"
            body="Support accounts are set up by Oern operations. Sign in to see customer cases and delivery history."
            onSignIn={() => setAuthOpen(true)}
          />
        ) : (
          <>
            <section className="operations-kpis">
              <div>
                <span>Open cases</span>
                <strong>{openCount}</strong>
              </div>
              <div>
                <span>Open high priority</span>
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
                  <span>
                    {filteredCases.length}{" "}
                    {filteredCases.length === 1 ? "case" : "cases"}
                  </span>
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
                        {sentenceCase(item.priority)}
                      </span>
                      <strong>{item.subject}</strong>
                      <small>
                        {sentenceCase(item.status)} ·{" "}
                        {formatDateTime(item.updated_at)}
                      </small>
                    </button>
                  ))}
                  {!filteredCases.length && (
                    <p className="empty-small-copy">
                      No cases match this search.
                    </p>
                  )}
                </div>
              </div>

              <aside className="operations-panel support-case-detail">
                {selectedCase ? (
                  <>
                    <div className="section-head-inline">
                      <h2>{selectedCase.subject}</h2>
                      <span
                        className={`status-badge ${caseTone(selectedCase)}`}
                      >
                        {sentenceCase(selectedCase.priority)} priority
                      </span>
                    </div>
                    <p className="support-case-description">
                      {selectedCase.description}
                    </p>
                    <dl className="operations-detail-list">
                      <div>
                        <dt>Status</dt>
                        <dd>
                          {sentenceCase(selectedCase.status)}
                          {assignedToMe ? " · assigned to you" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Opened</dt>
                        <dd>{formatDateTime(selectedCase.created_at)}</dd>
                      </div>
                       {classificationResult && (
                         <>
                           <div>
                             <dt>AI Classification</dt>
                             <dd>
                               <span
                                 style={{
                                   display: "inline-block",
                                   fontSize: "0.75rem",
                                   padding: "0.25rem 0.5rem",
                                   borderRadius: "0.25rem",
                                   backgroundColor: "#f0f0f0",
                                   marginRight: "0.5rem",
                                 }}
                               >
                                 {classificationResult.mode.toUpperCase()}
                               </span>
                             </dd>
                           </div>
                           <div>
                             <dt>Category</dt>
                             <dd>{classificationResult.category}</dd>
                           </div>
                           <div>
                             <dt>Suggested Priority</dt>
                             <dd>{classificationResult.priority}</dd>
                           </div>
                           {classificationResult.confidence !== null && (
                             <div>
                               <dt>Confidence</dt>
                               <dd>
                                 {(classificationResult.confidence * 100).toFixed(
                                   0,
                                 )}
                                 %
                               </dd>
                             </div>
                           )}
                         </>
                       )}
                    </dl>
                    {selectedOrder ? (
                      <div className="support-order-context">
                        <span>
                          <strong>{selectedOrder.tracking_code}</strong>
                          <StatusBadge
                            status={selectedOrder.status as DeliveryStatus}
                          />
                        </span>
                        <strong>{selectedOrder.delivery_address}</strong>
                        <span>
                          {selectedOrder.recipient_name ||
                            "Recipient name unavailable"}{" "}
                          · {selectedOrder.recipient_phone || "No phone"}
                        </span>
                      </div>
                    ) : (
                      <p className="empty-small-copy">
                        No Oern delivery is linked to this case.
                      </p>
                    )}
                    {!caseClosed && (
                      <label className="operations-field">
                        Resolution notes
                        <textarea
                          value={resolution}
                          onChange={(event) =>
                            setResolution(event.target.value)
                          }
                          rows={4}
                          placeholder="Record the action taken and what the customer should expect."
                        />
                      </label>
                    )}
                    {caseClosed ? (
                      <p className="empty-small-copy">
                        {selectedCase.resolution_notes
                          ? `Resolved: ${selectedCase.resolution_notes}`
                          : "This case is closed."}
                      </p>
                    ) : (
                      <div className="operations-actions">
                         <button
                           type="button"
                           className="button button-outline"
                           disabled={classifying}
                           onClick={() => void classifySelectedCase()}
                         >
                           {classifying ? "Classifying..." : "Classify with Jev"}
                         </button>
                        {!assignedToMe && (
                          <button
                            type="button"
                            className="button button-outline"
                            disabled={saving}
                            onClick={() => void saveCase("in_progress")}
                          >
                            Assign to me
                          </button>
                        )}
                        <button
                          type="button"
                          className="button button-primary"
                          disabled={saving || !resolution.trim()}
                          onClick={() => void saveCase("resolved")}
                        >
                          Resolve case
                        </button>
                      </div>
                    )}
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
                  {!workspace.data.orders.length && (
                    <p className="empty-small-copy">No Oern deliveries yet.</p>
                  )}
                </div>
              </div>
              <div className="operations-panel" id="support-providers">
                <div className="section-head-inline">
                  <h2>Provider tracking</h2>
                  <span>External network</span>
                </div>
                <div className="operations-list">
                  {workspace.data.externalShipments
                    .slice(0, 6)
                    .map((shipment) => (
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
                        <StatusBadge
                          status={shipment.status as DeliveryStatus}
                        />
                      </article>
                    ))}
                  {!workspace.data.externalShipments.length && (
                    <p className="empty-small-copy">
                      No carrier shipments yet.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
      {!signedOut && <MobileNav label="Support app" items={supportNavItems} />}
      <ActionToast message={notice} onDismiss={() => setNotice(null)} />
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
