-- Visibilidad pública independiente de la verificación: incluye pendientes con su estado real.
-- Aplicar después de 202610150003_obis_import_batches.sql. No modifica observaciones.
begin;
drop function public.public_map_sightings(integer);
create function public.public_map_sightings(page_offset integer default 0)
returns table (
  id uuid, species text, location_name text, sighting_date date, sighting_time time, quantity integer,
  latitude double precision, longitude double precision, source_name text, source_year integer, source_month integer,
  date_precision text, status text
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.species, s.location_name, s.sighting_date, s.sighting_time, s.quantity,
    s.latitude, s.longitude, s.source_name, s.source_year, s.source_month, s.date_precision, s.status::text
  from public.sightings s
  where s.status in ('pending','verified') and s.deleted_at is null
    and (s.import_batch_id is null or exists (
      select 1 from public.sighting_import_batches b where b.id = s.import_batch_id and b.status <> 'withdrawn'
    ))
    and s.latitude between -90 and 90 and s.longitude between -180 and 180
  order by s.sighting_date desc nulls last, s.id
  limit 500 offset greatest(page_offset, 0);
$$;
revoke all on function public.public_map_sightings(integer) from public;
grant execute on function public.public_map_sightings(integer) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
