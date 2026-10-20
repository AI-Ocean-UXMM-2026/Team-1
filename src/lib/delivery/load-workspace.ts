import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DeliveryLocation,
  DeliveryOrder,
  DeliveryStatus,
  DriverOption,
  ProfileOption,
  RoadReport,
  StatusEvent,
  VehicleOption,
  WorkspaceData,
  WorkspaceProfile,
} from "@/lib/delivery/types";
import type { Database, Tables } from "@/lib/supabase/database.types";

type DeliveryOrderRow = Tables<"delivery_orders">;
type AssignmentRow = Tables<"delivery_assignments">;
type ProfileRow = Tables<"profiles">;
type LocationRow = Tables<"delivery_locations">;
type VehicleRow = Tables<"vehicles">;
type RoadReportRow = Tables<"road_reports">;

export type LoadedWorkspace = {
  profile: WorkspaceProfile;
  data: WorkspaceData;
  isDemo: boolean;
};

const vehicleTypeLabels: Record<string, string> = {
  motorcycle: "Motorcycle",
  e_bike: "E-bike",
  car: "Car",
  truck: "Truck",
};

export async function loadWorkspace(
  supabase: SupabaseClient<Database>,
  requestedRole: WorkspaceProfile["role"],
  userId: string,
): Promise<LoadedWorkspace> {
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profileRow)
    throw new Error(
      "Your account profile is missing. Ask a manager to check your access.",
    );

  const profile: WorkspaceProfile = {
    id: profileRow.id,
    full_name: profileRow.full_name,
    phone: profileRow.phone,
    role: profileRow.role as WorkspaceProfile["role"],
  };

  if (profile.role !== requestedRole) {
    return {
      profile,
      data: {
        orders: [],
        customers: [],
        drivers: [],
        vehicles: [],
        statusEvents: [],
        roadReports: [],
      },
      isDemo: false,
    };
  }

  const [
    ordersResult,
    assignmentsResult,
    profilesResult,
    driverProfilesResult,
    vehiclesResult,
    locationsResult,
    eventsResult,
    roadReportsResult,
  ] = await Promise.all([
    supabase
      .from("delivery_orders")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("delivery_assignments").select("*").is("ended_at", null),
    supabase.from("profiles").select("id, full_name, phone, role"),
    supabase.from("driver_profiles").select("user_id, availability"),
    supabase
      .from("vehicles")
      .select(
        "id, registration_number, vehicle_type, status, capacity_kg, energy_source, fuel_level_percent, battery_level_percent, range_km_at_full, reserve_percent, odometer_km, service_due_at_km",
      ),
    supabase
      .from("latest_delivery_locations")
      .select("order_id, latitude, longitude, accuracy_meters, recorded_at")
      .order("recorded_at", { ascending: false }),
    supabase
      .from("delivery_status_events")
      .select("id, order_id, status, note, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("road_reports")
      .select(
        "id, driver_id, order_id, category, severity, description, latitude, longitude, status, reported_at, expires_at",
      )
      .order("reported_at", { ascending: false }),
  ]);

  const firstError =
    ordersResult.error ??
    assignmentsResult.error ??
    profilesResult.error ??
    driverProfilesResult.error ??
    vehiclesResult.error ??
    locationsResult.error ??
    eventsResult.error ??
    roadReportsResult.error;
  if (firstError) throw firstError;

  const orders = (ordersResult.data ?? []) as DeliveryOrderRow[];
  const driverAvailability = new Map(
    (driverProfilesResult.data ?? []).map((item) => [
      item.user_id,
      item.availability,
    ]),
  );
  const registeredDrivers: DriverOption[] = (profilesResult.data ?? [])
    .filter((item) => item.role === "driver" && driverAvailability.has(item.id))
    .map((item) => ({
      id: item.id,
      full_name: item.full_name,
      phone: item.phone,
      availability: driverAvailability.get(
        item.id,
      ) as DriverOption["availability"],
    }));
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const roadReports: RoadReport[] = (
    (roadReportsResult.data ?? []) as RoadReportRow[]
  ).map((report) => ({
    id: report.id,
    driver_id: report.driver_id,
    driver_name: profileById.get(report.driver_id)?.full_name ?? "Rider",
    order_id: report.order_id,
    category: report.category as RoadReport["category"],
    severity: report.severity as RoadReport["severity"],
    description: report.description,
    latitude: report.latitude,
    longitude: report.longitude,
    status: report.status as RoadReport["status"],
    reported_at: report.reported_at,
    expires_at: report.expires_at,
  }));
  if (orders.length === 0) {
    const vehicles = (vehiclesResult.data ?? []) as VehicleRow[];
    return {
      profile,
      isDemo: false,
      data: {
        orders: [],
        customers: profiles
          .filter((item) => item.role === "customer")
          .map((item) => ({
            id: item.id,
            full_name: item.full_name,
            phone: item.phone,
          })),
        drivers: requestedRole === "manager" ? registeredDrivers : [],
        vehicles:
          requestedRole === "manager"
            ? vehicles.map((item) => ({
                id: item.id,
                registration_number: item.registration_number,
                vehicle_type: item.vehicle_type,
                status: item.status,
                energy_source:
                  item.energy_source as VehicleOption["energy_source"],
                fuel_level_percent: item.fuel_level_percent,
                battery_level_percent: item.battery_level_percent,
                range_km_at_full: item.range_km_at_full,
                reserve_percent: item.reserve_percent,
                odometer_km: item.odometer_km,
                service_due_at_km: item.service_due_at_km,
                capacity_kg: item.capacity_kg,
              }))
            : [],
        statusEvents: [],
        roadReports: requestedRole === "manager" ? roadReports : [],
      },
    };
  }

  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const vehicles = (vehiclesResult.data ?? []) as VehicleRow[];
  const locations = (locationsResult.data ?? []) as LocationRow[];
  const events = (eventsResult.data ?? []) as StatusEvent[];

  const vehicleById = new Map(vehicles.map((item) => [item.id, item]));
  const assignmentByOrder = new Map<string, AssignmentRow>();

  for (const assignment of assignments) {
    const current = assignmentByOrder.get(assignment.order_id);
    if (!current || assignment.assigned_at > current.assigned_at) {
      assignmentByOrder.set(assignment.order_id, assignment);
    }
  }

  const locationByOrder = new Map<string, DeliveryLocation>();
  for (const location of locations) {
    if (!locationByOrder.has(location.order_id)) {
      locationByOrder.set(location.order_id, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy_meters: location.accuracy_meters,
        recorded_at: location.recorded_at,
      });
    }
  }

  const mappedOrders: DeliveryOrder[] = orders.map((order) => {
    const assignment = assignmentByOrder.get(order.id);
    const driverId = assignment?.driver_id ?? null;
    const vehicleId = assignment?.vehicle_id ?? null;
    const driver = driverId ? profileById.get(driverId) : null;
    const vehicle = vehicleId ? vehicleById.get(vehicleId) : null;
    const customer = profileById.get(order.customer_id);

    return {
      id: order.id,
      tracking_code: order.tracking_code,
      customer_id: order.customer_id,
      customer_name:
        customer?.full_name ||
        (requestedRole === "customer" ? "Your delivery" : "Customer"),
      status: order.status as DeliveryStatus,
      pickup_address: order.pickup_address,
      delivery_address: order.delivery_address,
      pickup_latitude: order.pickup_latitude,
      pickup_longitude: order.pickup_longitude,
      delivery_latitude: order.delivery_latitude,
      delivery_longitude: order.delivery_longitude,
      recipient_name: order.recipient_name,
      recipient_phone: order.recipient_phone,
      parcel_description: order.parcel_description,
      parcel_weight_kg: order.parcel_weight_kg,
      cod_amount: order.cod_amount,
      cod_status: order.cod_status as DeliveryOrder["cod_status"],
      estimated_delivery_at: order.estimated_delivery_at,
      route_progress_percent: order.route_progress_percent,
      traffic_delay_minutes: order.traffic_delay_minutes,
      eta_confidence: order.eta_confidence as DeliveryOrder["eta_confidence"],
      eta_updated_at: order.eta_updated_at,
      created_at: order.created_at,
      driver_id: driverId,
      driver_name: driver?.full_name ?? (driverId ? "Your rider" : null),
      driver_phone: driver?.phone ?? null,
      vehicle_id: vehicleId,
      vehicle_label: vehicle
        ? `${vehicle.registration_number} · ${vehicleTypeLabels[vehicle.vehicle_type] ?? vehicle.vehicle_type}`
        : null,
      latest_location: locationByOrder.get(order.id) ?? null,
    };
  });

  const customers: ProfileOption[] = profiles
    .filter((item) => item.role === "customer")
    .map((item) => ({
      id: item.id,
      full_name: item.full_name,
      phone: item.phone,
    }));
  const vehicleOptions: VehicleOption[] = vehicles.map((item) => ({
    id: item.id,
    registration_number: item.registration_number,
    vehicle_type: item.vehicle_type,
    status: item.status,
    energy_source: item.energy_source as VehicleOption["energy_source"],
    fuel_level_percent: item.fuel_level_percent,
    battery_level_percent: item.battery_level_percent,
    range_km_at_full: item.range_km_at_full,
    reserve_percent: item.reserve_percent,
    odometer_km: item.odometer_km,
    service_due_at_km: item.service_due_at_km,
    capacity_kg: item.capacity_kg,
  }));

  return {
    profile,
    isDemo: false,
    data: {
      orders: mappedOrders,
      customers,
      drivers: registeredDrivers,
      vehicles: vehicleOptions,
      statusEvents: events.map((event) => ({
        ...event,
        status: event.status as DeliveryStatus,
      })),
      roadReports,
    },
  };
}
