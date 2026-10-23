"use client";

import { useState } from "react";
import { classifyComplaint } from "@/lib/delivery/classify-api";
import { Icon } from "@/components/delivery/icons";
import "./manager-classification-page.css";

interface ClassificationResult {
  category: string;
  priority: string;
  categoryConfidence: number | null;
  mode: "jev" | "mock";
}

interface SavedClassification extends ClassificationResult {
  id: string;
  text: string;
  timestamp: Date;
}

export function ManagerClassificationPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedClassification[]>([]);

  const handleClassify = async () => {
    if (!input.trim()) {
      setError("Please enter complaint text");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const classResult = await classifyComplaint(input);
      setResult(classResult);

      // Add to history
      const newEntry: SavedClassification = {
        ...classResult,
        id: Date.now().toString(),
        text: input,
        timestamp: new Date(),
      };
      setHistory([newEntry, ...history]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Classification failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const getPriorityTone = (
    priority: string
  ): "error" | "warning" | "info" | "success" => {
    switch (priority) {
      case "P1":
        return "error";
      case "P2":
        return "warning";
      case "P3":
        return "info";
      case "P4":
        return "success";
      default:
        return "info";
    }
  };

  const getPriorityLabel = (priority: string): string => {
    const labels: Record<string, string> = {
      P1: "Critical",
      P2: "High",
      P3: "Medium",
      P4: "Low",
    };
    return labels[priority] || priority;
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      tracking_visibility: "Tracking & Visibility",
      delivery_delay: "Delivery Delay",
      driver_assignment: "Driver Assignment",
      route_navigation: "Route & Navigation",
      cod_settlement: "COD Settlement",
      vehicle_capacity_energy: "Vehicle & Fuel",
      gps_technical: "GPS Technical",
      status_proof: "Status & Proof",
      notification_alerts: "Notifications",
      access_privacy: "Privacy & Access",
      delivery_failure: "Delivery Failure",
      address_quality: "Address Quality",
      other_general: "Other",
    };
    return labels[category] || category;
  };

  const clearHistory = () => {
    if (confirm("Clear all classification history?")) {
      setHistory([]);
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(history.filter((item) => item.id !== id));
  };

  return (
    <div className="mcp-page">
      {/* Header */}
      <header className="mcp-header">
        <div className="mcp-header-content">
          <h1>
            <Icon name="help" size={28} />
            Customer Complaint Classification
          </h1>
          <p>Classify delivery complaints by category and urgency</p>
        </div>
      </header>

      <div className="mcp-layout">
        {/* Main Content */}
        <main className="mcp-main">
          <section className="mcp-card mcp-input-section">
            <header className="mcp-card-head">
              <h2>Classify Complaint</h2>
            </header>

            <div className="mcp-content">
              {/* Input */}
              <div className="mcp-form-group">
                <label htmlFor="mcp-input" className="mcp-label">
                  Complaint Text
                </label>
                <textarea
                  id="mcp-input"
                  className="mcp-textarea"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter customer complaint (max 2000 characters)..."
                  maxLength={2000}
                  rows={6}
                />
                <div className="mcp-helper">
                  {input.length} / 2000 characters
                </div>
              </div>

              {/* Buttons */}
              <div className="mcp-actions">
                <button
                  className="mcp-button mcp-button-primary"
                  onClick={handleClassify}
                  disabled={loading || !input.trim()}
                >
                  {loading ? (
                    <>
                      <Icon name="refresh" size={16} />
                      Classifying...
                    </>
                  ) : (
                    <>
                      <Icon name="help" size={16} />
                      Classify Complaint
                    </>
                  )}
                </button>
                <button
                  className="mcp-button mcp-button-secondary"
                  onClick={() => {
                    setInput("");
                    setResult(null);
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Clear
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="mcp-error">
                  <Icon name="warning" size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="mcp-results">
                  <h3>Classification Result</h3>
                  <div className="mcp-result-grid">
                    <div className="mcp-result-item">
                      <span className="mcp-result-label">Mode</span>
                      <div
                        className={`mcp-mode-badge mcp-mode-${result.mode}`}
                      >
                        {result.mode === "jev"
                          ? "AI (Jev)"
                          : "Pattern-Based"}
                      </div>
                    </div>

                    <div className="mcp-result-item">
                      <span className="mcp-result-label">Category</span>
                      <div className="mcp-category">
                        {getCategoryLabel(result.category)}
                      </div>
                    </div>

                    <div className="mcp-result-item">
                      <span className="mcp-result-label">Priority</span>
                      <div
                        className={`mcp-priority mcp-priority-${result.priority.toLowerCase()}`}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          {getPriorityTone(result.priority) === "error" && (
                            <>
                              <circle cx="8" cy="8" r="6.2" />
                              <path d="m5.8 5.8 4.4 4.4M10.2 5.8l-4.4 4.4" />
                            </>
                          )}
                          {getPriorityTone(result.priority) === "warning" && (
                            <>
                              <path d="M8 2 14.2 13H1.8L8 2Z" />
                              <path d="M8 6.5v3M8 11.4v.1" />
                            </>
                          )}
                          {getPriorityTone(result.priority) === "info" && (
                            <>
                              <circle cx="8" cy="8" r="6.2" />
                              <path d="M8 7.2v3.6M8 5.1v.1" />
                            </>
                          )}
                          {getPriorityTone(result.priority) === "success" && (
                            <>
                              <circle cx="8" cy="8" r="6.2" />
                              <path d="m5.2 8.2 2 2 3.6-4" />
                            </>
                          )}
                        </svg>
                        <span>{getPriorityLabel(result.priority)}</span>
                      </div>
                    </div>

                    {result.categoryConfidence !== null && (
                      <div className="mcp-result-item">
                        <span className="mcp-result-label">Confidence</span>
                        <div className="mcp-confidence">
                          <div className="mcp-confidence-bar">
                            <div
                              className="mcp-confidence-fill"
                              style={{
                                width: `${result.categoryConfidence * 100}%`,
                              }}
                            />
                          </div>
                          <span>
                            {(result.categoryConfidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mcp-result-actions">
                    <button
                      className="mcp-copy-button"
                      onClick={() => {
                        const text = `Category: ${getCategoryLabel(result.category)}\nPriority: ${getPriorityLabel(result.priority)}\nConfidence: ${(result.categoryConfidence ? result.categoryConfidence * 100 : 0).toFixed(0)}%\nMode: ${result.mode}`;
                        navigator.clipboard.writeText(text);
                      }}
                    >
                      <Icon name="copy" size={14} />
                      Copy Results
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Sidebar - History */}
        <aside className="mcp-sidebar">
          <section className="mcp-card">
            <header className="mcp-card-head">
              <h2>
                <Icon name="history" size={16} />
                Classification History
              </h2>
              {history.length > 0 && (
                <button
                  className="mcp-clear-history"
                  onClick={clearHistory}
                  title="Clear all history"
                >
                  Clear
                </button>
              )}
            </header>

            <div className="mcp-history">
              {history.length === 0 ? (
                <p className="mcp-empty">No classifications yet</p>
              ) : (
                <div className="mcp-history-list">
                  {history.map((item) => (
                    <div key={item.id} className="mcp-history-item">
                      <div className="mcp-history-header">
                        <strong className="mcp-history-category">
                          {getCategoryLabel(item.category)}
                        </strong>
                        <div
                          className={`mcp-history-priority mcp-priority-${item.priority.toLowerCase()}`}
                        >
                          {getPriorityLabel(item.priority)}
                        </div>
                      </div>

                      <p className="mcp-history-text">{item.text}</p>

                      <div className="mcp-history-meta">
                        <span className="mcp-history-mode">
                          {item.mode === "jev" ? "AI" : "Pattern"}
                        </span>
                        <span className="mcp-history-confidence">
                          {(item.categoryConfidence ? item.categoryConfidence * 100 : 0).toFixed(0)}%
                        </span>
                        <button
                          className="mcp-delete-button"
                          onClick={() => deleteHistoryItem(item.id)}
                          title="Delete"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
