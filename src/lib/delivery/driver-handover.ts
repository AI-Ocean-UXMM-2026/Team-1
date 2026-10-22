import type { DeliveryStop } from "@/lib/delivery/driver-route";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { isPrepaid, orderPaymentMethod } from "./payment-methods.ts";

/** Cash the rider collects at the door; prepaid orders owe none. */
export function codDue(order: DeliveryOrder) {
  if (isPrepaid(orderPaymentMethod(order))) return 0;
  return order.cod_amount > 0 && order.cod_status === "pending"
    ? order.cod_amount
    : 0;
}

export type CodMode = "full" | "different";

export type HandoverDraft = {
  /** Parcel ids the driver checked against the manifest. */
  verified: string[];
  receivedBy: string;
  /** Photo of the parcel at the door, a downscaled JPEG data URL kept on the phone. */
  photo?: string;
  codMode: CodMode | null;
  codAmount: string;
  codReason: string;
  note: string;
  /** One request id per parcel, kept across retries so a resend is not a second delivery. */
  requestIds: Record<string, string>;
  /** Pickup stops: the weight read on the scale per parcel id, in kg, as typed. */
  weights?: Record<string, string>;
};

export const EMPTY_HANDOVER: HandoverDraft = {
  verified: [],
  receivedBy: "",
  codMode: null,
  codAmount: "",
  codReason: "",
  note: "",
  requestIds: {},
};

export type Requirement = { key: string; label: string; met: boolean };

export function handoverRequirements(
  stop: DeliveryStop,
  draft: HandoverDraft,
): Requirement[] {
  const requirements: Requirement[] = [
    {
      key: "parcels",
      label:
        stop.open.length > 1
          ? `Check all ${stop.open.length} parcels`
          : "Check the parcel",
      met: stop.open.every((order) => draft.verified.includes(order.id)),
    },
    {
      key: "recipient",
      label: "Record who received it",
      met: draft.receivedBy.trim().length > 0,
    },
    {
      key: "photo",
      label: "Take a photo of the parcel",
      met: !!draft.photo,
    },
  ];
  if (stop.codDue > 0) {
    const amount = Number(draft.codAmount);
    requirements.push({
      key: "cod",
      label: "Record the cash received",
      met:
        draft.codMode === "full" ||
        (draft.codMode === "different" &&
          draft.codAmount.trim() !== "" &&
          Number.isFinite(amount) &&
          amount >= 0 &&
          draft.codReason.trim().length >= 3),
    });
  }
  return requirements;
}

/** What must be done before a door pickup can be recorded as collected. */
export function pickupRequirements(
  stop: DeliveryStop,
  draft: HandoverDraft,
): Requirement[] {
  const weights = draft.weights ?? {};
  const badWeight = stop.collect.some((order) => {
    const typed = (weights[order.id] ?? "").trim();
    if (typed === "") return false;
    const value = Number(typed);
    return !Number.isFinite(value) || value <= 0 || value > 100000;
  });
  return [
    {
      key: "parcels",
      label:
        stop.collect.length > 1
          ? `Check all ${stop.collect.length} parcels`
          : "Check the parcel",
      met: stop.collect.every((order) => draft.verified.includes(order.id)),
    },
    {
      key: "weight",
      label: "Enter a weight above 0 kg, or leave it empty",
      met: !badWeight,
    },
  ];
}

export type PickupReasonOption = {
  id:
    | "customer_unavailable"
    | "parcel_not_ready"
    | "wrong_parcel"
    | "refused"
    | "oversize"
    | "other";
  label: string;
  detail: string;
};

export const PICKUP_REASONS: PickupReasonOption[] = [
  {
    id: "customer_unavailable",
    label: "Nobody there",
    detail: "No one to hand the parcel over",
  },
  {
    id: "parcel_not_ready",
    label: "Parcel not ready",
    detail: "Not packed or not available yet",
  },
  {
    id: "wrong_parcel",
    label: "Wrong parcel",
    detail: "Doesn’t match the order",
  },
  {
    id: "refused",
    label: "Customer cancelled",
    detail: "Doesn’t want it collected",
  },
  {
    id: "oversize",
    label: "Too big or heavy",
    detail: "Won’t fit or can’t be lifted safely",
  },
  {
    id: "other",
    label: "Something else",
    detail: "Describe it for operations",
  },
];

/**
 * Splits the cash received at a stop across its COD parcels in route order.
 * Each parcel gets up to its own amount; any shortfall lands on the later ones.
 */
export function allocateCod(parcels: DeliveryOrder[], received: number) {
  let left = Math.max(0, received);
  const result = new Map<string, number>();
  const due = parcels.filter((order) => codDue(order) > 0);
  due.forEach((order, index) => {
    const share =
      index === due.length - 1 ? left : Math.min(left, order.cod_amount);
    result.set(order.id, share);
    left -= share;
  });
  return result;
}

/* ------------------------------------------------------------ exceptions */

export type ExceptionReason =
  | "recipient_unavailable"
  | "recipient_unreachable"
  | "incorrect_address"
  | "cannot_access"
  | "recipient_refused"
  | "cod_not_paid"
  | "parcel_damaged"
  | "parcel_missing"
  | "other";

export type NextAction = "retry_later" | "reschedule" | "return_to_depot";

export type ExceptionOption = {
  id: ExceptionReason;
  label: string;
  detail: string;
  /** Applies to chosen parcels rather than the whole stop. */
  perParcel: boolean;
  actions: NextAction[];
};

export const EXCEPTION_OPTIONS: ExceptionOption[] = [
  {
    id: "recipient_unavailable",
    label: "Recipient not there",
    detail: "Nobody to receive the parcel",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
  {
    id: "recipient_unreachable",
    label: "Can’t contact recipient",
    detail: "Calls and messages not answered",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
  {
    id: "incorrect_address",
    label: "Wrong or incomplete address",
    detail: "Address doesn’t exist or can’t be found",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
  {
    id: "cannot_access",
    label: "Can’t reach the destination",
    detail: "Truck can’t enter, road closed, gate locked",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
  {
    id: "recipient_refused",
    label: "Recipient refused",
    detail: "Doesn’t want the parcel",
    perParcel: true,
    actions: ["return_to_depot"],
  },
  {
    id: "cod_not_paid",
    label: "Recipient can’t pay COD",
    detail: "Don’t hand over the parcel",
    perParcel: true,
    actions: ["reschedule", "return_to_depot"],
  },
  {
    id: "parcel_damaged",
    label: "Parcel damaged",
    detail: "Torn, wet or broken",
    perParcel: true,
    actions: ["return_to_depot", "reschedule"],
  },
  {
    id: "parcel_missing",
    label: "Parcel missing",
    detail: "Not on the truck",
    perParcel: true,
    actions: ["reschedule"],
  },
  {
    id: "other",
    label: "Something else",
    detail: "Describe it for operations",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
];

export const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  retry_later: "Try again later today",
  reschedule: "Reschedule for another day",
  return_to_depot: "Return to depot",
};
