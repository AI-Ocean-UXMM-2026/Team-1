"use client";

import { useState } from "react";
import { classifyComplaint } from "@/lib/delivery/classify-api";
import { Icon } from "@/components/delivery/icons";
import "./manager-classification-widget.css";

interface ClassificationResult {
  category: string;
  priority: string;
  categoryConfidence: number | null;
  mode: "jev" | "mock";
}

export function ManagerClassificationWidget() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Classification failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const getPriorityTone = (priority: string): "error" | "warning" | "info" | "success" => {
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

  return (
    <section className="mh-card mcw-container" aria-labelledby="mcw-title">
      <header className="mh-card-head">
        <div className="mh-card-title">
          <h2 id="mcw-title">
            <span className="dash-icon-tile">
              <Icon name="help" size={16} />
            </span>
            AI Complaint Classifier
          </h2>
          <p>Classify delivery complaints by category and urgency</p>
        </div>
      </header>

      <div className="mcw-content">
        {/* Input Section */}
        <div className="mcw-section">
          <label htmlFor="mcw-input" className="mcw-label">
            Complaint Text
          </label>
          <textarea
            id="mcw-input"
            className="mcw-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter complaint text (max 2000 characters)..."
            maxLength={2000}
            rows={4}
          />
          <div className="mcw-helper">
            {input.length} / 2000 characters
          </div>
        </div>

        {/* Classify Button */}
        <div className="mcw-actions">
          <button
            className="mcw-button mcw-button-primary"
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
                Classify
              </>
            )}
          </button>
          <button
            className="mcw-button mcw-button-secondary"
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

        {/* Error State */}
        {error && (
          <div className="mcw-error">
            <Icon name="warning" size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="mcw-results">
            <div className="mcw-result-grid">
              {/* Mode Badge */}
              <div className="mcw-result-item">
                <label className="mcw-result-label">Mode</label>
                <div className={`mcw-mode-badge mcw-mode-${result.mode}`}>
                  {result.mode === "jev" ? "AI (Jev)" : "Pattern-Based"}
                </div>
              </div>

              {/* Category */}
              <div className="mcw-result-item">
                <label className="mcw-result-label">Category</label>
                <div className="mcw-category">
                  {getCategoryLabel(result.category)}
                </div>
              </div>

              {/* Priority */}
              <div className="mcw-result-item">
                <label className="mcw-result-label">Priority</label>
                <div
                  className={`mcw-priority mcw-priority-${result.priority.toLowerCase()}`}
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

              {/* Confidence */}
              {result.categoryConfidence !== null && (
                <div className="mcw-result-item">
                  <label className="mcw-result-label">Confidence</label>
                  <div className="mcw-confidence">
                    <div className="mcw-confidence-bar">
                      <div
                        className="mcw-confidence-fill"
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

            {/* Copy to Clipboard */}
            <div className="mcw-summary">
              <button
                className="mcw-copy-button"
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

        {/* Empty State */}
        {!result && !loading && !error && (
          <div className="mcw-empty">
            <Icon name="help" size={32} />
            <p>Enter complaint text and click Classify to get started</p>
            <small>Results display category, priority, and confidence</small>
          </div>
        )}
      </div>
    </section>
  );
}
