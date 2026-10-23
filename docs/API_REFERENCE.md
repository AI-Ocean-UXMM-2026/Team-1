# API & Dispatch Engine Reference

This document provides specifications for the REST endpoints, internal optimization engines, database RPC interfaces, and external integration contracts of the **Oern Delivery Platform**.

---

## 1. REST API Endpoints

### 1.1 Multi-Truck VRP Dispatch Optimizer
- **Endpoint:** `POST /api/dispatch/plan`
- **Authentication:** Required (Supabase Auth session cookie or Bearer JWT)
- **Role Requirement:** `manager`

#### Purpose
Solves the Pickup and Delivery Problem with Time Windows (PDPTW), multi-truck capacity limits, EV/fuel range boundaries, and flood-hazard slow zones using the Adaptive Large Neighborhood Search (ALNS) metaheuristic.

#### Request Headers
```http
Content-Type: application/json
```

#### Request Payload Schema
```typescript
{
  "instance": {
    "depot": {
      "lat": number,              // e.g. 16.8053
      "lng": number               // e.g. 96.1561
    },
    "trucks": [
      {
        "id": string,             // Vehicle UUID
        "capKg": number,          // Payload capacity in kilograms (e.g. 1200)
        "capM3": number,          // Volume capacity in cubic meters (e.g. 8.5)
        "costPerKm": number,      // Marginal cost per kilometer in MMK
        "fixedCost": number,      // Fixed dispatch cost in MMK
        "maxKm": number | null    // Usable range (after reserve buffer), or null
      }
    ],
    "orders": [
      {
        "id": string,             // Order UUID
        "origin": "door" | "depot",
        "pickup": { "lat": number, "lng": number } | null,
        "delivery": { "lat": number, "lng": number },
        "weightKg": number,
        "volumeM3": number,
        "windowStart": number,    // Minutes from service midnight (e.g. 540 = 09:00)
        "windowEnd": number,      // Minutes from service midnight (e.g. 720 = 12:00)
        "deadline": number | null,
        "deadlineHard": boolean,
        "pickupService": number,  // Dwell service time in minutes (e.g. 10)
        "deliveryService": number,
        "pickupTownship": string | null,
        "deliveryTownship": string | null
      }
    ]
  },
  "matrix": {                     // Optional precomputed distance/duration matrix
    "durations": number[][],
    "distances": number[][]
  },
  "params": {                     // Optional solver tuning parameters
    "shiftStart": 480,            // 08:00
    "shiftEnd": 1080,             // 18:00
    "maxRouteMin": 540,           // 9 hours max per route
    "speedKmh": 24.0,             // Average urban speed
    "roadFactor": 1.35,           // Straight-line tortuosity scalar
    "floodWeight": 1.5,           // Hazard cost multiplier
    "ruinIterations": 120,        // ALNS ruin-and-recreate rounds
    "ruinPatience": 30,           // Early stopping rounds without improvement
    "deadlineMs": 4500            // Solver execution time limit
  },
  "mode": "preview" | "persist"   // "preview" tests without saving; "persist" saves to DB
}
```

#### Successful Response (`200 OK`)
```json
{
  "runId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "feasible",
  "dataTier": "road_matrix",
  "totalCost": 48500.0,
  "summary": {
    "totalRoutes": 2,
    "servedOrders": 14,
    "unservedOrders": 1,
    "totalDistanceKm": 68.4,
    "totalDurationMin": 340
  },
  "routes": [
    {
      "vehicleId": "v-electric-van-01",
      "driverId": "d-lin-htet",
      "distanceKm": 32.1,
      "durationMin": 165,
      "energyUsagePercent": 42.5,
      "stops": [
        {
          "orderId": "o-8812",
          "stopType": "pickup",
          "sequence": 1,
          "plannedArrival": "2026-10-23T09:15:00Z",
          "plannedDeparture": "2026-10-23T09:25:00Z"
        },
        {
          "orderId": "o-8812",
          "stopType": "delivery",
          "sequence": 2,
          "plannedArrival": "2026-10-23T09:55:00Z",
          "plannedDeparture": "2026-10-23T10:05:00Z"
        }
      ]
    }
  ],
  "unassigned": [
    {
      "orderId": "o-9941",
      "reasonCode": "insufficient_energy",
      "message": "Assigned truck battery reserve buffer would be breached."
    }
  ],
  "diagnostics": {
    "iterations": 120,
    "runtimeMs": 1420,
    "matrixSource": "mapbox_driving"
  }
}
```

---

### 1.2 Road Intelligence & Hazard Analysis
- **Endpoint:** `POST /api/road-intel/analyze`
- **Authentication:** Required
- **Role Requirement:** `manager`

#### Purpose
Applies dual-tier machine learning (Tool-calling LLM agent) or fast deterministic heuristics to categorize rider-submitted road incidents, compute confidence scores, and generate detour waypoints.

#### Request Payload
```json
{
  "reportIds": [
    "3f8e5c1d-6b2a-4f9e-8c3d-1a2b3c4d5e6f"
  ],
  "forceHeuristic": false
}
```

#### Successful Response (`200 OK`)
```json
{
  "analyzed": 1,
  "decisions": [
    {
      "reportId": "3f8e5c1d-6b2a-4f9e-8c3d-1a2b3c4d5e6f",
      "action": "avoid",
      "category": "flooding",
      "severity": "blocked",
      "confidence": 0.94,
      "delayMinutes": 45,
      "radiusMeters": 350,
      "rationale": "Multiple driver reports and live telemetry indicate 45cm water on Insein Road under the railway bridge.",
      "detourWaypoints": [
        { "lat": 16.8291, "lng": 96.1284 },
        { "lat": 16.8342, "lng": 96.1340 }
      ],
      "source": "agent",
      "expiresAt": "2026-10-23T18:00:00Z"
    }
  ]
}
```

---

## 2. Supabase Database RPC Interface

Database stored procedures called via the Supabase client (`supabase.rpc("function_name", { params })`):

### 2.1 Customer Pickup Order Creation
```sql
create_customer_pickup_order(
  p_pickup_address text,
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_delivery_address text,
  p_delivery_lat double precision,
  p_delivery_lng double precision,
  p_recipient_name text,
  p_recipient_phone text,
  p_parcel_description text,
  p_parcel_weight_kg numeric,
  p_cod_amount numeric,
  p_payment_method text DEFAULT 'cod'
) RETURNS jsonb
```
- **Guarantees:** Atomically creates the `delivery_orders` record in `pending` state, populates initial route stops, and returns the assigned `tracking_code`.

### 2.2 Job Board Claiming & Release
```sql
claim_delivery_job(
  p_job_id uuid
) RETURNS jsonb
```
- **Guarantees:** Concurrency-guarded via row locking (`FOR UPDATE`). Rejects claim if caller already has an incomplete route or if job is no longer `open`. Atomically transitions job to `claimed` and associates all job orders to the calling driver.

```sql
release_delivery_job(
  p_job_id uuid
) RETURNS jsonb
```
- **Guarantees:** Allows a driver to forfeit an unstarted job before moving. Clears driver associations and restores the job to `open` on the board.

### 2.3 Task Reproduction & Automated Batching
```sql
run_auto_accept_and_reproduce_workflow() RETURNS jsonb
```
- **Guarantees:** Scans pending orders, auto-accepts them into the queue, identifies stagnant unclaimed jobs, supersedes old jobs, escalates priorities (`high`/`urgent`), adds a +90m delivery buffer, clusters orders by township, and issues fresh `job_batches`.

### 2.4 Atomic Manager Assignment
```sql
assign_delivery(
  p_order_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid
) RETURNS boolean
```
- **Guarantees:** Locks order row. Prevents overwriting assignments once parcel has already been picked up.

---

## 3. External Logistics & E-Commerce Integrations

Oern provides unified order aggregation for external carriers (e.g., Royal Express, Ninja Van, DHL) and commerce shops (Shopify, WooCommerce, TikTok Shop).

### 3.1 External Provider Registration (`commerce_integrations`)
Stores channel connection metadata:
```json
{
  "provider_name": "royal_express",
  "channel_type": "logistics_partner",
  "account_identifier": "RE-MERCHANT-8910",
  "status": "active",
  "settings": {
    "tracking_url_template": "https://royalexpress.com.mm/track?code={TRACKING_NUMBER}",
    "auto_sync_interval_min": 60
  }
}
```

### 3.2 External Shipment Record (`external_shipments`)
Enables cross-carrier visibility in Customer and Support views:
```json
{
  "integration_id": "c7a8b9d0-1234-4567-89ab-cdef01234567",
  "customer_id": "c8942b01-9a7f-431c-8e3b-99f2b380a123",
  "provider_tracking_code": "RYX-99881122",
  "provider_name": "Royal Express",
  "current_status": "in_transit",
  "destination_address": "No. 45, Pyay Road, Kamayut Township, Yangon",
  "last_status_update": "2026-10-23T08:30:00Z"
}
```
