"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LoadingBlock,
  PageHeader,
  SignInGate,
} from "@/components/delivery/common";
import { RoutesSketch as DispatchRoutesSketch } from "@/components/delivery/dispatch-routes-sketch";
import { Icon } from "@/components/delivery/icons";
import { ModalPanel } from "@/components/delivery/modal-panel";
import {
  type ApiError,
  commitMessage,
  type PlanResponse,
  reasonCopy,
  requestPlan,
  routeCards,
  summarize,
  TRUCK_EXCLUSION_COPY,
  WEIGHT_SOURCE_COPY,
  warningCopy,
} from "@/lib/delivery/dispatch/client";
import {
  runSyntheticPlan,
  SYNTHETIC_SCENARIOS,
  type SyntheticScenario,
} from "@/lib/delivery/dispatch/synthetic-scenarios";
import { useDispatchSetup } from "@/lib/delivery/use-dispatch-setup";
import { createClient } from "@/lib/supabase/client";

import "./manager-dispatch.css";

/** Preview mode exists only outside production, like the rider preview. */
const ALLOW_PREVIEW = process.env.NODE_ENV !== "production";

const yangonToday = () =>
  new Date(Date.now() + 6.5 * 3600e3).toISOString().slice(0, 10);
const shortId = (id: string) => id.slice(-6);

type StaleItem = { order_id: string; change: string };
const STALE_COPY: Record<string, string> = {
  status_changed: "its status changed",
  already_assigned: "it was assigned elsewhere",
  order_changed: "the order was edited",
  logistics_changed: "its parcel details were edited",
  order_missing: "it no longer exists",
};

export function DispatchApp() {
  const router = useRouter();
  const [synthetic, setSynthetic] = useState<boolean | null>(
    ALLOW_PREVIEW ? null : false,
  );
  useEffect(() => {
    if (!ALLOW_PREVIEW) return;
    setSynthetic(
      new URLSearchParams(window.location.search).get("preview") ===
        "synthetic",
    );
  }, []);

  const { setup, reload } = useDispatchSetup(synthetic === false);

  /* ---- setup form ---- */
  const [depotId, setDepotId] = useState("");
  const [serviceDate, setServiceDate] = useState(yangonToday);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [drivers, setDrivers] = useState<Record<string, string>>({});
  const seeded = useRef(false);
  useEffect(() => {
    if (setup.status !== "ready" || seeded.current) return;
    seeded.current = true;
    const firstDepot =
      setup.depots.find((d) => d.location_status === "verified") ??
      setup.depots[0];
    setDepotId(firstDepot?.id ?? "");
    setPicked(
      Object.fromEntries(
        setup.trucks.map((t) => [
          t.id,
          truckProblem(t, firstDepot?.id) == null,
        ]),
      ),
    );
    setDrivers(
      Object.fromEntries(
        setup.trucks.map((t) => [t.id, t.default_driver_id ?? ""]),
      ),
    );
  }, [setup]);

  /* ---- plan state ---- */
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<ApiError | null>(null);
  const [scenario, setScenario] = useState<SyntheticScenario>("baseline");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (synthetic !== true) return;
    let cancelled = false;
    setBuilding(true);
    runSyntheticPlan(scenario)
      .then((result) => {
        if (!cancelled) {
          setPlan(result);
          setSelected(null);
        }
      })
      .catch((cause) => {
        if (!cancelled)
          setBuildError({
            code: "synthetic",
            message:
              cause instanceof Error
                ? cause.message
                : "Could not build the synthetic plan.",
          });
      })
      .finally(() => !cancelled && setBuilding(false));
    return () => {
      cancelled = true;
    };
  }, [synthetic, scenario]);

  const chosenTrucks = setup.trucks.filter((t) => picked[t.id]);
  const driverClash = (() => {
    const used = chosenTrucks.map((t) => drivers[t.id]).filter(Boolean);
    return new Set(used).size !== used.length;
  })();
  const depot = setup.depots.find((d) => d.id === depotId);
  const blockers: string[] = [];
  if (!depot) blockers.push("Choose a depot.");
  else if (depot.location_status !== "verified")
    blockers.push("Confirm the depot location first.");
  if (!chosenTrucks.length) blockers.push("Select at least one truck.");
  if (chosenTrucks.some((t) => !drivers[t.id]))
    blockers.push("Choose a driver for every selected truck.");
  if (driverClash) blockers.push("A driver can only take one truck.");

  async function build(replaceDraft = false) {
    setBuilding(true);
    setBuildError(null);
    const outcome = await requestPlan({
      depotId,
      serviceDate,
      mode: "persist",
      replaceDraft,
      clientKey: crypto.randomUUID(),
      vehicleIds: chosenTrucks.map((t) => t.id),
      driverByVehicle: Object.fromEntries(
        chosenTrucks.map((t) => [t.id, drivers[t.id] || null]),
      ),
    });
    setBuilding(false);
    if (outcome.ok) {
      setPlan(outcome.data);
      setSelected(null);
      commitKey.current = crypto.randomUUID();
    } else setBuildError(outcome.error);
  }

  /* ---- commit / discard ---- */
  const commitKey = useRef(crypto.randomUUID());
  const [dialog, setDialog] = useState<"commit" | "discard" | null>(null);
  const [working, setWorking] = useState(false);
  const [stale, setStale] = useState<StaleItem[]>([]);
  const [outcome, setOutcome] = useState<{
    kind: "done" | "stale" | "blocked" | "info";
    text: string;
  } | null>(null);
  const [committed, setCommitted] = useState(false);
  const [discardReason, setDiscardReason] = useState("Not needed");

  async function commit(onStale: "abort" | "skip") {
    if (!plan?.run.id || plan.run.revision == null) return;
    setWorking(true);
    const { data, error } = await createClient().rpc("commit_dispatch_run", {
      p_run_id: plan.run.id,
      p_expected_revision: plan.run.revision,
      p_commit_key: commitKey.current,
      p_on_stale: onStale,
    });
    setWorking(false);
    if (error) {
      setOutcome({ kind: "info", text: error.message });
      return;
    }
    const result = (data ?? {}) as Record<string, unknown>;
    const message = commitMessage(result);
    setOutcome(message);
    setStale(
      message.kind === "stale"
        ? ((result.stale_orders as StaleItem[]) ?? [])
        : [],
    );
    if (message.kind === "done") {
      setCommitted(true);
      setDialog(null);
    }
  }

  async function discard() {
    if (!plan?.run.id) return;
    setWorking(true);
    const { data, error } = await createClient().rpc("discard_dispatch_run", {
      p_run_id: plan.run.id,
      p_reason: discardReason,
    });
    setWorking(false);
    const result = (data ?? {}) as { discarded?: boolean; reason?: string };
    if (error || result.discarded === false) {
      setOutcome({
        kind: "info",
        text: error?.message ?? "This plan can no longer be discarded.",
      });
      return;
    }
    setDialog(null);
    setPlan(null);
    setOutcome(null);
  }

  /* ---- derived ---- */
  const labels = useMemo(
    () => new Map(plan?.trucks.map((t) => [t.id, t.registration]) ?? []),
    [plan],
  );
  const cards = useMemo(
    () =>
      plan ? routeCards(plan.routes, (id) => labels.get(id) ?? "Truck") : [],
    [plan, labels],
  );
  const summary = plan ? summarize(plan) : null;
  const driverName = (id: string | null) =>
    setup.drivers.find((d) => d.id === id)?.name ?? null;
  const routeDrivers = plan?.routes.map((r) => r.driver_id) ?? [];

  if (synthetic === null)
    return <LoadingBlock title="Opening route planner…" />;
  if (synthetic === false && setup.status === "loading")
    return <LoadingBlock title="Opening route planner…" />;

  return (
    <main className="operations-app dispatch-app">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <Link className="workspace-back-link" href="/manager/order">
            <Icon name="arrow-left" size={15} /> Back to dispatch
          </Link>
        </div>
      </header>

      <div className="operations-shell">
        <PageHeader
          title="Plan routes"
          description="Assign open orders to the trucks at the depot, then review before drivers see anything."
        />

        {synthetic && (
          <section
            className="dispatch-synthetic"
            role="note"
            aria-label="Synthetic data"
          >
            <strong>
              <Icon name="warning" size={16} /> SYNTHETIC DATA
            </strong>
            <p>
              These orders, trucks and conditions are invented. Nothing here is
              real or saved, and committing is disabled. Times use a simulated
              clock (01:00 on the service day) and straight-line distances.
            </p>
            <fieldset className="dispatch-segment">
              <legend className="sr-only">Simulated scenario</legend>
              {SYNTHETIC_SCENARIOS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={scenario === item.id}
                  onClick={() => setScenario(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </fieldset>
            <p className="dispatch-synthetic-note">
              {
                SYNTHETIC_SCENARIOS.find((item) => item.id === scenario)
                  ?.description
              }
            </p>
          </section>
        )}

        {!synthetic && setup.status === "signed_out" && (
          <SignInGate
            title="Sign in to plan routes"
            body="Route planning is available to manager accounts."
            onSignIn={() => router.push("/signin")}
          />
        )}
        {!synthetic && setup.status === "not_manager" && (
          <section className="operations-panel operations-signin">
            <h2>Managers only</h2>
            <p>Your account cannot plan routes.</p>
          </section>
        )}
        {!synthetic && setup.status === "error" && (
          <div className="error-notice" role="alert">
            {setup.error}
            <button type="button" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        )}

        {building && (
          <output className="dispatch-building" aria-live="polite">
            <span className="dispatch-spinner" aria-hidden="true" />
            Building routes… this can take up to 30 seconds.
          </output>
        )}

        {buildError && (
          <div className="error-notice" role="alert">
            <span>{buildErrorCopy(buildError)}</span>
            {buildError.code === "draft_exists" ? (
              <button type="button" onClick={() => void build(true)}>
                Replace the draft
              </button>
            ) : (
              !synthetic && (
                <button type="button" onClick={() => void build(false)}>
                  Try again
                </button>
              )
            )}
          </div>
        )}

        {/* ------------------------------- committed ------------------------------- */}
        {committed && (
          <section className="operations-panel dispatch-done">
            <h2>
              <Icon name="check" size={18} /> Routes committed
            </h2>
            <p>Drivers can see their ordered stops in the rider app now.</p>
            <div className="dispatch-actions">
              <Link className="button button-primary" href="/manager/track">
                Follow in Track <Icon name="arrow-right" size={16} />
              </Link>
              <Link className="button button-outline" href="/manager/order">
                Back to orders
              </Link>
            </div>
          </section>
        )}

        {/* --------------------------------- setup --------------------------------- */}
        {!synthetic && setup.status === "ready" && !plan && !committed && (
          <section
            className="operations-panel dispatch-setup"
            aria-labelledby="setup-title"
          >
            <h2 id="setup-title">Set up today's plan</h2>

            <div className="dispatch-field-row">
              <label>
                Depot
                <select
                  value={depotId}
                  onChange={(e) => setDepotId(e.target.value)}
                >
                  {setup.depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Service day
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                />
              </label>
            </div>
            {serviceDate !== yangonToday() && (
              <p className="dispatch-hint">
                You can plan ahead, but a plan can only be committed on its
                service day.
              </p>
            )}

            {depot && depot.location_status === "verified" && (
              <p className="dispatch-depot-ok">
                <Icon name="check" size={15} /> {depot.name} location confirmed
                {depot.coordinate_source
                  ? ` (source: ${depot.coordinate_source})`
                  : ""}
                .
              </p>
            )}
            {depot && depot.location_status !== "verified" && (
              <DepotConfirm
                depotName={depot.name}
                depotId={depot.id}
                onDone={() => void reload()}
              />
            )}

            <p className="dispatch-open-orders">
              <Icon name="package" size={16} />
              {setup.pendingOrders == null
                ? "Open orders unknown"
                : `${setup.pendingOrders} open order${setup.pendingOrders === 1 ? "" : "s"}`}
              <span>Orders for other days are left out when you build.</span>
            </p>

            <fieldset className="dispatch-trucks">
              <legend>Trucks</legend>
              {!setup.trucks.length && (
                <p className="empty-small-copy">
                  No trucks are registered yet. Add a vehicle of type truck
                  first.
                </p>
              )}
              {setup.trucks.map((truck) => {
                const problem = truckProblem(truck, depotId);
                return (
                  <div className="dispatch-truck-row" key={truck.id}>
                    <label className="dispatch-check">
                      <input
                        type="checkbox"
                        disabled={problem != null}
                        checked={!!picked[truck.id]}
                        onChange={(e) =>
                          setPicked((prev) => ({
                            ...prev,
                            [truck.id]: e.target.checked,
                          }))
                        }
                      />
                      <span>
                        <strong>{truck.registration_number}</strong>
                        <small>
                          {problem ?? `${truck.capacity_kg} kg capacity`}
                        </small>
                      </span>
                    </label>
                    <label className="dispatch-driver">
                      <span>Driver</span>
                      <select
                        disabled={problem != null || !picked[truck.id]}
                        value={drivers[truck.id] ?? ""}
                        onChange={(e) =>
                          setDrivers((prev) => ({
                            ...prev,
                            [truck.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Choose a driver</option>
                        {setup.drivers.map((d) => (
                          <option
                            key={d.id}
                            value={d.id}
                            disabled={d.availability === "off_duty"}
                          >
                            {d.name}
                            {d.availability === "off_duty" ? " (off duty)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </fieldset>

            {blockers.length > 0 && (
              <ul className="dispatch-blockers">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <div className="dispatch-actions">
              <button
                type="button"
                className="button button-primary"
                disabled={building || blockers.length > 0}
                onClick={() => void build(false)}
              >
                Build routes <Icon name="arrow-right" size={16} />
              </button>
            </div>
          </section>
        )}

        {/* --------------------------------- review -------------------------------- */}
        {plan && !committed && summary && (
          <>
            <output className={`dispatch-quality tone-${summary.tone}`}>
              <Icon
                name={summary.tone === "good" ? "shield" : "warning"}
                size={18}
              />
              <div>
                <strong>{summary.tierText}</strong>
                <span>
                  {plan.quality.flood.status === "layer"
                    ? "A mapped flood-hazard layer was applied (static map, not live)."
                    : plan.quality.flood.status === "reports_only"
                      ? "Only verified road reports were used for flooding."
                      : "Flood risk is unknown, not zero."}{" "}
                  {summary.mixedWeights}.
                </span>
              </div>
            </output>

            {plan.warnings.length > 0 && (
              <ul className="dispatch-warnings">
                {plan.warnings.map((w) => (
                  <li key={w}>{warningCopy(w)}</li>
                ))}
              </ul>
            )}

            <section className="operations-kpis" aria-label="Plan summary">
              <div>
                <span>Trucks used</span>
                <strong>{summary.routes}</strong>
              </div>
              <div>
                <span>Orders planned</span>
                <strong>{summary.assigned}</strong>
              </div>
              <div>
                <span>Not planned</span>
                <strong>{summary.unassigned}</strong>
              </div>
              <div>
                <span>Total distance</span>
                <strong>{summary.km} km</strong>
              </div>
            </section>

            <div className="dispatch-review">
              <div className="dispatch-cards">
                {cards.map((card, index) => (
                  <article
                    className={`operations-panel dispatch-card route-${index % 4}${selected === card.vehicleId ? " is-selected" : ""}`}
                    key={card.vehicleId}
                  >
                    <header>
                      <span className="dispatch-letter" aria-hidden="true">
                        {card.letter}
                      </span>
                      <div>
                        <h3>
                          {card.label}
                          <span className="sr-only">
                            {" "}
                            (route {card.letter})
                          </span>
                        </h3>
                        <small>
                          {driverName(routeDrivers[index]) ??
                            (routeDrivers[index]
                              ? "Driver assigned"
                              : "No driver set")}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="button button-outline button-small"
                        aria-pressed={selected === card.vehicleId}
                        onClick={() =>
                          setSelected((s) =>
                            s === card.vehicleId ? null : card.vehicleId,
                          )
                        }
                      >
                        Highlight
                      </button>
                    </header>
                    <dl className="dispatch-metrics">
                      <div>
                        <dt>Orders</dt>
                        <dd>{card.orders}</dd>
                      </div>
                      <div>
                        <dt>Distance</dt>
                        <dd>{card.km} km</dd>
                      </div>
                      <div>
                        <dt>Out → back</dt>
                        <dd>
                          {card.depart} → {card.back}
                        </dd>
                      </div>
                      <div>
                        <dt>Peak load</dt>
                        <dd>
                          {card.loadPct == null
                            ? `${card.peakKg} kg`
                            : `${card.loadPct}% (${card.peakKg} kg)`}
                        </dd>
                      </div>
                    </dl>
                    {card.flags.length > 0 && (
                      <ul className="dispatch-chips">
                        {card.flags.map((f) => (
                          <li key={f.code}>
                            <Icon name="warning" size={13} /> {f.text}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="dispatch-summary">{card.summary}</p>
                    <details>
                      <summary>{card.stops.length} stops in order</summary>
                      <ol className="dispatch-stops">
                        {card.stops.map((stop) => (
                          <li
                            key={`${stop.order_id}-${stop.stop_type}`}
                            className={stop.stop_type}
                          >
                            <span className="dispatch-seq">{stop.seq}</span>
                            <div>
                              <strong>
                                {stop.typeLabel} · {stop.address}
                              </strong>
                              <small>
                                Arrive {stop.time}
                                {stop.windowLabel
                                  ? ` · window ${stop.windowLabel}`
                                  : ""}
                                {stop.load_after_kg != null
                                  ? ` · ${stop.load_after_kg} kg on board after`
                                  : ""}
                              </small>
                              {stop.leg_flood_km != null &&
                                stop.leg_flood_km > 0.05 && (
                                  <small className="dispatch-flood">
                                    {stop.leg_flood_km} km of the way here
                                    crosses a mapped flood-hazard zone (static
                                    map, not live)
                                  </small>
                                )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </article>
                ))}
                {!cards.length && (
                  <section className="operations-panel">
                    <h3>No orders could be placed</h3>
                    <p className="empty-small-copy">
                      See "Not planned" below for each reason.
                    </p>
                  </section>
                )}
              </div>

              <aside className="dispatch-side">
                {cards.length > 0 && (
                  <DispatchRoutesSketch
                    depot={plan.depot}
                    cards={cards}
                    selected={selected}
                    onSelect={(id) =>
                      setSelected((s) => (s === id ? null : id))
                    }
                  />
                )}
              </aside>
            </div>

            <section
              className="operations-panel dispatch-unplanned"
              aria-labelledby="unplanned-title"
            >
              <h2 id="unplanned-title">
                Not planned ({plan.unassigned.length})
              </h2>
              {plan.unassigned.length === 0 ? (
                <p className="empty-small-copy">Every order was placed.</p>
              ) : (
                <ul>
                  {plan.unassigned.map((order) => {
                    const copy = reasonCopy(order.unassigned_reason);
                    return (
                      <li key={order.order_id}>
                        <Icon name="warning" size={16} />
                        <div>
                          <strong>
                            {order.delivery_address ??
                              `Order ${shortId(order.order_id)}`}
                          </strong>
                          <span>{copy.title}</span>
                          {copy.hint && <small>{copy.hint}</small>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {plan.scheduledLater.length > 0 && (
                <p className="dispatch-hint">
                  {plan.scheduledLater.length} order
                  {plan.scheduledLater.length === 1 ? " has" : "s have"} a
                  pickup window on another day and{" "}
                  {plan.scheduledLater.length === 1 ? "was" : "were"} left out.
                </p>
              )}
              {plan.excludedTrucks.length > 0 && (
                <p className="dispatch-hint">
                  Trucks left out:{" "}
                  {plan.excludedTrucks
                    .map(
                      (t) =>
                        `${t.registration} (${TRUCK_EXCLUSION_COPY[t.reason] ?? t.reason})`,
                    )
                    .join(", ")}
                  .
                </p>
              )}
            </section>

            <details className="operations-panel dispatch-assumptions">
              <summary>What this plan is based on</summary>
              <p>{plan.basis}</p>
              <p>
                Weights:{" "}
                {Object.entries(
                  countBy(plan.orders.map((o) => o.weight_source)),
                )
                  .map(([k, v]) => `${v} ${WEIGHT_SOURCE_COPY[k] ?? k}`)
                  .join(", ")}
                .
              </p>
              <table>
                <caption>
                  Assumed numbers used for this plan. Placeholders until
                  measured.
                </caption>
                <tbody>
                  {plan.assumptions.map((a) => (
                    <tr key={a.key}>
                      <th scope="row">{a.label}</th>
                      <td>{formatValue(a.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dispatch-hint">
                Engine {plan.run.engineVersion}, seed {plan.run.seed},{" "}
                {plan.run.iterations} search steps ({plan.run.stopReason}).
              </p>
            </details>

            {outcome && !dialog && (
              <output className={`dispatch-outcome kind-${outcome.kind}`}>
                {outcome.text}
              </output>
            )}

            <footer className="dispatch-footer">
              <div>
                <strong>
                  {summary.assigned} orders · {summary.routes} trucks ·{" "}
                  {summary.km} km
                </strong>
                <span>
                  {synthetic
                    ? "Synthetic preview: commit is disabled."
                    : `Service day ${plan.serviceDate}${plan.serviceDate !== plan.today ? " (not today: commit on the day)" : ""}`}
                </span>
              </div>
              {!synthetic && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    setOutcome(null);
                    setDialog("discard");
                  }}
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                className="button button-primary"
                disabled={!!synthetic || !plan.run.id || summary.routes === 0}
                onClick={() => {
                  setOutcome(null);
                  setDialog("commit");
                }}
              >
                Commit routes
              </button>
            </footer>
          </>
        )}
      </div>

      {dialog === "commit" && plan && summary && (
        <ModalPanel
          titleId="commit-title"
          className="dispatch-dialog"
          onClose={() => setDialog(null)}
        >
          <h2 id="commit-title">Commit these routes?</h2>
          <p>
            Assign {summary.assigned} order{summary.assigned === 1 ? "" : "s"}{" "}
            to {summary.routes} driver{summary.routes === 1 ? "" : "s"}.{" "}
            {summary.unassigned > 0
              ? `${summary.unassigned} stay in the queue. `
              : ""}
            Drivers see their routes immediately.
          </p>
          {outcome && (
            <p className={`dispatch-outcome kind-${outcome.kind}`} role="alert">
              {outcome.text}
            </p>
          )}
          {stale.length > 0 && (
            <ul className="dispatch-stale">
              {stale.map((s) => (
                <li key={s.order_id}>
                  Order {shortId(s.order_id)}:{" "}
                  {STALE_COPY[s.change] ?? s.change}
                </li>
              ))}
            </ul>
          )}
          <div className="dispatch-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
            {stale.length > 0 ? (
              <button
                type="button"
                className="button button-primary"
                disabled={working}
                onClick={() => void commit("skip")}
              >
                Commit without {stale.length} changed order
                {stale.length === 1 ? "" : "s"}
              </button>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={working}
                onClick={() => void commit("abort")}
              >
                {working ? "Committing…" : "Commit routes"}
              </button>
            )}
          </div>
        </ModalPanel>
      )}

      {dialog === "discard" && (
        <ModalPanel
          titleId="discard-title"
          className="dispatch-dialog"
          onClose={() => setDialog(null)}
        >
          <h2 id="discard-title">Discard this draft?</h2>
          <p>No orders were assigned. You can build routes again afterwards.</p>
          <label className="dispatch-reason">
            Reason
            <input
              value={discardReason}
              onChange={(e) => setDiscardReason(e.target.value)}
              minLength={3}
            />
          </label>
          {outcome && (
            <p className={`dispatch-outcome kind-${outcome.kind}`} role="alert">
              {outcome.text}
            </p>
          )}
          <div className="dispatch-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => setDialog(null)}
            >
              Keep draft
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={working || discardReason.trim().length < 3}
              onClick={() => void discard()}
            >
              Discard draft
            </button>
          </div>
        </ModalPanel>
      )}
    </main>
  );
}

function truckProblem(
  truck: {
    status: string;
    capacity_kg: number | null;
    depot_id: string | null;
  },
  depotId: string | undefined,
) {
  if (!["available", "in_use"].includes(truck.status))
    return `Not available (${truck.status})`;
  if (truck.capacity_kg == null) return "Set a weight capacity first";
  if (truck.depot_id && depotId && truck.depot_id !== depotId)
    return "Based at another depot";
  return null;
}

function buildErrorCopy(error: ApiError) {
  switch (error.code) {
    case "depot_unverified":
      return "Confirm the depot location before planning routes.";
    case "draft_exists":
      return "A draft plan already exists for this depot and day.";
    case "no_open_orders":
      return "There are no open orders to plan.";
    case "no_eligible_trucks":
      return "None of the selected trucks can take orders. Check status and weight capacity.";
    case "too_many_orders":
      return error.message;
    case "forbidden":
    case "unauthenticated":
      return "Sign in as a manager to plan routes.";
    default:
      return error.message;
  }
}

function countBy(values: string[]) {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

function formatValue(value: unknown) {
  if (value != null && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
  return String(value);
}

function DepotConfirm({
  depotId,
  depotName,
  onDone,
}: {
  depotId: string;
  depotName: string;
  onDone: () => void;
}) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid =
    Number.isFinite(Number(lat)) &&
    lat !== "" &&
    Math.abs(Number(lat)) <= 90 &&
    Number.isFinite(Number(lng)) &&
    lng !== "" &&
    Math.abs(Number(lng)) <= 180 &&
    source.trim().length >= 3;

  async function save() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("set_depot_location", {
      p_depot_id: depotId,
      p_latitude: Number(lat),
      p_longitude: Number(lng),
      p_source: source.trim(),
      p_note: note.trim() || undefined,
    });
    setBusy(false);
    if (rpcError) setError(rpcError.message);
    else onDone();
  }

  return (
    <fieldset className="dispatch-depot-confirm">
      <legend>Confirm the {depotName} location</legend>
      <p className="dispatch-hint">
        Routes start and end here, so the pin must be the real warehouse gate.
        Nothing is planned until it is confirmed.
      </p>
      <div className="dispatch-field-row">
        <label>
          Latitude
          <input
            inputMode="decimal"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="e.g. 16.9"
          />
        </label>
        <label>
          Longitude
          <input
            inputMode="decimal"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="e.g. 96.1"
          />
        </label>
      </div>
      <label>
        Where the coordinates came from
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. surveyed at the gate"
        />
      </label>
      <label>
        Note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button button-dark"
        disabled={!valid || busy}
        onClick={() => void save()}
      >
        Confirm location
      </button>
    </fieldset>
  );
}
