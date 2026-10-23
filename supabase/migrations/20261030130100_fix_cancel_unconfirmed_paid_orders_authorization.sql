-- SECURITY DEFINER changes current_user to the function owner. Authorize
-- signed-in callers with the JWT actor instead, while still allowing pg_cron
-- and other trusted database roles (which have no auth.uid()) to run the job.

create or replace function public.cancel_unconfirmed_paid_orders(p_minutes integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancelled integer;
begin
  if (select auth.uid()) is not null and not (select private.is_manager()) then
    raise exception 'Only managers can run this' using errcode = '42501';
  end if;

  with stale as (
    update public.delivery_orders o
    set status = 'cancelled'
    where o.status in ('pending', 'assigned')
      and o.parcel_description ~* 'payment: prepaid (mmqr|ctzpay) \d+ MMK'
      and o.created_at < now() - make_interval(
        mins => greatest(p_minutes, 1)
          + case when o.parcel_description ~* 'pickup tomorrow' then 24 * 60 else 0 end
      )
    returning o.id
  )
  select count(*) into cancelled from stale;
  return cancelled;
end;
$$;

revoke all on function public.cancel_unconfirmed_paid_orders(integer) from public, anon;
grant execute on function public.cancel_unconfirmed_paid_orders(integer) to authenticated;
