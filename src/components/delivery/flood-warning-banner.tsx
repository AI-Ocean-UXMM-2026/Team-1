"use client";

import { Icon } from "@/components/delivery/icons";
import type { RouteFloodRisk } from "@/lib/delivery/flood-zones";

/**
 * Two complete lines over the map: the delay risk leads, the corridor names
 * follow. The full sentence stays in the accessible name, so nothing is lost
 * when a long corridor name is ellipsized at 320px.
 */
export function FloodWarningBanner({ risk }: { risk: RouteFloodRisk }) {
  if (!risk.hasFloodRisk || !risk.warningMessage) return null;
  const zoneNames = risk.intersectedZones.map((zone) => zone.name);
  const reportCount = risk.nearbyFloodReports.length;
  const delay =
    risk.suggestedSlowdownPercent > 0
      ? `+${risk.suggestedSlowdownPercent}% delay risk`
      : null;
  const detail =
    zoneNames.length > 0
      ? `Flood corridor: ${zoneNames.join(" · ")}`
      : `${reportCount} water hazard ${reportCount === 1 ? "report" : "reports"} on route`;
  const full = [
    "Monsoon caution",
    risk.warningMessage,
    delay ? `(${delay})` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="map-flood-warning-banner"
      role="alert"
      title={full}
      aria-label={full}
    >
      <Icon name="warning" size={15} />
      <span className="map-flood-warning-copy">
        <strong>Monsoon caution{delay ? ` · ${delay}` : ""}</strong>
        <span className="map-flood-warning-detail">{detail}</span>
      </span>
    </div>
  );
}
