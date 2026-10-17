-- El rol de nuevos avistamientos se deriva del perfil autenticado, no del formulario.
-- Requiere las migraciones de registro ampliado y CRUD. No reescribe datos históricos.
begin;

create or replace function public.submit_sighting(report_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  existing public.sighting_submissions;
  observed timestamptz;
  health text[];
  asset text;
  kind text;
begin
  -- Bloquea el perfil durante el alta para mantener permisos y rol consistentes.
  select role into actor_role from public.profiles where id = actor for share;
  if actor is null or coalesce(actor_role, '') not in ('community','researcher','admin') then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;
  if report_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Registro inválido'; end if;
  -- Ignora valores manipulados y admite clientes anteriores sin confiar en su rol.
  payload := payload - 'collaborator_role';
  perform pg_advisory_xact_lock(hashtextextended(report_id::text, 0));
  select * into existing from public.sighting_submissions where sighting_id = report_id;
  if found then
    if existing.reporter_id = actor and (existing.payload - 'collaborator_role') = payload then return report_id; end if;
    raise exception 'El identificador ya corresponde a otro envío' using errcode = 'P0002';
  end if;
  if coalesce(payload->>'sex', '') not in ('Hembra','Macho (claspers visibles)','No determinado')
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
  values (report_id, actor,
    case actor_role when 'community' then 'Pescador / Buzo' when 'researcher' then 'Científico / Investigador' when 'admin' then 'Administrador' end,
    payload->>'species', payload->>'species_other', btrim(payload->>'location_name'),
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

-- También protege el valor histórico ante ediciones directas por la API.
create function public.preserve_sighting_collaborator_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.collaborator_role is distinct from old.collaborator_role then
    raise exception 'El perfil del colaborador se conserva desde el registro original' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.preserve_sighting_collaborator_role() from public, anon, authenticated;
create trigger sightings_preserve_collaborator_role before update on public.sightings
  for each row execute function public.preserve_sighting_collaborator_role();

notify pgrst, 'reload schema';
commit;
