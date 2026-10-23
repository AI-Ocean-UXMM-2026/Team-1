-- Sandbox payment: while the setting is on, anyone with a parcel's tracking
-- code can "pay" its balance. No money moves; the order's cash due drops to
-- zero and a prepaid note is recorded, so the rider's view updates live.
-- Managers switch this off before real payments are connected.

create table public.payment_settings (
  id boolean primary key default true check (id),
  sandbox boolean not null default true
);
insert into public.payment_settings (id, sandbox) values (true, true);

alter table public.payment_settings enable row level security;

create policy payment_settings_read on public.payment_settings
  for select to anon, authenticated using (true);
create policy payment_settings_manager_update on public.payment_settings
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

grant select on public.payment_settings to anon, authenticated;
grant update on public.payment_settings to authenticated;

create or replace function public.sandbox_pay_order(
  p_tracking_code text,
  p_method text default 'mmqr'
)
returns table (paid numeric, cod_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.delivery_orders;
  amount numeric;
  note text;
  previous text[];
  label text := case when p_method = 'ctzpay' then 'CTZPay' else 'MMQR' end;
begin
  if not coalesce((select sandbox from public.payment_settings where id), false) then
    raise exception 'Sandbox payments are turned off' using errcode = '42501';
  end if;

  select * into o
  from public.delivery_orders
  where tracking_code = upper(trim(p_tracking_code))
  for update;
  if not found then
    raise exception 'Parcel not found' using errcode = '22023';
  end if;
  if o.status in ('delivered', 'failed', 'cancelled') then
    raise exception 'This delivery is closed' using errcode = '22023';
  end if;
  if o.cod_amount <= 0 then
    raise exception 'Nothing is left to pay' using errcode = '22023';
  end if;

  amount := o.cod_amount;
  previous := regexp_match(coalesce(o.parcel_description, ''), 'payment: prepaid (?:mmqr|ctzpay) (\d+) MMK', 'i');
  if previous is not null then
    note := regexp_replace(
      o.parcel_description,
      'payment: prepaid (mmqr|ctzpay) \d+ MMK',
      'Payment: prepaid ' || label || ' ' || (previous[1]::numeric + amount)::bigint || ' MMK',
      'i'
    );
  else
    note := concat_ws(' · ', nullif(o.parcel_description, ''),
      'Payment: prepaid ' || label || ' ' || amount::bigint || ' MMK');
  end if;

  update public.delivery_orders
  set cod_amount = 0,
      cod_status = 'not_required',
      parcel_description = note
  where id = o.id;

  return query select amount, 0::numeric;
end;
$$;

revoke all on function public.sandbox_pay_order(text, text) from public;
grant execute on function public.sandbox_pay_order(text, text) to anon, authenticated;
