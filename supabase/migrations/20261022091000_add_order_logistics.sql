-- Dispatch attributes for an order, kept in a 1:1 side table.
--
-- Why not columns on delivery_orders: drivers hold whole-table UPDATE and are
-- limited only by column allow-lists in guard triggers, and customers read
-- delivery_orders with select *. A side table with no client write path avoids
-- both problems. Values the customer or manager did not state are never
-- invented here; the planner applies and records its own assumptions.

create table public.delivery_order_logistics (
  order_id uuid primary key references public.delivery_orders (id) on delete cascade,
  origin_kind text not null default 'door' check (origin_kind in ('door', 'depot')),
  depot_id uuid references public.depots (id),
  parcel_size text check (parcel_size in ('small', 'medium', 'large')),
  size_source text check (size_source in ('declared', 'parsed_description')),
  fragile boolean not null default false,
  weight_kg numeric(9, 2) check (weight_kg > 0),
  weight_source text check (weight_source in ('declared', 'weighed')),
  volume_m3 numeric(9, 4) check (volume_m3 > 0),
  volume_source text check (volume_source in ('declared', 'measured')),
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  window_label text,
  window_source text check (window_source in ('declared', 'parsed_description')),
  delivery_deadline_at timestamptz,
  deadline_hard boolean not null default false,
  deadline_source text check (deadline_source in ('declared')),
  pickup_township_pcode text references public.service_areas (pcode),
  delivery_township_pcode text references public.service_areas (pcode),
  township_source text check (township_source in ('boundary', 'nearest_centroid', 'declared')),
  quoted_price_mmk numeric(12, 2) check (quoted_price_mmk >= 0),
  price_basis jsonb,
  price_is_estimate boolean,
  quoted_at timestamptz,
  backfill_source text,
  backfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint logistics_weight_has_source check ((weight_kg is null) = (weight_source is null)),
  constraint logistics_size_has_source check ((parcel_size is null) = (size_source is null)),
  constraint logistics_window_complete
    check ((pickup_window_start is null) = (pickup_window_end is null)),
  constraint logistics_window_ordered
    check (pickup_window_end is null or pickup_window_end > pickup_window_start),
  constraint logistics_window_has_source
    check ((pickup_window_start is null) = (window_source is null))
);

create index delivery_order_logistics_window_idx
  on public.delivery_order_logistics (pickup_window_start);

create trigger touch_delivery_order_logistics_updated_at
  before update on public.delivery_order_logistics
  for each row execute function private.touch_updated_at();

alter table public.delivery_order_logistics enable row level security;
revoke all on table public.delivery_order_logistics from public, anon;
grant select on table public.delivery_order_logistics to authenticated;

-- Visible exactly when the order is visible to the caller (the subselect runs
-- under the caller's own delivery_orders policies).
create policy delivery_order_logistics_read_access on public.delivery_order_logistics
  for select to authenticated
  using (
    exists (
      select 1 from public.delivery_orders as delivery_order
      where delivery_order.id = delivery_order_logistics.order_id
    )
  );

-- ------------------------------------------------------------------ parsing --

/**
 * Reads what the customer pickup form packs into parcel_description:
 * "<Kind>, <size> size[, fragile] · details · Pickup today|tomorrow, <window>".
 * Day is relative to created_at in Asia/Yangon. Windows: morning 08-12,
 * afternoon 12-17, evening 17-20 local time. Anything not found stays null.
 */
create or replace function private.parse_parcel_description(
  p_description text,
  p_created_at timestamptz
)
returns table (
  parcel_size text,
  fragile boolean,
  window_label text,
  window_start timestamptz,
  window_end timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
declare
  size_match text[];
  schedule_match text[];
  local_day date;
  start_hour integer;
  end_hour integer;
begin
  size_match := regexp_match(coalesce(p_description, ''), '(small|medium|large) size', 'i');
  schedule_match := regexp_match(
    coalesce(p_description, ''),
    'Pickup (today|tomorrow), (morning|afternoon|evening)',
    'i'
  );

  parcel_size := lower(size_match[1]);
  fragile := coalesce(p_description, '') ~* '\mfragile\M';
  window_label := null;
  window_start := null;
  window_end := null;

  if schedule_match is not null and p_created_at is not null then
    local_day := (p_created_at at time zone 'Asia/Yangon')::date;
    if lower(schedule_match[1]) = 'tomorrow' then
      local_day := local_day + 1;
    end if;
    case lower(schedule_match[2])
      when 'morning' then start_hour := 8; end_hour := 12;
      when 'afternoon' then start_hour := 12; end_hour := 17;
      else start_hour := 17; end_hour := 20;
    end case;
    window_label := initcap(lower(schedule_match[2]));
    window_start := (local_day + make_interval(hours => start_hour)) at time zone 'Asia/Yangon';
    window_end := (local_day + make_interval(hours => end_hour)) at time zone 'Asia/Yangon';
  end if;
  return next;
end;
$$;

revoke all on function private.parse_parcel_description(text, timestamptz)
  from public, anon, authenticated;

/**
 * Creates the logistics row for an order from its description and pins.
 * Origin is 'depot' when the pickup point is within 150 m of a verified depot.
 * Township is the nearest centroid within 15 km (assumed cut-off), tagged as
 * such; real boundary matching replaces it once boundaries are loaded.
 */
create or replace function private.seed_order_logistics(
  p_order_id uuid,
  p_backfill_source text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_order public.delivery_orders;
  parsed record;
  near_depot uuid;
  pickup_area text;
  delivery_area text;
begin
  select * into delivery_order from public.delivery_orders where id = p_order_id;
  if not found then
    return;
  end if;

  select * into parsed
  from private.parse_parcel_description(delivery_order.parcel_description, delivery_order.created_at);

  if delivery_order.pickup_latitude is not null and delivery_order.pickup_longitude is not null then
    select depot.id into near_depot
    from public.depots as depot
    where depot.is_active
      and depot.location_status = 'verified'
      and private.haversine_km(
        delivery_order.pickup_latitude, delivery_order.pickup_longitude,
        depot.latitude, depot.longitude
      ) <= 0.15
    order by depot.code
    limit 1;

    select area.pcode into pickup_area
    from public.service_areas as area
    where area.centroid_lat is not null
      and private.haversine_km(
        delivery_order.pickup_latitude, delivery_order.pickup_longitude,
        area.centroid_lat, area.centroid_lng
      ) <= 15
    order by private.haversine_km(
        delivery_order.pickup_latitude, delivery_order.pickup_longitude,
        area.centroid_lat, area.centroid_lng
      ), area.pcode
    limit 1;
  end if;

  if delivery_order.delivery_latitude is not null and delivery_order.delivery_longitude is not null then
    select area.pcode into delivery_area
    from public.service_areas as area
    where area.centroid_lat is not null
      and private.haversine_km(
        delivery_order.delivery_latitude, delivery_order.delivery_longitude,
        area.centroid_lat, area.centroid_lng
      ) <= 15
    order by private.haversine_km(
        delivery_order.delivery_latitude, delivery_order.delivery_longitude,
        area.centroid_lat, area.centroid_lng
      ), area.pcode
    limit 1;
  end if;

  insert into public.delivery_order_logistics (
    order_id, origin_kind, depot_id,
    parcel_size, size_source, fragile,
    weight_kg, weight_source,
    pickup_window_start, pickup_window_end, window_label, window_source,
    pickup_township_pcode, delivery_township_pcode, township_source,
    backfill_source, backfilled_at
  )
  values (
    p_order_id,
    case when near_depot is null then 'door' else 'depot' end,
    near_depot,
    parsed.parcel_size,
    case when parsed.parcel_size is null then null else 'parsed_description' end,
    coalesce(parsed.fragile, false),
    -- A legacy weight, if any path ever set one, is treated as declared.
    delivery_order.parcel_weight_kg,
    case when delivery_order.parcel_weight_kg is null then null else 'declared' end,
    parsed.window_start, parsed.window_end, parsed.window_label,
    case when parsed.window_start is null then null else 'parsed_description' end,
    pickup_area, delivery_area,
    case when pickup_area is null and delivery_area is null then null else 'nearest_centroid' end,
    p_backfill_source,
    case when p_backfill_source is null then null else now() end
  )
  on conflict (order_id) do nothing;
end;
$$;

revoke all on function private.seed_order_logistics(uuid, text)
  from public, anon, authenticated;

-- Order creation must never fail because of dispatch metadata.
create or replace function private.seed_order_logistics_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.seed_order_logistics(new.id, null);
  exception when others then
    raise warning 'delivery_order_logistics seed failed for %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function private.seed_order_logistics_trigger()
  from public, anon, authenticated;

create trigger seed_order_logistics_after_insert
  after insert on public.delivery_orders
  for each row execute function private.seed_order_logistics_trigger();

-- One-off backfill for orders that are still open.
select private.seed_order_logistics(delivery_order.id, 'description_parse_v1')
from public.delivery_orders as delivery_order
where delivery_order.status in ('pending', 'assigned', 'accepted', 'picked_up', 'in_transit');

-- --------------------------------------------------------- set_order_logistics --

/**
 * Manager correction of dispatch attributes. Only the keys below are accepted;
 * every value set here is recorded as declared. A reason is required.
 */
create or replace function public.set_order_logistics(
  p_order_id uuid,
  p_patch jsonb,
  p_reason text
)
returns public.delivery_order_logistics
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed constant text[] := array[
    'parcel_size', 'fragile', 'weight_kg', 'volume_m3',
    'pickup_window_start', 'pickup_window_end',
    'delivery_deadline_at', 'deadline_hard', 'origin_kind',
    'pickup_township_pcode', 'delivery_township_pcode'
  ];
  unknown_key text;
  result public.delivery_order_logistics;
begin
  if not (select private.is_manager()) then
    raise exception 'Only managers can change order logistics' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Patch must be a JSON object' using errcode = '22023';
  end if;
  select key into unknown_key
  from jsonb_object_keys(p_patch) as key
  where key <> all (allowed)
  limit 1;
  if unknown_key is not null then
    raise exception 'Unknown logistics field: %', unknown_key using errcode = '22023';
  end if;
  if not exists (select 1 from public.delivery_orders where id = p_order_id) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  perform private.seed_order_logistics(p_order_id, null);

  update public.delivery_order_logistics as logistics
  set parcel_size = case when p_patch ? 'parcel_size' then p_patch ->> 'parcel_size' else logistics.parcel_size end,
      size_source = case when p_patch ? 'parcel_size'
        then case when p_patch ->> 'parcel_size' is null then null else 'declared' end
        else logistics.size_source end,
      fragile = case when p_patch ? 'fragile' then coalesce((p_patch ->> 'fragile')::boolean, false) else logistics.fragile end,
      weight_kg = case when p_patch ? 'weight_kg' then (p_patch ->> 'weight_kg')::numeric else logistics.weight_kg end,
      weight_source = case when p_patch ? 'weight_kg'
        then case when p_patch ->> 'weight_kg' is null then null else 'declared' end
        else logistics.weight_source end,
      volume_m3 = case when p_patch ? 'volume_m3' then (p_patch ->> 'volume_m3')::numeric else logistics.volume_m3 end,
      volume_source = case when p_patch ? 'volume_m3'
        then case when p_patch ->> 'volume_m3' is null then null else 'declared' end
        else logistics.volume_source end,
      pickup_window_start = case when p_patch ? 'pickup_window_start' then (p_patch ->> 'pickup_window_start')::timestamptz else logistics.pickup_window_start end,
      pickup_window_end = case when p_patch ? 'pickup_window_end' then (p_patch ->> 'pickup_window_end')::timestamptz else logistics.pickup_window_end end,
      window_source = case when p_patch ? 'pickup_window_start' or p_patch ? 'pickup_window_end' then 'declared' else logistics.window_source end,
      window_label = case when p_patch ? 'pickup_window_start' or p_patch ? 'pickup_window_end' then null else logistics.window_label end,
      delivery_deadline_at = case when p_patch ? 'delivery_deadline_at' then (p_patch ->> 'delivery_deadline_at')::timestamptz else logistics.delivery_deadline_at end,
      deadline_source = case when p_patch ? 'delivery_deadline_at'
        then case when p_patch ->> 'delivery_deadline_at' is null then null else 'declared' end
        else logistics.deadline_source end,
      deadline_hard = case when p_patch ? 'deadline_hard' then coalesce((p_patch ->> 'deadline_hard')::boolean, false) else logistics.deadline_hard end,
      origin_kind = case when p_patch ? 'origin_kind' then p_patch ->> 'origin_kind' else logistics.origin_kind end,
      pickup_township_pcode = case when p_patch ? 'pickup_township_pcode' then p_patch ->> 'pickup_township_pcode' else logistics.pickup_township_pcode end,
      delivery_township_pcode = case when p_patch ? 'delivery_township_pcode' then p_patch ->> 'delivery_township_pcode' else logistics.delivery_township_pcode end,
      township_source = case when p_patch ? 'pickup_township_pcode' or p_patch ? 'delivery_township_pcode' then 'declared' else logistics.township_source end
  where logistics.order_id = p_order_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.set_order_logistics(uuid, jsonb, text) from public, anon;
grant execute on function public.set_order_logistics(uuid, jsonb, text) to authenticated;
