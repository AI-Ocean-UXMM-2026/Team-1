/**
 * Open-Meteo live weather & hydrological flood integration.
 *
 * Uses 100% open-data APIs (EU Copernicus GloFAS and open meteorological data)
 * without requiring any API keys or paid subscriptions.
 */

export type LiveFloodSeverity =
  | "clear"
  | "light_rain"
  | "heavy_rain"
  | "flood_risk";

export type LiveFloodConditions = {
  source: "open_meteo";
  fetchedAt: string;
  latitude: number;
  longitude: number;
  precipitationMm: number;
  rainMm: number;
  weatherCode: number;
  riverDischargeM3s: number | null;
  severity: LiveFloodSeverity;
  suggestedSlowdown: number;
};

export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood";

/**
 * Maps precipitation and river discharge rates to an operational flood severity
 * and a recommended travel-time slowdown penalty factor (0.0 to 0.60).
 */
export function determineFloodSeverity(
  precipitationMm: number,
  riverDischargeM3s: number | null,
): { severity: LiveFloodSeverity; suggestedSlowdown: number } {
  // Yangon monsoon conditions: high rainfall or swollen river discharge
  if (
    precipitationMm >= 25 ||
    (riverDischargeM3s != null && riverDischargeM3s >= 50)
  ) {
    return { severity: "flood_risk", suggestedSlowdown: 0.6 };
  }
  if (precipitationMm >= 10) {
    return { severity: "heavy_rain", suggestedSlowdown: 0.35 };
  }
  if (precipitationMm >= 1.5) {
    return { severity: "light_rain", suggestedSlowdown: 0.15 };
  }
  return { severity: "clear", suggestedSlowdown: 0.0 };
}

/**
 * Fetches real-time open weather and river discharge for a coordinate pair
 * from Open-Meteo. Fails gracefully to null if network or timeout occurs.
 */
export async function fetchLiveFloodConditions(
  coords: { lat: number; lng: number },
  options: {
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
  } = {},
): Promise<LiveFloodConditions | null> {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 3000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const forecastUrl = `${OPEN_METEO_FORECAST_URL}?latitude=${coords.lat}&longitude=${coords.lng}&current=precipitation,rain,weather_code`;
  const floodUrl = `${OPEN_METEO_FLOOD_URL}?latitude=${coords.lat}&longitude=${coords.lng}&daily=river_discharge`;

  try {
    const [forecastRes, floodRes] = await Promise.allSettled([
      fetchFn(forecastUrl, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }),
      fetchFn(floodUrl, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }),
    ]);

    clearTimeout(timer);

    let precipitationMm = 0;
    let rainMm = 0;
    let weatherCode = 0;
    let riverDischargeM3s: number | null = null;
    let hasData = false;

    if (forecastRes.status === "fulfilled" && forecastRes.value.ok) {
      try {
        const json = (await forecastRes.value.json()) as {
          current?: {
            precipitation?: number;
            rain?: number;
            weather_code?: number;
          };
        };
        precipitationMm = Number(json.current?.precipitation ?? 0);
        rainMm = Number(json.current?.rain ?? 0);
        weatherCode = Number(json.current?.weather_code ?? 0);
        hasData = true;
      } catch {}
    }

    if (floodRes.status === "fulfilled" && floodRes.value.ok) {
      try {
        const json = (await floodRes.value.json()) as {
          daily?: { river_discharge?: (number | null)[] };
        };
        const discharge = json.daily?.river_discharge?.[0];
        if (discharge != null && Number.isFinite(discharge)) {
          riverDischargeM3s = Number(discharge);
          hasData = true;
        }
      } catch {}
    }

    if (!hasData) return null;

    const { severity, suggestedSlowdown } = determineFloodSeverity(
      precipitationMm,
      riverDischargeM3s,
    );

    return {
      source: "open_meteo",
      fetchedAt: new Date().toISOString(),
      latitude: coords.lat,
      longitude: coords.lng,
      precipitationMm,
      rainMm,
      weatherCode,
      riverDischargeM3s,
      severity,
      suggestedSlowdown,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}
