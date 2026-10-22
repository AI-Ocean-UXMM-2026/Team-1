-- Fix seller insert policy: allow sellers to create orders for any customer
-- without requiring customer_id = auth.uid().

drop policy if exists delivery_orders_insert_access on public.delivery_orders;
create policy delivery_orders_insert_access on public.delivery_orders for insert to authenticated
  with check (
    ((select private.is_manager()) and created_by = (select auth.uid()))
    or (
      (select private.is_seller())
      and created_by = (select auth.uid())
    )
  );
