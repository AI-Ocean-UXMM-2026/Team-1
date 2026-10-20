-- Add FK indexes and consolidate RLS rules to keep scans and policy evaluation efficient.

create index cod_payments_collected_by_idx on public.cod_payments (collected_by);
create index delivery_assignments_assigned_by_idx on public.delivery_assignments (assigned_by);
create index delivery_notifications_order_idx on public.delivery_notifications (order_id);
create index delivery_orders_created_by_idx on public.delivery_orders (created_by);
create index delivery_routes_created_by_idx on public.delivery_routes (created_by);
create index delivery_routes_vehicle_idx on public.delivery_routes (vehicle_id);
create index delivery_status_events_changed_by_idx on public.delivery_status_events (changed_by);

drop policy driver_profiles_manager_all on public.driver_profiles;
drop policy driver_profiles_driver_read_self on public.driver_profiles;
drop policy driver_profiles_driver_update_self on public.driver_profiles;
create policy driver_profiles_read_access on public.driver_profiles for select to authenticated
  using ((select private.is_manager()) or user_id = (select auth.uid()));
create policy driver_profiles_insert_manager on public.driver_profiles for insert to authenticated
  with check ((select private.is_manager()));
create policy driver_profiles_update_access on public.driver_profiles for update to authenticated
  using ((select private.is_manager()) or user_id = (select auth.uid()))
  with check ((select private.is_manager()) or user_id = (select auth.uid()));
create policy driver_profiles_delete_manager on public.driver_profiles for delete to authenticated
  using ((select private.is_manager()));

drop policy vehicles_manager_all on public.vehicles;
drop policy vehicles_assigned_driver_read on public.vehicles;
drop policy vehicles_assigned_driver_update on public.vehicles;
create policy vehicles_read_access on public.vehicles for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_assignments as assignment
      where assignment.vehicle_id = id
        and assignment.driver_id = (select auth.uid())
        and assignment.ended_at is null
    )
  );
create policy vehicles_insert_manager on public.vehicles for insert to authenticated
  with check ((select private.is_manager()));
create policy vehicles_update_access on public.vehicles for update to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_assignments as assignment
      where assignment.vehicle_id = id
        and assignment.driver_id = (select auth.uid())
        and assignment.ended_at is null
    )
  )
  with check (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_assignments as assignment
      where assignment.vehicle_id = id
        and assignment.driver_id = (select auth.uid())
        and assignment.ended_at is null
    )
  );
create policy vehicles_delete_manager on public.vehicles for delete to authenticated
  using ((select private.is_manager()));

drop policy delivery_routes_manager_all on public.delivery_routes;
drop policy delivery_routes_driver_read on public.delivery_routes;
create policy delivery_routes_read_access on public.delivery_routes for select to authenticated
  using ((select private.is_manager()) or driver_id = (select auth.uid()));
create policy delivery_routes_insert_manager on public.delivery_routes for insert to authenticated
  with check ((select private.is_manager()));
create policy delivery_routes_update_manager on public.delivery_routes for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy delivery_routes_delete_manager on public.delivery_routes for delete to authenticated
  using ((select private.is_manager()));

drop policy delivery_orders_manager_all on public.delivery_orders;
drop policy delivery_orders_customer_read on public.delivery_orders;
drop policy delivery_orders_assigned_driver_read on public.delivery_orders;
drop policy delivery_orders_manager_insert on public.delivery_orders;
drop policy delivery_orders_assigned_driver_update on public.delivery_orders;
create policy delivery_orders_read_access on public.delivery_orders for select to authenticated
  using (
    (select private.is_manager())
    or customer_id = (select auth.uid())
    or (select private.is_assigned_driver(id))
  );
create policy delivery_orders_insert_manager on public.delivery_orders for insert to authenticated
  with check ((select private.is_manager()) and created_by = (select auth.uid()));
create policy delivery_orders_update_access on public.delivery_orders for update to authenticated
  using ((select private.is_manager()) or (select private.is_assigned_driver(id)))
  with check ((select private.is_manager()) or (select private.is_assigned_driver(id)));
create policy delivery_orders_delete_manager on public.delivery_orders for delete to authenticated
  using ((select private.is_manager()));

drop policy delivery_assignments_manager_all on public.delivery_assignments;
drop policy delivery_assignments_driver_read on public.delivery_assignments;
drop policy delivery_assignments_customer_read on public.delivery_assignments;
create policy delivery_assignments_read_access on public.delivery_assignments for select to authenticated
  using (
    (select private.is_manager())
    or driver_id = (select auth.uid())
    or (select private.owns_order(order_id))
  );
create policy delivery_assignments_insert_manager on public.delivery_assignments for insert to authenticated
  with check ((select private.is_manager()));
create policy delivery_assignments_update_manager on public.delivery_assignments for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy delivery_assignments_delete_manager on public.delivery_assignments for delete to authenticated
  using ((select private.is_manager()));

drop policy route_stops_manager_all on public.route_stops;
drop policy route_stops_driver_read on public.route_stops;
drop policy route_stops_driver_update on public.route_stops;
create policy route_stops_read_access on public.route_stops for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_routes as route
      where route.id = route_id and route.driver_id = (select auth.uid())
    )
  );
create policy route_stops_insert_manager on public.route_stops for insert to authenticated
  with check ((select private.is_manager()));
create policy route_stops_update_access on public.route_stops for update to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_routes as route
      where route.id = route_id and route.driver_id = (select auth.uid())
    )
  )
  with check (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_routes as route
      where route.id = route_id and route.driver_id = (select auth.uid())
    )
  );
create policy route_stops_delete_manager on public.route_stops for delete to authenticated
  using ((select private.is_manager()));

drop policy delivery_locations_manager_read on public.delivery_locations;
drop policy delivery_locations_driver_read on public.delivery_locations;
drop policy delivery_locations_customer_live_read on public.delivery_locations;
create policy delivery_locations_read_access on public.delivery_locations for select to authenticated
  using (
    (select private.is_manager())
    or driver_id = (select auth.uid())
    or (
      (select private.owns_order(order_id))
      and exists (
        select 1 from public.delivery_orders as delivery_order
        where delivery_order.id = order_id
          and delivery_order.status in ('picked_up', 'in_transit')
      )
    )
  );

drop policy cod_payments_manager_all on public.cod_payments;
drop policy cod_payments_customer_read on public.cod_payments;
drop policy cod_payments_assigned_driver_read on public.cod_payments;
drop policy cod_payments_assigned_driver_insert on public.cod_payments;
create policy cod_payments_read_access on public.cod_payments for select to authenticated
  using (
    (select private.is_manager())
    or (select private.owns_order(order_id))
    or (select private.is_assigned_driver(order_id))
  );
create policy cod_payments_insert_access on public.cod_payments for insert to authenticated
  with check (
    (select private.is_manager())
    or (
      collected_by = (select auth.uid())
      and (select private.is_assigned_driver(order_id))
    )
  );
create policy cod_payments_update_manager on public.cod_payments for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

drop policy delivery_status_events_manager_read on public.delivery_status_events;
drop policy delivery_status_events_customer_read on public.delivery_status_events;
drop policy delivery_status_events_driver_read on public.delivery_status_events;
create policy delivery_status_events_read_access on public.delivery_status_events for select to authenticated
  using (
    (select private.is_manager())
    or (select private.owns_order(order_id))
    or (select private.is_assigned_driver(order_id))
  );

drop policy delivery_notifications_manager_all on public.delivery_notifications;
drop policy delivery_notifications_customer_read on public.delivery_notifications;
create policy delivery_notifications_read_access on public.delivery_notifications for select to authenticated
  using (
    (select private.is_manager())
    or (recipient_id = (select auth.uid()) and (select private.owns_order(order_id)))
  );
create policy delivery_notifications_insert_manager on public.delivery_notifications for insert to authenticated
  with check ((select private.is_manager()));
create policy delivery_notifications_update_manager on public.delivery_notifications for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy delivery_notifications_delete_manager on public.delivery_notifications for delete to authenticated
  using ((select private.is_manager()));
