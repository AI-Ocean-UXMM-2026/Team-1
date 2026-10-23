# System Architecture

This document describes the technical architecture, design patterns, and subsystem interactions of the **Oern Door-to-Door Delivery Platform**.

---

## 1. High-Level Architecture Overview

Oern is architected around a reactive, event-driven model connecting mobile web clients for field riders and customers to an administrative command hub and an optimization core backed by Supabase PostgreSQL.

```mermaid
flowchart TB
    subgraph Clients["Frontend Clients (Next.js 16 + React 19)"]
        CustUI["Customer Web App\n(/, /orders, /pickup, /track)"]
        RiderUI["Driver / Rider Mobile Web\n(/rider, /rider/route, /rider/jobs)"]
        MgrUI["Manager Command Center\n(/manager, /manager/jobs, /manager/vehicles)"]
        SellerUI["Seller Portal\n(/seller)"]
        SupportUI["Support Workspace\n(/support)"]
    end

    subgraph EdgeProxy["Next.js Proxy & Edge Routing"]
        Proxy["Proxy Layer (Role Redirection &\nSession Context Guard)"]
    end

    subgraph NextServer["Next.js Application Server (API Routes)"]
        DispatchAPI["/api/dispatch/plan\n(ALNS Multi-Truck VRP Solver)"]
        RoadIntelAPI["/api/road-intel/analyze\n(AI Hazard Analysis & Heuristics)"]
    end

    subgraph ExternalGIS["External GIS & Map Providers"]
        MapboxTiles["Mapbox GL Vector Tiles\n(OpenStreetMap Fallback)"]
        MapboxMatrix["Mapbox Matrix & Directions API"]
    end

    subgraph SupabasePlatform["Supabase Managed Cloud"]
        Auth["Supabase Auth\n(JWT & Secure Cookie Sessions)"]
        PostgresDB[("PostgreSQL Database\n- Relational Schemas\n- Row-Level Security (RLS)\n- Atomic RPCs & Triggers")]
        RealtimeWS["Supabase Realtime\n(PostgreSQL CDC WebSockets)"]
        Storage["Supabase Storage\n(Proof-of-Delivery Photos)"]
    end

    Clients --> Proxy
    Proxy --> CustUI & RiderUI & MgrUI & SellerUI & SupportUI
    
    CustUI & RiderUI & MgrUI & SellerUI & SupportUI --> Auth
    CustUI & RiderUI & MgrUI & SellerUI & SupportUI --> PostgresDB
    PostgresDB -.-> RealtimeWS
    RealtimeWS -.-> CustUI & RiderUI & MgrUI & SellerUI & SupportUI

    RiderUI --> Storage
    MgrUI --> DispatchAPI
    MgrUI --> RoadIntelAPI
    DispatchAPI --> MapboxMatrix
    CustUI & RiderUI & MgrUI --> MapboxTiles
```

---

## 2. Frontend Layer (Next.js 16 & React 19)

### 2.1 Role-Based Route Splitting
The application enforces strict separation of concerns across platform roles using URL namespaces:
- `/` (default route) redirects unauthenticated visitors to `/welcome` and authenticated customers to `/home`.
- `/rider/*` serves a touch-optimized, high-contrast mobile web interface tailored for motorcycle and van couriers.
- `/manager/*` provides an operations dashboard with map telemetry, batch dispatch controls, vehicle fleet management, and financial ledgers.
- `/seller/*` provides merchant order creation, e-commerce channel registration, and external shipment tracking.
- `/support/*` provides customer service ticket investigation, timeline auditing, and dispute logging.

### 2.2 Navigation Proxy vs. Security Boundary
Next.js Proxy acts as an onboarding and routing accelerator:
```
Signed-in User -> Proxy reads auth session -> Looks up profile role -> Redirects to role workspace
```
> [!IMPORTANT]
> The Next.js Proxy redirect is a user navigation aid, **not** the security boundary. The true security boundary is enforced strictly inside PostgreSQL via Row-Level Security (RLS) policies. Even if a malicious user alters client-side code to navigate to `/manager`, PostgreSQL immediately rejects unauthorized reads and mutations with an empty response or an RLS permission error.

### 2.3 Responsive & Hardware-Aware UI
- **Mobile Couriers (`/rider`):** Designed for single-hand mobile operation on two-wheelers, utilizing bottom action sheets, swipe-to-confirm gestures, high-contrast typography, and native canvas image compression for proof-of-delivery (POD) photo capture.
- **Dispatch Command Hub (`/manager`):** Designed for wide multi-monitor desktop environments with split-screen GIS maps, live telemetry tables, collapsible drawer sidebars, and real-time KPI metrics.

---

## 3. Real-Time Telemetry & Geolocation Subsystem

Customer live tracking is the central product guarantee of Oern: once a parcel is marked `picked_up`, the customer can follow its live location and dynamic ETA until delivery.

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Driver / Rider
    participant RiderApp as Rider Mobile App
    participant Supabase as Supabase Database
    participant Realtime as Supabase Realtime (WS)
    participant CustApp as Customer Web App
    actor Customer as Customer

    Driver->>RiderApp: Tap "Confirm Parcel Pickup"
    RiderApp->>Supabase: UPDATE delivery_orders SET status='picked_up'
    RiderApp->>RiderApp: Request navigator.geolocation.watchPosition()
    Note over RiderApp: One GPS watch instance broadcasts<br/>for all collected parcels assigned to rider
    loop Continuous Location Updates (When Moved or Aged)
        RiderApp->>Supabase: INSERT INTO live_locations(order_id, latitude, longitude, accuracy)
        Supabase->>Realtime: Broadcast postgres_changes (INSERT)
        Realtime-->>CustApp: Push live coordinate payload
        CustApp->>CustApp: Recalculate ETA, smooth marker bearing & render Mapbox
        CustApp-->>Customer: Display animated vehicle icon & minutes countdown
    end
    Driver->>RiderApp: Complete Delivery (Delivered / Issue)
    RiderApp->>Supabase: UPDATE delivery_orders SET status='delivered'
    RiderApp->>RiderApp: Clear GPS watch for closed order
```

### 3.1 Efficient Multi-Parcel GPS Broadcasting
To minimize battery drain and avoid duplicate browser geolocation listeners, [`src/lib/delivery/use-rider-location.ts`](file:///Users/happer/Projects/oern/src/lib/delivery/use-rider-location.ts) binds a single `watchPosition` observer to all collected orders. When a new coordinate arrives:
1. It verifies spatial displacement (movement threshold > 10m) and temporal freshness (delta > 5s).
2. It broadcasts location inserts across all active, collected parcels assigned to that driver in one batch.
3. Once an order reaches a terminal state (`delivered`, `failed`, or `cancelled`), it is automatically unlinked from the location broadcaster.

### 3.2 Inverted Security View
To prevent unauthorized users from scraping entire fleet locations, public and customer tracking reads coordinates through an invoker-security view (`latest_delivery_locations`). RLS rules verify that:
- The requesting user is the customer who created the order, OR
- The requesting user is the assigned driver, OR
- The requesting user has the `manager` role.
- Furthermore, coordinates are only emitted when order status is in `["picked_up", "in_transit"]`.

---

## 4. Multi-Truck Dispatch Optimization Engine (VRP)

The dispatch optimization engine in [`src/lib/delivery/dispatch/`](file:///Users/happer/Projects/oern/src/lib/delivery/dispatch/) solves the **Pickup and Delivery Problem with Time Windows (PDPTW)**, vehicle capacities, and electric/fuel range constraints.

```mermaid
flowchart TD
    Req["Dispatch Request (POST /api/dispatch/plan)\n- Depot Location\n- Vehicle Fleet with Capacities & Energy\n- Orders with Windows & Volumes"] --> MatrixCheck{"Mapbox Server Token\nConfigured?"}
    MatrixCheck -->|Yes| MapboxCall["Call Mapbox Matrix API\n(Real Road Durations & Distances)"]
    MatrixCheck -->|No| HeuristicMatrix["Haversine Straight-Line Distance\nx Road Tortuosity Factor (1.35)"]
    
    MapboxCall & HeuristicMatrix --> Matrix["Cost Matrix Formulation"]
    Matrix --> FloodLayer["Incorporate Severe Weather / Flood Layer\n(Slowdown & Barrier Penalties)"]
    FloodLayer --> InitSolver["Initial Solution Generation\n(Nearest Insertion + Time-Window Feasibility)"]
    InitSolver --> ALNS["Adaptive Large Neighborhood Search (ALNS)\nRuin-and-Recreate Metaheuristic"]
    
    subgraph Metaheuristic["Ruin-and-Recreate Loop"]
        Ruin["Shaw Spatial/Temporal Removal\n& Worst-Cost Removal"] --> Recreate["Regret-2 Greedy Re-insertion"]
        Recreate --> AcceptCheck{"Improves Cost Objective\nwithin Time Deadline?"}
        AcceptCheck -->|Yes| UpdateBest["Update Best Feasible Schedule"]
        AcceptCheck -->|No| Anneal["Metropolis Acceptance Criterion"]
    end
    ALNS --> Metaheuristic
    Metaheuristic --> FeasibilityGuard["Energy & Reserve Feasibility Check\n(Range km x Level% - Reserve Buffer)"]
    FeasibilityGuard --> Output["Optimized Multi-Truck Dispatch Plan\n- Sequenced Stops & ETAs\n- Unassigned Orders & Reason Codes\n- Metric Run Telemetry"]
```

### 4.1 Cost Function Formulation
The solver optimizes an objective function balancing route distance, transit time, unserved penalties, and territory cohesion:
\[
\text{Cost} = \sum_{r \in \text{Routes}} \left( c_{\text{dist}} \cdot D_r + c_{\text{time}} \cdot T_r + c_{\text{fixed}} \cdot \mathbf{1}_{\{|r| > 0\}} \right) + \sum_{o \in \text{Unserved}} P_o + \text{Penalty}_{\text{flood}} + \text{Penalty}_{\text{late}}
\]

### 4.2 Energy & Electric Vehicle Reserve Constraints
For EV and fuel-constrained fleets:
- **Usable Range:**
  \[
  \text{Range}_{\text{usable}} = \text{Range}_{\text{full}} \times \left( \frac{\text{CurrentLevel}\% - \text{Reserve}\%}{100} \right)
  \]
- If the planned route length exceeds \(\text{Range}_{\text{usable}}\), the optimizer rejects vehicle assignment, returning an explainable code (`insufficient_energy`) so the dispatcher can schedule a recharge or fuel stop.

---

## 5. Road Intelligence & Severe Weather Watch Subsystem

The road intelligence subsystem in [`src/lib/delivery/road-intel/`](file:///Users/happer/Projects/oern/src/lib/delivery/road-intel/) converts field driver reports and weather hazards into actionable routing constraints.

```mermaid
flowchart LR
    DriverReport["Driver Reports Road Hazard\n(Congestion / Flooding / Roadwork)"] --> Ingest["Ingest to road_reports"]
    Ingest --> API["POST /api/road-intel/analyze"]
    
    subgraph DecisionEngine["Dual-Tier Analysis Engine"]
        AIAgent["Tier 1: AI Agent\n(Deep Analysis with Tool Calling)"]
        Fallback["Tier 2: Rule-Based Heuristics\n(Instant Deterministic Fallback)"]
    end
    API --> DecisionEngine
    
    DecisionEngine --> Verdict["RoadDecision\n- Action: avoid / delay / monitor / ignore\n- Severity & Confidence Score (0-1)\n- Delay Minutes & Effect Radius (m)\n- Detour Waypoints"]
    Verdict --> DB[("Attached to road_reports")]
    DB --> Realtime["Broadcast Realtime Updates to Active Routes"]
    Realtime --> NavEngine["Mapbox Navigation & Dispatcher\n(Reroute around Hazard Polygon)"]
```

### 5.1 Dual-Tier Inference Engine
1. **Tier 1 (AI Agent Analysis):** When LLM inference is enabled, the agent queries spatial tools (`get_speed_samples`, `get_active_orders_near_hazard`) and examines text descriptions to determine if the road is impassable.
2. **Tier 2 (Heuristic Fallback):** If API keys are missing or timeouts occur, deterministic heuristic rules classify severity based on keywords (e.g., "flooded", "under water", "tree fallen", "gridlock") and spatial proximity.
3. **Detour Waypoints:** When an `avoid` action is decreed with high confidence, [`detourWaypoints()`](file:///Users/happer/Projects/oern/src/lib/delivery/road-intel/detour.ts) computes perpendicular offset waypoints outside the hazard radius, steering route polyline calculations around the obstruction.

---

## 6. Automated Job Board & Batching Queue

To automate high-volume dispatch across townships, Oern implements a self-healing 9-hour batching queue:

```mermaid
stateDiagram-v2
    [*] --> PendingOrder: Order created by Customer / Seller
    PendingOrder --> Queued: Auto-Accepted via Cron / Manager
    Queued --> ClusteredJob: 9-Hour Batch Run (pg_cron)
    note right of ClusteredJob: Grouped by Township Proximity\nMax 8 parcels or 150 kg per Job
    ClusteredJob --> Claimed: Driver Claims Job on Board
    Claimed --> InProgress: Driver Starts Route
    InProgress --> Completed: All Parcels Delivered / Resolved
    Completed --> [*]

    ClusteredJob --> Superseded: Unclaimed after Stagnation Window
    Superseded --> EscalatedJob: reproduce_unclaimed_tasks()
    note right of EscalatedJob: Priority boosted (High/Urgent)\nDelivery buffer +90m\nCycle count incremented
    EscalatedJob --> ClusteredJob: Re-posted to Driver Board
```

- **Cron Schedule:** Runs every 9 hours (checked hourly by `pg_cron`), clustering pending orders by delivery township and geographic proximity.
- **Task Reproduction & Escalation (`reproduce_unclaimed_tasks`):** Orders that remain unclaimed when the next calculation cycle runs are extracted, escalated in priority (`normal` → `high` → `urgent`), given an extended delivery buffer (+90 minutes), and re-posted with visual urgency badges for couriers.
- **Concurrency & Atomicity:** Database functions use row-level locking (`FOR UPDATE`) to ensure two couriers cannot claim the same job batch simultaneously.

---

## 7. State Synchronization & Realtime Coordination

To keep customer, driver, and manager screens synchronized without page reloads, [`src/lib/delivery/workspace-realtime.ts`](file:///Users/happer/Projects/oern/src/lib/delivery/workspace-realtime.ts) orchestrates Supabase Realtime channels.

- **Deduplication & Chronological Ordering:** Inbound status events and location pings are indexed by timestamp and identifier. Out-of-order WebSocket arrivals are reconciled before updating React state.
- **Session Cleanup:** When an account signs out or switches roles, active channels and queued callbacks are torn down cleanly, preventing memory leaks and cross-tenant data contamination.
