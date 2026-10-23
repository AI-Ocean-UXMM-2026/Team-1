"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import "./complaints-dashboard.css";

const complaintNavItems = [
  { id: "queue", label: "Queue", href: "/complaints", icon: "help" },
  {
    id: "classified",
    label: "By Priority",
    href: "/complaints?tab=classified",
    icon: "filter",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/complaints?tab=analytics",
    icon: "compass",
  },
] as const;

function complaintTone(item: SupportCase) {
  if (item.status === "resolved" || item.status === "closed")
    return "status-success";
  if (item.priority === "urgent" || item.priority === "high")
    return "status-danger";
  return "status-warm";
}

export function ComplaintsApp({
  hideMobileNav = false,
  hideClassification = false,
}: {
  hideMobileNav?: boolean;
  hideClassification?: boolean;
} = {}) {
  // Detect user role dynamically - allows both managers and support staff
  const [userRole, setUserRole] = useState<"manager" | "support">("support");
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const detectRole = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role === "manager") {
          setUserRole("manager");
        } else {
          setUserRole("support");
        }
      }
      setRoleLoading(false);
    };

    detectRole();
  }, []);

  const workspace = useOperationsWorkspace(userRole);
  const [authOpen, setAuthOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [resolution, setResolution] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<{
    priority: string;
    category: string;
    confidence: number | null;
    mode: string;
  } | null>(null);
  const [classificationHistory, setClassificationHistory] = useState<
    Array<{
      id: string;
      complaintId: string;
      subject: string;
      category: string;
      priority: string;
      confidence: number | null;
      mode: string;
      timestamp: Date;
    }>
  >([]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredComplaints = useMemo(
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

  const selectedComplaint =
    filteredComplaints.find((item) => item.id === selectedId) ??
    filteredComplaints[0] ??
    null;

  // Create the classify function before using it in useEffect
  const classifySelectedComplaint = useCallback(
    async (complaint?: SupportCase) => {
      const target = complaint || selectedComplaint;
      if (!target) return;
      setClassifying(true);
      try {
        const result = await classifyComplaint(target.description);
        setClassificationResult({
          priority: result.priority,
          category: result.category,
          confidence: result.categoryConfidence,
          mode: result.mode,
        });
        // Add to history
        setClassificationHistory((prev) => [
          {
            id: Date.now().toString(),
            complaintId: target.id,
            subject: target.subject,
            category: result.category,
            priority: result.priority,
            confidence: result.categoryConfidence,
            mode: result.mode,
            timestamp: new Date(),
          },
          ...prev.slice(0, 9), // Keep last 10
        ]);
      } catch (cause) {
        // Silently fail for auto-classification
        console.warn("Auto-classification failed:", cause);
      } finally {
        setClassifying(false);
      }
    },
    [selectedComplaint],
  );

  useEffect(() => {
    void selectedId;
    setResolution("");
    setClassificationResult(null);
    // Auto-classify the selected complaint
    if (selectedComplaint && !hideClassification) {
      void classifySelectedComplaint(selectedComplaint);
    }
  }, [
    selectedComplaint,
    classifySelectedComplaint,
    hideClassification,
    selectedId,
  ]);

  const selectedOrder = selectedComplaint?.order_id
    ? (workspace.data.orders.find(
        (item) => item.id === selectedComplaint.order_id,
      ) ?? null)
    : null;

  const openCount = workspace.data.supportCases.filter(
    (item) => item.status === "open" || item.status === "in_progress",
  ).length;

  const urgentCount = workspace.data.supportCases.filter(
    (item) =>
      (item.priority === "urgent" || item.priority === "high") &&
      (item.status === "open" || item.status === "in_progress"),
  ).length;

  const categorizedComplaints = useMemo(() => {
    return {
      p1: workspace.data.supportCases.filter(
        (item) =>
          item.priority === "urgent" &&
          (item.status === "open" || item.status === "in_progress"),
      ),
      p2: workspace.data.supportCases.filter(
        (item) =>
          item.priority === "high" &&
          (item.status === "open" || item.status === "in_progress"),
      ),
      p3: workspace.data.supportCases.filter(
        (item) =>
          item.priority === "normal" &&
          (item.status === "open" || item.status === "in_progress"),
      ),
      p4: workspace.data.supportCases.filter(
        (item) =>
          item.priority === "low" &&
          (item.status === "open" || item.status === "in_progress"),
      ),
    };
  }, [workspace.data.supportCases]);

  const assignedToMe =
    !!selectedComplaint &&
    !!workspace.profile &&
    selectedComplaint.assigned_to === workspace.profile.id;

  const complaintClosed =
    selectedComplaint?.status === "resolved" ||
    selectedComplaint?.status === "closed";

  async function saveComplaint(status: "in_progress" | "resolved") {
    if (!selectedComplaint) return;
    if (workspace.isDemo || !workspace.profile) {
      setNotice(
        "Preview mode: sign in with a support account to update complaints.",
      );
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await updateSupportCase(createClient(), {
        caseId: selectedComplaint.id,
        supportId: workspace.profile.id,
        status,
        resolutionNotes: resolution,
      });
      await workspace.refresh();
      setNotice(
        status === "resolved"
          ? "Complaint resolved."
          : "Complaint assigned to you.",
      );
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Could not update the complaint.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (roleLoading || workspace.isLoading)
    return <LoadingBlock title="Opening complaints dashboard…" />;
  const signedOut = !workspace.isAuthenticated && !workspace.isDemo;

  return (
    <main className="complaints-app operations-app">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <span className="workspace-role-label">Customer Complaints</span>
          {!signedOut && (
            <UserActions
              profile={workspace.profile}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={() => void signOut()}
              label="Complaints"
            />
          )}
        </div>
      </header>

      <nav className="complaints-sidenav">
        <div className="sidenav-group">
          {complaintNavItems.map((item) => (
            <Link key={item.id} href={item.href} className="sidenav-link">
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="complaints-shell" id="complaints-queue">
        <PageHeader
          title="Intelligent Customer Complaints"
          description="Manage delivery complaints from customers. Classify by urgency and resolve."
        />

        {workspace.isDemo && (
          <div className="workspace-demo">
            <DemoBadge>Complaints preview</DemoBadge>
            <span>
              Complaint actions are illustrative until a support account signs
              in.
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
            title="Sign in to the complaints desk"
            body="Support accounts are set up by Oern operations. Sign in to see customer complaints and delivery history."
            onSignIn={() => setAuthOpen(true)}
          />
        ) : (
          <>
            <section className="operations-kpis">
              <div>
                <span>Open complaints</span>
                <strong>{openCount}</strong>
              </div>
              <div>
                <span>Urgent</span>
                <strong>{urgentCount}</strong>
              </div>
              <div>
                <span>Critical (P1)</span>
                <strong>{categorizedComplaints.p1.length}</strong>
              </div>
              <div>
                <span>High (P2)</span>
                <strong>{categorizedComplaints.p2.length}</strong>
              </div>
            </section>

            <div className="complaints-search">
              <Icon name="search" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search complaint subject, description, or tracking code"
                aria-label="Search complaints"
              />
            </div>

            <section
              className={`complaints-layout ${hideClassification ? "complaints-layout--no-classification" : ""}`}
            >
              <div className="operations-panel complaints-queue-panel">
                <div className="section-head-inline">
                  <h2>Complaint queue</h2>
                  <span>
                    {filteredComplaints.length}{" "}
                    {filteredComplaints.length === 1
                      ? "complaint"
                      : "complaints"}
                  </span>
                </div>
                <div className="complaints-list">
                  {filteredComplaints.map((item) => (
                    <button
                      type="button"
                      className={`complaint-row ${selectedComplaint?.id === item.id ? "is-selected" : ""}`}
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className={`status-badge ${complaintTone(item)}`}>
                        {sentenceCase(item.priority)}
                      </span>
                      <strong>{item.subject}</strong>
                      <small>
                        {sentenceCase(item.status)} ·{" "}
                        {formatDateTime(item.updated_at)}
                      </small>
                    </button>
                  ))}
                  {!filteredComplaints.length && (
                    <p className="empty-small-copy">
                      No complaints match this search.
                    </p>
                  )}
                </div>
              </div>

              <aside className="operations-panel complaints-detail">
                {selectedComplaint ? (
                  <>
                    <div className="section-head-inline">
                      <h2>{selectedComplaint.subject}</h2>
                      <span
                        className={`status-badge ${complaintTone(selectedComplaint)}`}
                      >
                        {sentenceCase(selectedComplaint.priority)} priority
                      </span>
                    </div>
                    <p className="complaints-description">
                      {selectedComplaint.description}
                    </p>
                    <dl className="operations-detail-list">
                      <div>
                        <dt>Status</dt>
                        <dd>
                          {sentenceCase(selectedComplaint.status)}
                          {assignedToMe ? " · assigned to you" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Opened</dt>
                        <dd>{formatDateTime(selectedComplaint.created_at)}</dd>
                      </div>
                      {!hideClassification && classificationResult && (
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
                                {(
                                  classificationResult.confidence * 100
                                ).toFixed(0)}
                                %
                              </dd>
                            </div>
                          )}
                        </>
                      )}
                    </dl>
                    {selectedOrder ? (
                      <div className="complaints-order-context">
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
                        No Oern delivery is linked to this complaint.
                      </p>
                    )}
                    {!complaintClosed && (
                      <>
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
                        <div className="operations-actions">
                          <button
                            type="button"
                            className="button button-outline"
                            disabled={classifying}
                            onClick={async () => {
                              setNotice(null);
                              await classifySelectedComplaint(
                                selectedComplaint || undefined,
                              );
                              setNotice(`Re-classified with Jev`);
                            }}
                          >
                            {classifying
                              ? "Classifying..."
                              : "Re-classify with Jev"}
                          </button>
                          {!assignedToMe && (
                            <button
                              type="button"
                              className="button button-outline"
                              disabled={saving}
                              onClick={() => void saveComplaint("in_progress")}
                            >
                              Assign to me
                            </button>
                          )}
                          <button
                            type="button"
                            className="button button-primary"
                            disabled={saving || !resolution.trim()}
                            onClick={() => void saveComplaint("resolved")}
                          >
                            Resolve complaint
                          </button>
                        </div>
                      </>
                    )}
                    {complaintClosed ? (
                      <p className="empty-small-copy">
                        {selectedComplaint.resolution_notes
                          ? `Resolved: ${selectedComplaint.resolution_notes}`
                          : "This complaint is closed."}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-state">
                    <h2>No complaint selected</h2>
                    <p>Select a complaint to see delivery context.</p>
                  </div>
                )}
              </aside>

              {!hideClassification && (
                <aside className="complaints-sidebar">
                  <div className="complaints-sidebar-header">
                    <h3>
                      <Icon name="history" size={14} />
                      Classification History
                    </h3>
                  </div>
                  <div className="complaints-sidebar-content">
                    {classificationHistory.length === 0 ? (
                      <div className="complaints-history-empty">
                        Classifications will appear here
                      </div>
                    ) : (
                      <div>
                        {classificationHistory.map((item) => (
                          <div
                            key={item.id}
                            className="complaints-history-item"
                            title={item.subject}
                          >
                            <div className="complaints-history-item-header">
                              <span className="complaints-history-item-subject">
                                {item.subject}
                              </span>
                            </div>
                            <span className="complaints-history-item-category">
                              {item.category}
                            </span>
                            <div className="complaints-history-item-meta">
                              <span>{item.priority}</span>
                              {item.confidence !== null && (
                                <span>
                                  {(item.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                              <span style={{ fontSize: "10px" }}>
                                {item.mode === "jev" ? "AI" : "Pattern"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              )}
            </section>
          </>
        )}
      </div>
      {!signedOut && !hideMobileNav && (
        <MobileNav label="Complaints" items={complaintNavItems} />
      )}
      <ActionToast message={notice} onDismiss={() => setNotice(null)} />
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
