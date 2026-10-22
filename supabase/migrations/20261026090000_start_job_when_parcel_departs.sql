-- A driver can run several jobs in one shift. The route session only becomes
-- 'in_progress' once a day, so start_job_with_route_session never fires for
-- the second job. Start a claimed job when its first parcel leaves for delivery.

create or replace function private.start_job_when_parcel_departs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.delivery_jobs%rowtype;
begin
  select job.* into target
  from public.delivery_queue as queue
  join public.delivery_jobs as job on job.id = queue.job_id
  where queue.order_id = new.id and job.status = 'claimed'
  for update of job;
  if not found then
    return null;
  end if;

  update public.delivery_jobs
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = target.id;

  update public.delivery_routes
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = target.route_id and status = 'planned';

  return null;
end;
$$;

revoke all on function private.start_job_when_parcel_departs() from public, anon, authenticated;

create trigger start_job_when_parcel_departs
  after update of status on public.delivery_orders
  for each row
  when (new.status = 'in_transit' and old.status is distinct from 'in_transit')
  execute function private.start_job_when_parcel_departs();
