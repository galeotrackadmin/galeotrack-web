-- Requiere 202609280001_community_platform.sql y el esquema base de sightings.
-- Ejecutar en SQL Editor de Supabase. No modifica los registros históricos.
begin;

alter table public.sightings
  add column collaborator_role text,
  add column sighting_time time,
  add column observed_at timestamptz,
  add column species_other text,
  add column total_length_m numeric check (total_length_m > 0 and total_length_m <= 30.48),
  add column fork_length_m numeric check (fork_length_m > 0 and fork_length_m <= 30.48),
  add column standard_length_m numeric check (standard_length_m > 0 and standard_length_m <= 30.48),
  add column interdorsal_length_m numeric check (interdorsal_length_m > 0 and interdorsal_length_m <= 30.48),
  add column sex text check (sex in ('Hembra', 'Macho (claspers visibles)', 'No determinado')),
  add column behavior_other text,
  add column health_conditions text[],
  add column health_other text,
  add column altitude double precision check (altitude between -12000 and 10000),
  add column accuracy double precision check (accuracy between 0 and 20000000),
  add column photo_path text,
  add column video_path text;

create index sightings_coordinates_idx on public.sightings(latitude, longitude) where latitude is not null and longitude is not null;

create table public.sighting_contacts (
  sighting_id uuid primary key references public.sightings(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text check (char_length(phone) <= 40),
  consented_at timestamptz not null default now()
);
alter table public.sighting_contacts enable row level security;
revoke all on public.sighting_contacts from anon, authenticated;
grant select on public.sighting_contacts to authenticated;
create policy sighting_contacts_read on public.sighting_contacts for select to authenticated using (
  (select public.galeotrack_role()) in ('admin', 'researcher') or
  exists (select 1 from public.sightings s where s.id = sighting_id and s.reporter_id = (select auth.uid()))
);

-- Recibo privado para reintentos idempotentes; nunca se expone en mapas ni listados.
create table public.sighting_submissions (
  sighting_id uuid primary key references public.sightings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id),
  payload jsonb not null
);
alter table public.sighting_submissions enable row level security;
revoke all on public.sighting_submissions from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sighting-evidence', 'sighting-evidence', false, 52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']);

create policy sighting_evidence_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'sighting-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.galeotrack_role()) in ('community','researcher','admin')
);
create policy sighting_evidence_read on storage.objects for select to authenticated using (
  bucket_id = 'sighting-evidence' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or
    ((select public.galeotrack_role()) in ('student','community','researcher','admin') and
      exists (select 1 from public.sightings s where s.photo_path = name or s.video_path = name))
  )
);
create policy sighting_evidence_cleanup on storage.objects for delete to authenticated using (
  bucket_id = 'sighting-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.sightings s where s.photo_path = name or s.video_path = name)
);

-- Alta atómica: no se permite saltar validaciones, autoría, contacto o estado inicial.
drop policy sightings_create on public.sightings;
revoke insert on public.sightings from authenticated;

create function public.submit_sighting(report_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.sighting_submissions;
  observed timestamptz;
  health text[];
  asset text;
  kind text;
begin
  if actor is null or coalesce(public.galeotrack_role(), '') not in ('community','researcher','admin') then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;
  if report_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Registro inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(report_id::text, 0));
  select * into existing from public.sighting_submissions where sighting_id = report_id;
  if found then
    if existing.reporter_id = actor and existing.payload = payload then return report_id; end if;
    raise exception 'El identificador ya corresponde a otro envío' using errcode = 'P0002';
  end if;
  if coalesce(payload->>'collaborator_role', '') not in ('Científico / Investigador','Buzo','Pescador')
    or coalesce(payload->>'sex', '') not in ('Hembra','Macho (claspers visibles)','No determinado')
    or coalesce(payload->>'behavior', '') not in ('Nadando tranquilamente','Alimentándose / cazando','Comportamiento curioso','Comportamiento evasivo','Comportamiento territorial / agresivo','Nado errático','Otro')
    or coalesce(payload->>'species', '') not in (
      'Tiburón gata (Ginglymostoma cirratum)', 'Tiburón de arrecife del Caribe (Carcharhinus perezi)',
      'Tiburón tigre (Galeocerdo cuvier)', 'Tiburón martillo (Sphyrna spp.)', 'Tiburón toro (Carcharhinus leucas)',
      'Tiburón punta blanca de arrecife (Triaenodon obesus)', 'Tiburón sedoso (Carcharhinus falciformis)',
      'Tiburón zorro común (Alopias vulpinus)', 'Tiburón de arenales (Carcharhinus plumbeus)',
      'Tiburón limón (Negaprion brevirostris)', 'Tiburón de punta prieta (Carcharhinus limbatus)',
      'Tiburón cornuda gigante (Sphyrna mokarran)', 'Tiburón hocicudo del Caribe (Rhizoprionodon porosus)', 'Otro', 'No identificado')
  then raise exception 'Selecciona opciones válidas'; end if;
  if coalesce(char_length(btrim(payload->>'location_name')), 0) not between 2 and 200
    or coalesce(payload->>'quantity','') !~ '^[0-9]+$' or (payload->>'quantity')::bigint not between 1 and 2147483647
    or coalesce(payload->>'sighting_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(payload->>'sighting_time', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
    or (coalesce((payload->>'latitude')::double precision between -90 and 90, false) is false)
    or (coalesce((payload->>'longitude')::double precision between -180 and 180, false) is false)
  then raise exception 'Fecha, cantidad o ubicación inválida'; end if;
  observed := ((payload->>'sighting_date')::date + (payload->>'sighting_time')::time) at time zone 'America/Puerto_Rico';
  if observed > now() then raise exception 'La observación no puede estar en el futuro'; end if;
  if jsonb_typeof(payload->'health_conditions') is distinct from 'array' then raise exception 'Indica la salud observada'; end if;
  select array_agg(v) into health from jsonb_array_elements_text(payload->'health_conditions') as t(v);
  if coalesce(cardinality(health), 0) not between 1 and 6 or not health <@ array['Sano / sin marcas visibles','Ectoparásitos visibles','Heridas o cicatrices','Anzuelo / red / basura enganchada','Desconocido / no fue posible observar bien','Otro']
    or cardinality(health) <> (select count(distinct v) from unnest(health) as t(v))
    or (cardinality(health) > 1 and health && array['Sano / sin marcas visibles','Desconocido / no fue posible observar bien'])
  then raise exception 'Condiciones de salud incompatibles'; end if;
  if (payload->>'species' = 'Otro' and coalesce(char_length(btrim(payload->>'species_other')), 0) < 2)
    or (payload->>'behavior' = 'Otro' and coalesce(char_length(btrim(payload->>'behavior_other')), 0) < 2)
    or ('Otro' = any(health) and coalesce(char_length(btrim(payload->>'health_other')), 0) < 2)
    or char_length(payload->>'species_other') > 200 or char_length(payload->>'behavior_other') > 1000
    or char_length(payload->>'health_other') > 1000 or char_length(payload->>'notes') > 3000
  then raise exception 'Completa los detalles de la observación'; end if;
  foreach kind in array array['photo','video'] loop
    asset := payload->>(kind || '_path');
    if asset is not null then
      if asset not like actor::text || '/' || report_id::text || '/' || kind || '-%'
        or not exists (select 1 from storage.objects o where o.bucket_id = 'sighting-evidence' and o.name = asset
          and (o.metadata->>'mimetype') like case when kind = 'photo' then 'image/%' else 'video/%' end)
      then raise exception 'Evidencia no disponible'; end if;
    end if;
  end loop;
  insert into public.sightings (id, reporter_id, collaborator_role, species, species_other, location_name, sighting_date, sighting_time, observed_at, quantity,
    total_length_m, fork_length_m, standard_length_m, interdorsal_length_m, sex, behavior, behavior_other, health_conditions, health_other,
    notes, latitude, longitude, altitude, accuracy, photo_path, video_path, status)
  values (report_id, actor, payload->>'collaborator_role', payload->>'species', payload->>'species_other', btrim(payload->>'location_name'),
    (payload->>'sighting_date')::date, (payload->>'sighting_time')::time, observed, (payload->>'quantity')::integer,
    (payload->>'total_length_m')::numeric, (payload->>'fork_length_m')::numeric, (payload->>'standard_length_m')::numeric, (payload->>'interdorsal_length_m')::numeric,
    payload->>'sex', payload->>'behavior', payload->>'behavior_other', health, payload->>'health_other', payload->>'notes',
    (payload->>'latitude')::double precision, (payload->>'longitude')::double precision,
    (payload->>'altitude')::double precision, (payload->>'accuracy')::double precision, payload->>'photo_path', payload->>'video_path', 'pending');
  if payload->'contact' is not null and payload->'contact' <> 'null'::jsonb then
    if jsonb_typeof(payload->'contact') <> 'object' then raise exception 'Contacto inválido'; end if;
    insert into public.sighting_contacts(sighting_id, name, email, phone)
      values (report_id, btrim(payload->'contact'->>'name'), btrim(payload->'contact'->>'email'), nullif(btrim(payload->'contact'->>'phone'), ''));
  end if;
  insert into public.sighting_submissions values (report_id, actor, payload);
  return report_id;
end $$;
revoke all on function public.submit_sighting(uuid,jsonb) from public, anon;
grant execute on function public.submit_sighting(uuid,jsonb) to authenticated;

-- Cupo global para la búsqueda de lugares: como máximo una petición / 1,1 s.
create table public.geocoding_throttle (id boolean primary key default true check (id), next_request_at timestamptz not null default now());
insert into public.geocoding_throttle(id) values (true);
alter table public.geocoding_throttle enable row level security;
revoke all on public.geocoding_throttle from public, anon, authenticated;
create function public.claim_geocoding_request() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(public.galeotrack_role(),'') not in ('community','researcher','admin') then return false; end if;
  update public.geocoding_throttle set next_request_at = clock_timestamp() + interval '1.1 seconds' where id and next_request_at <= clock_timestamp();
  return found;
end $$;
revoke all on function public.claim_geocoding_request() from public, anon;
grant execute on function public.claim_geocoding_request() to authenticated;
commit;
