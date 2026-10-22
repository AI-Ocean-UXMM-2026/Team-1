import type { ReactNode } from "react";
import type { DeliveryOutcomeResult } from "@/lib/delivery/actions";
import type { DriverRoute } from "@/lib/delivery/driver-route";
import { EXCEPTION_OPTIONS } from "@/lib/delivery/driver-route";
import {
  PREVIEW_SCENARIOS,
  type PreviewScenario,
  type PreviewState,
  previewAddStop,
  previewReorder,
  previewState,
} from "@/lib/delivery/rider-preview";
import { hasParcelOnBoard } from "@/lib/delivery/rider-route";

export function RiderPreviewBar({
  preview,
  setPreview,
  setPreviewData,
  previewOffline,
  setPreviewOffline,
  previewGpsDenied,
  setPreviewGpsDenied,
  loseNextResponse,
  setLoseNextResponse,
  setAcknowledged,
  previewRequests,
  route,
}: {
  preview: PreviewScenario | null;
  setPreview: (val: PreviewScenario) => void;
  setPreviewData: React.Dispatch<React.SetStateAction<PreviewState | null>>;
  previewOffline: boolean;
  setPreviewOffline: (val: boolean) => void;
  previewGpsDenied: boolean;
  setPreviewGpsDenied: (val: boolean) => void;
  loseNextResponse: boolean;
  setLoseNextResponse: (val: boolean) => void;
  setAcknowledged: (val: null) => void;
  previewRequests: React.MutableRefObject<Map<string, DeliveryOutcomeResult>>;
  route: DriverRoute;
}): ReactNode {
  return (
    <details className="dv-preview-bar">
      <summary>Preview controls</summary>
      <div>
        <label>
          Scenario
          <select
            value={preview ?? ""}
            onChange={(event) => {
              const next = event.target.value as PreviewScenario;
              const url = new URL(window.location.href);
              url.searchParams.set("preview", next);
              window.history.replaceState(null, "", url);
              previewRequests.current.clear();
              setPreview(next);
              setPreviewData(previewState(next, Date.now()));
              setAcknowledged(null);
            }}
          >
            {PREVIEW_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() =>
            setPreviewData((previous) =>
              previous
                ? {
                    ...previous,
                    data: previewAddStop(previous.data, Date.now()),
                  }
                : previous,
            )
          }
        >
          Dispatcher adds a stop
        </button>
        <button
          type="button"
          onClick={() =>
            setPreviewData((previous) =>
              previous
                ? { ...previous, data: previewReorder(previous.data) }
                : previous,
            )
          }
        >
          Dispatcher reorders
        </button>
        <label>
          <input
            type="checkbox"
            checked={previewOffline}
            onChange={(event) => setPreviewOffline(event.target.checked)}
          />{" "}
          Offline
        </label>
        <label>
          <input
            type="checkbox"
            checked={previewGpsDenied}
            onChange={(event) => setPreviewGpsDenied(event.target.checked)}
          />{" "}
          Location denied
        </label>
        <label>
          <input
            type="checkbox"
            checked={loseNextResponse}
            onChange={(event) => setLoseNextResponse(event.target.checked)}
          />{" "}
          Lose next save’s response
        </label>
        <small>
          {EXCEPTION_OPTIONS.length} exception reasons ·{" "}
          {
            route.parcels.filter((order) => hasParcelOnBoard(order.status))
              .length
          }{" "}
          on truck
        </small>
      </div>
    </details>
  );
}
