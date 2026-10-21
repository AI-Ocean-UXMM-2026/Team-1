import type { RouteCard } from "@/lib/delivery/dispatch/client";

const DASH = ["", "7 4", "2 4", "10 3 2 3"];

/**
 * A schematic of the plan: depot, then each truck's stops joined by straight
 * lines in visit order. It is not a map (no roads, not to scale) and says so.
 * Each truck has its own line pattern and letter, so colour is never the only cue.
 */
export function RoutesSketch({
  depot,
  cards,
  selected,
  onSelect,
}: {
  depot: { latitude: number; longitude: number };
  cards: RouteCard[];
  selected: string | null;
  onSelect: (vehicleId: string) => void;
}) {
  const W = 320;
  const H = 240;
  const pad = 22;
  const all = [
    { lat: depot.latitude, lng: depot.longitude },
    ...cards.flatMap((c) =>
      c.stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
    ),
  ];
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // Equal scale on both axes so distances are not stretched.
  const kmPerLat = 111;
  const kmPerLng = 111 * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * kmPerLng, 0.2);
  const spanY = Math.max((maxLat - minLat) * kmPerLat, 0.2);
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;
  const x = (lng: number) => ox + (lng - minLng) * kmPerLng * scale;
  const y = (lat: number) => H - oy - (lat - minLat) * kmPerLat * scale;
  const home = { x: x(depot.longitude), y: y(depot.latitude) };

  return (
    <figure className="dispatch-sketch">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Schematic of ${cards.length} truck routes from the depot. Straight lines between stops, not roads.`}
      >
        {cards.map((card, index) => {
          const points = [
            home,
            ...card.stops.map((s) => ({ x: x(s.longitude), y: y(s.latitude) })),
            home,
          ];
          const active = selected == null || selected === card.vehicleId;
          return (
            <g
              key={card.vehicleId}
              className={`dispatch-route-line route-${index % 4}`}
              opacity={active ? 1 : 0.25}
            >
              <polyline
                points={points
                  .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                  .join(" ")}
                fill="none"
                strokeWidth={active && selected ? 3 : 2}
                strokeDasharray={DASH[index % 4]}
                strokeLinejoin="round"
              />
              {card.stops.map((stop) => (
                <circle
                  key={`${stop.order_id}-${stop.stop_type}`}
                  cx={x(stop.longitude)}
                  cy={y(stop.latitude)}
                  r={stop.stop_type === "pickup" ? 4 : 3.2}
                  className={
                    stop.stop_type === "pickup"
                      ? "stop-pickup"
                      : "stop-delivery"
                  }
                />
              ))}
              {(() => {
                const last = card.stops.at(-1);
                return last ? (
                  <text
                    x={x(last.longitude) + 6}
                    y={y(last.latitude) - 6}
                    className="route-letter"
                  >
                    {card.letter}
                  </text>
                ) : null;
              })()}
            </g>
          );
        })}
        <g className="depot-mark">
          <rect x={home.x - 6} y={home.y - 6} width={12} height={12} rx={2} />
          <text x={home.x + 9} y={home.y + 4}>
            Depot
          </text>
        </g>
      </svg>
      <figcaption>
        Schematic, not a map: straight lines in visit order, not to road scale.
        Filled circles are pickups; small circles are deliveries.
      </figcaption>
      <fieldset
        className="dispatch-legend"
        style={{ border: 0, margin: 0, minInlineSize: 0, padding: 0 }}
      >
        <legend className="sr-only">Choose a truck to highlight</legend>
        {cards.map((card, index) => (
          <button
            key={card.vehicleId}
            type="button"
            className={`dispatch-legend-item route-${index % 4}`}
            aria-pressed={selected === card.vehicleId}
            onClick={() => onSelect(card.vehicleId)}
          >
            <svg width="28" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="28"
                y2="4"
                strokeWidth="2.5"
                strokeDasharray={DASH[index % 4]}
              />
            </svg>
            {card.letter} · {card.label}
          </button>
        ))}
      </fieldset>
    </figure>
  );
}
