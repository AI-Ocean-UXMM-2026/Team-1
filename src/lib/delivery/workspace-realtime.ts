import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DeliveryLocation,
  DeliveryOrder,
  StatusEvent,
  WorkspaceData,
  WorkspaceProfile,
} from "@/lib/delivery/types";
import type { Database } from "@/lib/supabase/database.types";

type LocationRow = DeliveryLocation & { order_id: string };
type OrderUpdate = Pick<
  DeliveryOrder,
  "id" | "status" | "cod_status" | "estimated_delivery_at"
>;

export function mergeLocation(
  data: WorkspaceData,
  location: LocationRow,
): WorkspaceData {
  return {
    ...data,
    orders: data.orders.map((order) => {
      if (
        order.id !== location.order_id ||
        (order.latest_location &&
          order.latest_location.recorded_at > location.recorded_at)
      )
        return order;
      return { ...order, latest_location: location };
    }),
  };
}

export function mergeOrderUpdate(
  data: WorkspaceData,
  row: OrderUpdate,
): WorkspaceData {
  return {
    ...data,
    orders: data.orders.map((order) =>
      order.id === row.id
        ? {
            ...order,
            status: row.status,
            cod_status: row.cod_status,
            estimated_delivery_at: row.estimated_delivery_at,
          }
        : order,
    ),
  };
}

export function mergeStatusEvent(
  data: WorkspaceData,
  event: StatusEvent,
): WorkspaceData {
  if (!data.orders.some((order) => order.id === event.order_id)) return data;
  return {
    ...data,
    statusEvents: [
      ...data.statusEvents.filter((item) => item.id !== event.id),
      event,
    ].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export function subscribeWorkspaceRealtime(
  supabase: SupabaseClient<Database>,
  {
    userId,
    role,
    updateData,
    refresh,
  }: {
    userId: string;
    role: WorkspaceProfile["role"];
    updateData: (updater: (previous: WorkspaceData) => WorkspaceData) => void;
    refresh: () => void;
  },
) {
  let active = true;
  const channel = supabase
    .channel(`workspace-${role}-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "delivery_locations" },
      (payload) => {
        if (!active) return;
        updateData((previous) =>
          mergeLocation(previous, payload.new as LocationRow),
        );
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "delivery_orders",
        ...(role === "customer" ? { filter: `customer_id=eq.${userId}` } : {}),
      },
      (payload) => {
        if (!active) return;
        if (payload.eventType === "UPDATE")
          updateData((previous) =>
            mergeOrderUpdate(previous, payload.new as OrderUpdate),
          );
        refresh();
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "delivery_status_events" },
      (payload) => {
        if (!active) return;
        updateData((previous) =>
          mergeStatusEvent(previous, payload.new as StatusEvent),
        );
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "delivery_assignments",
        ...(role === "driver" ? { filter: `driver_id=eq.${userId}` } : {}),
      },
      () => {
        if (active) refresh();
      },
    )
    .subscribe((status) => {
      if (active && status === "SUBSCRIBED") refresh();
    });
  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}
