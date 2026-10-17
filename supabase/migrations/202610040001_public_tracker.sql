-- Proyección pública del tracker: únicamente observaciones verificadas.
-- No concede acceso a la tabla, contactos, notas ni archivos privados.
begin;
create or replace function public.public_map_sightings(page_offset integer default 0)
returns table (
  id uuid, species text, location_name text, sighting_date date,
  sighting_time time, quantity integer, latitude double precision, longitude double precision
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.species, s.location_name, s.sighting_date, s.sighting_time,
    s.quantity, s.latitude, s.longitude
  from public.sightings s
  where s.status = 'verified'
    and s.latitude between -90 and 90 and s.longitude between -180 and 180
  order by s.sighting_date desc nulls last, s.id
  limit 500 offset greatest(page_offset, 0);
$$;
revoke all on function public.public_map_sightings(integer) from public;
grant execute on function public.public_map_sightings(integer) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
