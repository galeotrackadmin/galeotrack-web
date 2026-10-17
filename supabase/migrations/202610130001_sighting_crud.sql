-- CRUD seguro: el autor gestiona sus reportes; administración gestiona todos.
-- El borrado lógico conserva los datos para informes y análisis posteriores.
begin;

alter table public.sightings add column if not exists deleted_at timestamptz;
create index if not exists sightings_active_created_idx on public.sightings(created_at desc, id) where deleted_at is null;

drop policy if exists sightings_read on public.sightings;
create policy sightings_read on public.sightings for select to authenticated
  using ((select public.galeotrack_role()) = 'admin' or
    ((select public.galeotrack_role()) in ('student','community','researcher') and deleted_at is null));

drop policy if exists sighting_contacts_read on public.sighting_contacts;
create policy sighting_contacts_read on public.sighting_contacts for select to authenticated using (
  (select public.galeotrack_role()) = 'admin' or
  (exists (select 1 from public.sightings s where s.id = sighting_id and s.deleted_at is null and
    ((select public.galeotrack_role()) = 'researcher' or s.reporter_id = (select auth.uid()))))
);

drop policy if exists sightings_create on public.sightings;
create policy sightings_create on public.sightings for insert to authenticated
  with check ((select public.galeotrack_role()) in ('community','researcher','admin') and reporter_id = (select auth.uid())
    and status = 'pending' and verified_by is null and verified_at is null and deleted_at is null);

drop policy if exists sightings_review on public.sightings;
create policy sightings_update on public.sightings for update to authenticated
  using ((select public.galeotrack_role()) = 'admin' or
    ((select public.galeotrack_role()) in ('community','researcher') and reporter_id = (select auth.uid()) and deleted_at is null))
  with check ((select public.galeotrack_role()) = 'admin' or
    ((select public.galeotrack_role()) in ('community','researcher') and reporter_id = (select auth.uid()) and status = 'pending' and verified_by is null and verified_at is null and deleted_at is null));

create function public.guard_sighting_owner_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor_role text := public.galeotrack_role();
begin
  if actor_role = 'admin' then return new; end if;
  if actor_role not in ('community','researcher') or old.reporter_id is distinct from auth.uid() or old.deleted_at is not null then
    raise exception 'No tienes permiso para editar este avistamiento' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.reporter_id is distinct from old.reporter_id
    or new.created_at is distinct from old.created_at or new.deleted_at is distinct from old.deleted_at then
    raise exception 'No puedes cambiar la autoría ni el historial del avistamiento' using errcode = '42501';
  end if;
  -- La edición del autor requiere una nueva revisión científica.
  new.status := 'pending';
  new.verified_by := null;
  new.verified_at := null;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.guard_sighting_owner_update() from public, anon, authenticated;
create trigger sightings_guard_owner_update before update on public.sightings
  for each row execute function public.guard_sighting_owner_update();

create function public.delete_sighting(report_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role text := public.galeotrack_role();
begin
  if actor is null or actor_role not in ('community','researcher','admin') then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;
  update public.sightings set deleted_at = now(), updated_at = now()
    where id = report_id and deleted_at is null
      and (actor_role = 'admin' or reporter_id = actor);
  return found;
end $$;
revoke all on function public.delete_sighting(uuid) from public, anon;
grant execute on function public.delete_sighting(uuid) to authenticated;

create or replace function public.public_map_sightings(page_offset integer default 0)
returns table (
  id uuid, species text, location_name text, sighting_date date,
  sighting_time time, quantity integer, latitude double precision, longitude double precision
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.species, s.location_name, s.sighting_date, s.sighting_time,
    s.quantity, s.latitude, s.longitude
  from public.sightings s
  where s.status = 'verified' and s.deleted_at is null
    and s.latitude between -90 and 90 and s.longitude between -180 and 180
  order by s.sighting_date desc nulls last, s.id
  limit 500 offset greatest(page_offset, 0);
$$;
revoke all on function public.public_map_sightings(integer) from public;
grant execute on function public.public_map_sightings(integer) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
