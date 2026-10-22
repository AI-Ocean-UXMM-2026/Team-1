-- Guard delivery intelligence columns: revert route_progress_percent, traffic_delay_minutes,
-- eta_confidence, and eta_updated_at to OLD values for non-managers.

create or replace function private.guard_delivery_order_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();

  -- Trusted server and manager writes may edit all order fields.
  if (select private.is_manager()) or current_user not in ('authenticated', 'anon') then
    if new.status = 'delivered' and old.status is distinct from 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
    return new;
  end if;

  if (select auth.uid()) is null or not (select private.is_assigned_driver(old.id)) then
    raise exception 'Only the assigned driver or a manager can update this order';
  end if;

  -- Revert intelligence columns to OLD values for non-managers
  new.route_progress_percent := old.route_progress_percent;
  new.traffic_delay_minutes := old.traffic_delay_minutes;
  new.eta_confidence := old.eta_confidence;
  new.eta_updated_at := old.eta_updated_at;

  if new.id is distinct from old.id
    or new.tracking_code is distinct from old.tracking_code
    or new.customer_id is distinct from old.customer_id
    or new.created_by is distinct from old.created_by
    or new.pickup_address is distinct from old.pickup_address
    or new.pickup_latitude is distinct from old.pickup_latitude
    or new.pickup_longitude is distinct from old.pickup_longitude
    or new.pickup_contact_name is distinct from old.pickup_contact_name
    or new.pickup_contact_phone is distinct from old.pickup_contact_phone
    or new.delivery_address is distinct from old.delivery_address
    or new.delivery_latitude is distinct from old.delivery_latitude
    or new.delivery_longitude is distinct from old.delivery_longitude
    or new.recipient_name is distinct from old.recipient_name
    or new.recipient_phone is distinct from old.recipient_phone
    or new.parcel_description is distinct from old.parcel_description
    or new.parcel_weight_kg is distinct from old.parcel_weight_kg
    or new.cod_amount is distinct from old.cod_amount
    or new.cod_status is distinct from old.cod_status
    or new.estimated_delivery_at is distinct from old.estimated_delivery_at
    or new.delivered_at is distinct from old.delivered_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Drivers can only update delivery status';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'assigned' and new.status in ('accepted', 'failed', 'cancelled'))
    or (old.status = 'accepted' and new.status in ('picked_up', 'failed', 'cancelled'))
    or (old.status = 'picked_up' and new.status in ('in_transit', 'failed'))
    or (old.status = 'in_transit' and new.status in ('delivered', 'failed'))
  ) then
    raise exception 'Invalid delivery status transition: % to %', old.status, new.status;
  end if;

  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.guard_delivery_order_update() from public, anon, authenticated;
