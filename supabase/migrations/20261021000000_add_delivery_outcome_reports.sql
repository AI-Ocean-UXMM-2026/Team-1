-- Rider-reported delivery outcomes: who received the parcel, why a delivery failed,
-- and how collected cash compared with the COD amount due. Delivery status and COD
-- status stay on their own tables; this record explains them.

create table public.delivery_outcome_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  driver_id uuid not null references public.driver_profiles (user_id) on delete cascade,
  outcome text not null check (outcome in ('delivered', 'failed')),
  recipient_name text check (recipient_name is null or char_length(trim(recipient_name)) between 1 and 120),
  failure_reason text check (
    failure_reason is null
    or failure_reason in (
      'recipient_unavailable', 'incorrect_address', 'recipient_refused',
      'recipient_unreachable', 'other'
    )
  ),
  note text check (note is null or char_length(note) <= 500),
  cod_expected numeric(12, 2) not null default 0 check (cod_expected >= 0),
  cod_collected numeric(12, 2) check (cod_collected is null or cod_collected >= 0),
  cod_discrepancy_reason text check (
    cod_discrepancy_reason is null or char_length(trim(cod_discrepancy_reason)) between 3 and 240
  ),
  reported_at timestamptz not null default now(),
  constraint delivery_outcome_reports_failure_has_reason check (
    (outcome = 'failed' and failure_reason is not null)
    or (outcome = 'delivered' and failure_reason is null)
  ),
  constraint delivery_outcome_reports_mismatch_has_reason check (
    cod_collected is null
    or cod_collected = cod_expected
    or cod_discrepancy_reason is not null
  )
);

create index delivery_outcome_reports_order_idx
  on public.delivery_outcome_reports (order_id, reported_at desc);
create index delivery_outcome_reports_driver_idx
  on public.delivery_outcome_reports (driver_id, reported_at desc);

alter table public.delivery_outcome_reports enable row level security;

create policy delivery_outcome_reports_read_access
  on public.delivery_outcome_reports for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or driver_id = (select auth.uid())
  );

-- Only the rider currently assigned to the order can report its outcome, and only as themself.
create policy delivery_outcome_reports_insert_driver
  on public.delivery_outcome_reports for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and (select private.is_assigned_driver(order_id))
  );

grant select, insert on public.delivery_outcome_reports to authenticated;
