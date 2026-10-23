import { haversineKilometers } from "./intelligence.ts";
import { isPrepaid, type PaymentMethod } from "./payment-methods.ts";

/** Placeholder rates in MMK until the business sets real ones. */
export const FEE_RULES = {
  base: 1500,
  perKm: 400,
  /** Distance covered by the base fee. */
  includedKm: 2,
  perKgOver: 300,
  includedKg: 3,
  urgent: 1500,
  /** Cash handling and the rider's return trip to settle. */
  codHandling: 500,
  /** Roads are longer than a straight line between two points. */
  roadFactor: 1.3,
  roundTo: 100,
  /**
   * Zone banding. Every leg of a trip belongs to the pickup zone and the
   * delivery zone at once; the two bases are blended by how much of the drive
   * is spent in each, so a hop inside an outer township is charged like an
   * outer trip and crossing the city is charged for both ends.
   */
  zone: {
    /** Share of the drive spent in the delivery zone, 0-1. */
    arrivedShare: 0.34,
    /** Weight of a zone's own base when the trip is made entirely inside it. */
    travelShare: 0.45,
    /** The township a pin is read in has a base a little more certain. */
    knownTownshipBonus: 0.12,
  },
} as const;

/** No base fee goes above this, wherever the parcel starts or ends. */
export const MAX_BASE_FEE = 6000;

/** Delivery fee ceiling across all standard distances and zone combinations. */
export const MAX_DELIVERY_FEE = 6500;

type CityBase = {
  city: string;
  match: RegExp;
  base: number;
  /** Rough centre of the township or city, for pins made from its name. */
  point: { latitude: number; longitude: number };
  /**
   * How far the township reaches from its centre, in km, and how fast its base
   * fee grows out to that edge. A pin is priced by where it actually falls, so
   * a township name typed by hand and a pin dropped on the map agree.
   */
  radiusKm: number;
  /** Fee at the edge of the radius; the centre pays `base`. */
  edgeBase?: number;
  /** Townships that are neither downtown nor outer: the ordinary city ring. */
  ring?: boolean;
};

/**
 * Base fee by where the parcel is picked up, in MMK. Shwe Pyi Thar and Bahan
 * are set by the business; the rest are placeholders that grow with distance
 * from downtown Yangon and never pass MAX_BASE_FEE. The points and radii
 * follow the township boundaries on the map, so a pin in the north of a
 * township is charged differently from one on its southern edge. More
 * specific names come before the shorter names they contain.
 */
export const CITY_BASE_FEES: readonly CityBase[] = [
  {
    // Downtown Yangon: the cheapest trips start and end in no single
    // township, so it takes a row of its own. Its base matches FEE_RULES.base.
    city: "Downtown Yangon",
    match:
      /\b(downtown|kyauktada|pabedan|lanmadaw|latha|botataung|pazundaung|sule|bogyoke|maharbandoola|strand)\b/i,
    base: 1500,
    point: { latitude: 16.775, longitude: 96.155 },
    radiusKm: 3.5,
    edgeBase: 2200,
  },
  {
    city: "Shwe Pyi Thar",
    match: /shwe\s*pyi\s*thar/i,
    base: 4500,
    point: { latitude: 16.96, longitude: 96.09 },
    radiusKm: 6,
    edgeBase: 5500,
  },
  {
    city: "Hlaing Thar Yar",
    match: /hlaing\s*thar\s*yar/i,
    base: 4000,
    point: { latitude: 16.885, longitude: 96.045 },
    radiusKm: 5.5,
    edgeBase: 5000,
  },
  {
    city: "Dagon Seikkan",
    match: /dagon\s*seik+an/i,
    base: 4000,
    point: { latitude: 16.88, longitude: 96.29 },
    radiusKm: 5,
    edgeBase: 4800,
  },
  {
    city: "East Dagon",
    match: /east\s*dagon/i,
    base: 3500,
    point: { latitude: 16.86, longitude: 96.25 },
    radiusKm: 5.5,
    edgeBase: 4400,
    ring: true,
  },
  {
    city: "North Dagon",
    match: /north\s*dagon/i,
    base: 3000,
    point: { latitude: 16.88, longitude: 96.19 },
    radiusKm: 4.5,
    edgeBase: 3800,
    ring: true,
  },
  {
    city: "South Dagon",
    match: /south\s*dagon/i,
    base: 3500,
    point: { latitude: 16.83, longitude: 96.23 },
    radiusKm: 5,
    edgeBase: 4300,
  },
  {
    city: "North Okkalapa",
    match: /north\s*okkalapa/i,
    base: 3000,
    point: { latitude: 16.9, longitude: 96.17 },
    radiusKm: 4.5,
    edgeBase: 3700,
    ring: true,
  },
  {
    city: "South Okkalapa",
    match: /south\s*okkalapa/i,
    base: 2500,
    point: { latitude: 16.84, longitude: 96.19 },
    radiusKm: 3.5,
    edgeBase: 3000,
    ring: true,
  },
  {
    // The business's own township: Bahan is central but sits in the ring.
    city: "Bahan",
    match: /bahan/i,
    base: 2500,
    point: { latitude: 16.805, longitude: 96.155 },
    radiusKm: 3,
    edgeBase: 3000,
    ring: true,
  },
  {
    city: "Mingaladon",
    match: /mingala\s*don/i,
    base: 3500,
    point: { latitude: 16.93, longitude: 96.14 },
    radiusKm: 6,
    edgeBase: 4400,
    ring: true,
  },
  {
    city: "Insein",
    match: /insein/i,
    base: 2500,
    point: { latitude: 16.89, longitude: 96.1 },
    radiusKm: 4,
    edgeBase: 3100,
    ring: true,
  },
  {
    city: "Mayangone",
    match: /mayangon[e]?/i,
    base: 2500,
    point: { latitude: 16.87, longitude: 96.13 },
    radiusKm: 3.5,
    edgeBase: 3000,
    ring: true,
  },
  {
    city: "Thingangyun",
    match: /thingan+gyun/i,
    base: 2500,
    point: { latitude: 16.82, longitude: 96.2 },
    radiusKm: 3.5,
    edgeBase: 3000,
    ring: true,
  },
  {
    city: "Thaketa",
    match: /thaketa/i,
    base: 2500,
    point: { latitude: 16.8, longitude: 96.2 },
    radiusKm: 3.5,
    edgeBase: 3000,
    ring: true,
  },
  {
    city: "Yankin",
    match: /yankin/i,
    base: 2000,
    point: { latitude: 16.83, longitude: 96.16 },
    radiusKm: 2.5,
    edgeBase: 2400,
    ring: true,
  },
  {
    city: "Dawbon",
    match: /dawbon/i,
    base: 2000,
    point: { latitude: 16.78, longitude: 96.19 },
    radiusKm: 3,
    edgeBase: 2500,
    ring: true,
  },
  {
    city: "Hlaing",
    match: /hlaing/i,
    base: 2000,
    point: { latitude: 16.85, longitude: 96.12 },
    radiusKm: 3,
    edgeBase: 2500,
    ring: true,
  },
  {
    city: "Kamayut",
    match: /kamayut/i,
    base: 2000,
    point: { latitude: 16.82, longitude: 96.13 },
    radiusKm: 2.5,
    edgeBase: 2400,
    ring: true,
  },
  {
    city: "Tamwe",
    match: /tamwe/i,
    base: 2000,
    point: { latitude: 16.8, longitude: 96.17 },
    radiusKm: 2.5,
    edgeBase: 2400,
    ring: true,
  },
  {
    city: "Thanlyin",
    match: /thanlyin|syriam/i,
    base: 4500,
    point: { latitude: 16.77, longitude: 96.25 },
    radiusKm: 6,
    edgeBase: 5500,
  },
  {
    city: "Hmawbi",
    match: /hmawbi/i,
    base: 5000,
    point: { latitude: 17.1, longitude: 96.05 },
    radiusKm: 8,
    edgeBase: 6000,
  },
  {
    city: "Htantabin",
    match: /htantabin/i,
    base: 5000,
    point: { latitude: 17.02, longitude: 96.08 },
    radiusKm: 8,
    edgeBase: 6000,
  },
  {
    city: "Kyauktan",
    match: /kyauktan/i,
    base: 5500,
    point: { latitude: 16.64, longitude: 96.3 },
    radiusKm: 8,
    edgeBase: 6000,
  },
  {
    city: "Mandalay",
    match: /mandalay/i,
    base: 3500,
    point: { latitude: 21.975, longitude: 96.083 },
    radiusKm: 10,
    edgeBase: 4500,
  },
  {
    city: "Nay Pyi Taw",
    match: /nay\s*pyi\s*taw|naypyi?daw/i,
    base: 5000,
    point: { latitude: 19.745, longitude: 96.129 },
    radiusKm: 12,
    edgeBase: 6000,
  },
  {
    city: "Bago",
    match: /\bbago\b|pegu/i,
    base: 5000,
    point: { latitude: 17.335, longitude: 96.481 },
    radiusKm: 10,
    edgeBase: 6000,
  },
];

/** Downtown Yangon: the cheapest trips start and end here. */
export const DOWNTOWN_CENTER = { latitude: 16.775, longitude: 96.155 } as const;

/** How far downtown reaches, in km. Pins inside pay the ordinary base fee. */
export const DOWNTOWN_RADIUS_KM = 3.5;

/**
 * Where a pin sits in the fee map. `zone` is the township or city it falls
 * in, or "Downtown Yangon" for the middle of the city, which is in no single
 * township's table row.
 */
export type FeeZone = {
  zone: string | null;
  lat: number;
  lng: number;
  /** True when the name came from the pin or the address, not a guess. */
  known: boolean;
  base: number;
};

export type FeePoint = { latitude: number; longitude: number };

export type ZoneInput = {
  point?: FeePoint | null;
  address?: string | null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The fee a township charges at a pin: its centre rate out to its edge. */
function baseInside(entry: CityBase, km: number) {
  const edge = entry.edgeBase ?? entry.base;
  const share = entry.radiusKm > 0 ? clamp(km / entry.radiusKm, 0, 1) : 1;
  return Math.round(edge * share + entry.base * (1 - share));
}

/** Distance in km from a township centre to a pin, and the fee it draws. */
function readingFor(entry: CityBase, point: FeePoint) {
  const km = haversineKilometers(
    { latitude: entry.point.latitude, longitude: entry.point.longitude },
    point,
  );
  return { entry, km, base: baseInside(entry, km) };
}

/**
 * How well a township's reach fits a pin: 1 at its centre, 0 at its edge or
 * beyond. Counted in kilometres across the ground, not in degrees, so a wide
 * township's radius is not overstated east to west the way raw degrees would.
 */
function fitInside(entry: CityBase, point: FeePoint) {
  return clamp(1 - readingFor(entry, point).km / entry.radiusKm, 0, 1);
}

/**
 * The townships whose boundary a pin falls inside, the tightest fit first.
 * Real boundaries overlap — a pin in Bahan is also within reach of Tamwe and
 * Yankin, and central Shwe Pyi Thar sits inside rural Htantabin's wide circle
 * — so the township that holds the pin most firmly is the one it belongs to.
 * Fit is measured as the share of the radius, which stops a big rural township
 * from swallowing the small urban one inside it.
 */
function townshipsAt(point: FeePoint) {
  return CITY_BASE_FEES.map((entry) => ({
    entry,
    fit: fitInside(entry, point),
  }))
    .filter((reading) => reading.fit > 0)
    .sort((a, b) => {
      if (b.fit !== a.fit) return b.fit - a.fit;
      // A pin equally inside two townships goes to the dearer one.
      return baseInside(b.entry, 0) - baseInside(a.entry, 0);
    })
    .map((reading) => reading.entry);
}

/**
 * The township the address names, whether or not the pin is inside it. An
 * address the customer typed or picked is the strongest evidence of where the
 * parcel is, so it wins over a wider neighbouring zone that merely contains
 * the pin.
 */
function namedTownship(address?: string | null) {
  return (
    CITY_BASE_FEES.find((entry) => entry.match.test(address ?? "")) ?? null
  );
}

/**
 * The fee zone for one end of a trip. The pin says where the end is; an
 * address that names a township settles which one it belongs to, which matters
 * because the drawn boundaries overlap. A pin in no township falls back to the
 * named township, then to the nearest one.
 */
export function zoneFor(input: ZoneInput): FeeZone {
  const point = input.point ?? null;

  if (point) {
    const inside = townshipsAt(point);
    const named = namedTownship(input.address);
    // The address decides between overlapping townships; without one the
    // tightest fit does. Either way the pin sets the rate within that township.
    const pick = named ?? inside[0] ?? null;
    if (pick)
      return {
        zone: pick.city,
        lat: point.latitude,
        lng: point.longitude,
        // A pin beyond the chosen township's own reach is only a guess.
        known: fitInside(pick, point) > 0,
        base: readingFor(pick, point).base,
      };
    const nearest = CITY_BASE_FEES.map((entry) =>
      readingFor(entry, point),
    ).reduce((best, reading) => (reading.km < best.km ? reading : best));
    return {
      zone: nearest.entry.city,
      lat: point.latitude,
      lng: point.longitude,
      // A pin in no township is read from the nearest one, not settled.
      known: false,
      base: nearest.base,
    };
  }

  const named = namedTownship(input.address);
  if (named)
    return {
      zone: named.city,
      lat: named.point.latitude,
      lng: named.point.longitude,
      known: true,
      base: Math.min(MAX_BASE_FEE, named.base),
    };

  return {
    zone: null,
    lat: DOWNTOWN_CENTER.latitude,
    lng: DOWNTOWN_CENTER.longitude,
    known: false,
    base: FEE_RULES.base,
  };
}

/** Great-circle km between two zone readings. */
const zoneKm = (a: FeeZone, b: FeeZone) =>
  haversineKilometers(
    { latitude: a.lat, longitude: a.lng },
    { latitude: b.lat, longitude: b.lng },
  );

/** One end of the trip, ready to show: the base it pays and its share of it. */
export type ZoneLeg = {
  side: "pickup" | "delivery";
  zone: string | null;
  base: number;
  /** The base the other end also charges, split off so the total is not doubled. */
  shared: number;
  /** This end's own share of the trip's base fee. */
  charged: number;
};

export type ZoneTrip = {
  /** The pickup zone's base fee, kept for callers that price one end only. */
  base: number;
  pickup: ZoneLeg;
  delivery: ZoneLeg;
  /** The base fee line for the whole trip. */
  total: number;
  label: string;
  /** True when the trip never leaves one township. */
  local: boolean;
};

/**
 * The trip's base fee from both ends. Each end is charged by where it is, but
 * the part of the drive the two ends have in common is paid once, so a trip
 * inside one township is billed that township once rather than at both ends.
 */
export function zoneTrip(
  pickupInput: ZoneInput,
  deliveryInput: ZoneInput,
  insideKm = 0,
): ZoneTrip {
  const pickup = zoneFor(pickupInput);
  const delivery = zoneFor(deliveryInput);
  // Nothing is known about where the trip runs — a staff order priced from a
  // typed distance alone. There is no zone to band, so the plain base fee is
  // charged unchanged.
  if (!pickup.zone && !delivery.zone) {
    const flat = FEE_RULES.base;
    const leg = (side: "pickup" | "delivery"): ZoneLeg => ({
      side,
      zone: null,
      base: flat,
      shared: 0,
      charged: flat,
    });
    return {
      base: flat,
      pickup: leg("pickup"),
      delivery: leg("delivery"),
      total: flat,
      label: "Base fee",
      local: false,
    };
  }
  // A one-ended estimate (for example, a staff quote with only the pickup
  // township) charges that known zone once. The unknown end must not quietly
  // add a discounted downtown fee.
  if (!pickup.zone || !delivery.zone) {
    const known = pickup.zone ? pickup : delivery;
    const leg = (side: "pickup" | "delivery", zone: FeeZone): ZoneLeg => ({
      side,
      zone: zone.zone,
      base: zone.zone ? zone.base : 0,
      shared: 0,
      charged: zone.zone ? zone.base : 0,
    });
    return {
      base: pickup.zone ? pickup.base : 0,
      pickup: leg("pickup", pickup),
      delivery: leg("delivery", delivery),
      total: known.base,
      label: "Base fee",
      local: false,
    };
  }
  const sameZone = Boolean(pickup.zone && pickup.zone === delivery.zone);
  const spanKm = Math.max(0.001, zoneKm(pickup, delivery));
  // Two ends in one township share the whole drive; otherwise the caller's
  // road-overlap measurement says how much of it lies inside both townships.
  const inside = sameZone ? spanKm : Math.max(0, Math.min(insideKm, spanKm));
  const overlap = clamp(inside / spanKm, 0, 1);
  const zone = FEE_RULES.zone;
  // Each end keeps the weight of the drive it is responsible for. The pickup
  // end owns the start and the delivery end owns the arrival; the part of the
  // drive inside both townships is handed back to the delivery end, whose
  // streets it also runs through.
  const weights = {
    pickup: 1 - overlap * (1 - zone.arrivedShare),
    delivery: zone.travelShare + overlap * (1 - zone.travelShare),
  };
  // A trip that stays in one township is read from that township, not guessed.
  const certain = (zone: FeeZone) => zone.known || sameZone;
  const own = (zone: FeeZone, weight: number) =>
    zone.base *
    weight *
    (certain(zone) ? 1 : 1 - FEE_RULES.zone.knownTownshipBonus);

  const pickupOwn = own(pickup, weights.pickup);
  const deliveryOwn = own(delivery, weights.delivery);
  // The stretch of road both townships cover is billed once. It can never be
  // more than either end's whole fee, and on a cross-city trip it is nothing.
  const shared = Math.min(pickupOwn, deliveryOwn) * overlap;
  // Only the sum is capped. Rounding the shares first would make them add up
  // to more than the cap, and a share of its own never passes the cap anyway.
  const exact = pickupOwn + deliveryOwn - shared;
  const billed = Math.min(MAX_BASE_FEE, exact);
  // Each end keeps its slice of the cap, so the shares still add up to it.
  const share = exact > 0 ? billed / exact : 1;
  const round = (value: number) => Math.ceil((value * share) / 100) * 100;

  const pickupCharged = round(pickupOwn - shared);
  const deliveryCharged = round(deliveryOwn - shared);
  const sharedCost = round(shared);
  const label =
    pickup.zone && delivery.zone
      ? sameZone
        ? `${pickup.zone} zone, both ends`
        : `${pickup.zone} to ${delivery.zone} zones`
      : "Base fee";

  return {
    base: round(pickupOwn),
    pickup: {
      side: "pickup",
      zone: pickup.zone,
      base: round(pickupOwn),
      shared: sharedCost,
      charged: pickupCharged,
    },
    delivery: {
      side: "delivery",
      zone: delivery.zone,
      base: round(deliveryOwn),
      shared: sharedCost,
      charged: deliveryCharged,
    },
    total: pickupCharged + deliveryCharged + sharedCost,
    label,
    local: sameZone,
  };
}

/** The base fee and the zone it came from, for an address or a pin. */
export function baseFeeFor(
  address: string | null | undefined,
  fallback = FEE_RULES.base,
  point?: FeePoint | null,
) {
  const zone = zoneFor({ point, address });
  if (zone.known) return { base: zone.base, city: zone.zone };
  return {
    base: Math.min(fallback, MAX_BASE_FEE),
    city: null as string | null,
  };
}

export type FeeLine = {
  id: "base" | "distance" | "weight" | "urgent" | "cod" | "discount";
  label: string;
  amount: number;
};

export type FeeEstimate = {
  lines: FeeLine[];
  total: number;
  distanceKm: number;
  /** The zones the price came from, so screens can name them. */
  zones?: ZoneTrip;
};

const roundUp = (value: number, step: number) => Math.ceil(value / step) * step;

export const PARCEL_WEIGHT_KG = { Small: 1, Medium: 4, Large: 10 } as const;

/** Estimated road distance from two points, or null if either is missing. */
export function roadDistanceKm(
  from: { latitude: number; longitude: number } | null | undefined,
  to: { latitude: number; longitude: number } | null | undefined,
) {
  if (!from || !to) return null;
  return haversineKilometers(from, to) * FEE_RULES.roadFactor;
}

export function estimateDeliveryFee(
  input: {
    distanceKm: number;
    weightKg?: number;
    method: PaymentMethod;
    urgent?: boolean;
    /** Pickup address or township; picks the pickup zone's base fee. */
    pickupAddress?: string | null;
    /** Delivery address, when the trip is priced from both ends. */
    deliveryAddress?: string | null;
    /** Pins for the two ends; they beat the text when both are known. */
    pickupPoint?: FeePoint | null;
    deliveryPoint?: FeePoint | null;
    /** Road km shared by both townships, so an in-town trip is not billed twice. */
    insideKm?: number;
    /** Overrides whether cash handling is charged; defaults to cash methods. */
    cashHandling?: boolean;
  },
  rules = FEE_RULES,
): FeeEstimate {
  const distanceKm = Math.max(0, input.distanceKm);
  const weightKg = Math.max(0, input.weightKg ?? 0);
  // Both ends set the base fee. With only a pickup address the delivery end
  // contributes nothing, which is how staff price a manual order.
  const zones = zoneTrip(
    { point: input.pickupPoint, address: input.pickupAddress },
    input.deliveryAddress || input.deliveryPoint
      ? { point: input.deliveryPoint, address: input.deliveryAddress }
      : { address: null },
    input.insideKm ?? 0,
  );
  const lines: FeeLine[] = [];
  let currentTotal = 0;
  const addLine = (id: FeeLine["id"], label: string, rawAmount: number) => {
    if (currentTotal >= MAX_DELIVERY_FEE || rawAmount <= 0) return;
    const amount = Math.min(rawAmount, MAX_DELIVERY_FEE - currentTotal);
    if (amount > 0) {
      lines.push({ id, label, amount });
      currentTotal += amount;
    }
  };

  addLine(
    "base",
    zones.label === "Base fee" ? "Base fee" : `Base fee · ${zones.label}`,
    zones.total,
  );

  const extraKm = Math.max(0, distanceKm - rules.includedKm);
  if (extraKm > 0)
    addLine(
      "distance",
      "Distance",
      roundUp(extraKm * rules.perKm, rules.roundTo),
    );
  const extraKg = Math.max(0, weightKg - rules.includedKg);
  if (extraKg > 0)
    addLine(
      "weight",
      "Weight",
      Math.ceil(extraKg) * rules.perKgOver,
    );
  if (input.urgent)
    addLine("urgent", "Urgent", rules.urgent);
  if (input.cashHandling ?? !isPrepaid(input.method))
    addLine("cod", "Cash handling", rules.codHandling);

  return {
    lines,
    total: currentTotal,
    distanceKm,
    zones,
  };
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Cities and townships whose names start with what was typed, ignoring spaces,
 * case and spelling gaps ("shwepyi" finds Shwe Pyi Thar). Used for suggestions
 * that work without a map service, and that carry a pin and a known base fee.
 */
export function matchCities(query: string, limit = 3) {
  const typed = squash(query);
  if (typed.length < 3) return [];
  return CITY_BASE_FEES.filter(
    (entry) => squash(entry.city).startsWith(typed) || entry.match.test(query),
  ).slice(0, limit);
}
