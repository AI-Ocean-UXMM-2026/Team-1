-- Proof-of-delivery photos: a private storage bucket plus one row per parcel.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-proof',
  'delivery-proof',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create table public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique
    references public.delivery_orders (id) on delete cascade,
  driver_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index delivery_proofs_driver_id_idx on public.delivery_proofs (driver_id);

alter table public.delivery_proofs enable row level security;

-- Drivers add proof only for parcels assigned to them.
create policy delivery_proofs_driver_insert
  on public.delivery_proofs for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and exists (
      select 1
      from public.delivery_assignments a
      where a.order_id = delivery_proofs.order_id
        and a.driver_id = (select auth.uid())
    )
  );

-- A retry after a dropped response replaces the same parcel's photo.
create policy delivery_proofs_driver_update
  on public.delivery_proofs for update to authenticated
  using (driver_id = (select auth.uid()))
  with check (driver_id = (select auth.uid()));

create policy delivery_proofs_read_access
  on public.delivery_proofs for select to authenticated
  using (
    driver_id = (select auth.uid())
    or (select private.is_manager())
    or (select private.is_support())
  );

grant select, insert, update on public.delivery_proofs to authenticated;

-- Files live under <driver id>/<request id>.jpg.
create policy delivery_proof_objects_driver_write
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'delivery-proof'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy delivery_proof_objects_driver_replace
  on storage.objects for update to authenticated
  using (
    bucket_id = 'delivery-proof'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'delivery-proof'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy delivery_proof_objects_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'delivery-proof'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_manager())
      or (select private.is_support())
    )
  );
