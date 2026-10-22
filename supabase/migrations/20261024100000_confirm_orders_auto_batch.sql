-- Managers confirm pickup requests; automation does the rest.
--
-- confirm_orders() queues the confirmed orders and immediately clusters the
-- waiting queue into open jobs on the driver job board. Drivers take jobs
-- themselves (claim_delivery_job); managers can no longer assign a driver.

create or replace function public.confirm_orders(p_order_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  confirmed integer := 0;
  new_batch uuid;
  batch_row public.job_batches;
begin
  if actor is null or not (select private.is_manager()) then
    raise exception 'Only managers can confirm orders' using errcode = '42501';
  end if;
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    return jsonb_build_object('confirmed', 0, 'jobs', 0, 'orders', 0);
  end if;

  with inserted as (
    insert into public.delivery_queue (order_id, queued_by)
    select delivery_order.id, actor
    from public.delivery_orders as delivery_order
    where delivery_order.id = any (p_order_ids)
      and delivery_order.status = 'pending'
    on conflict (order_id) do nothing
    returning 1
  )
  select count(*) into confirmed from inserted;

  if confirmed = 0 then
    return jsonb_build_object('confirmed', 0, 'jobs', 0, 'orders', 0);
  end if;

  new_batch := private.build_job_batch('automation', actor);
  select * into batch_row from public.job_batches where id = new_batch;
  return jsonb_build_object(
    'confirmed', confirmed,
    'jobs', batch_row.job_count,
    'orders', batch_row.order_count
  );
end;
$$;

revoke all on function public.confirm_orders(uuid[]) from public, anon;
grant execute on function public.confirm_orders(uuid[]) to authenticated;

-- Drivers claim jobs from the board; nobody assigns them by hand.
revoke execute on function public.assign_delivery(uuid, uuid, uuid) from authenticated;
