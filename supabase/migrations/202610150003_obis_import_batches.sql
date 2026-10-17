-- Importación administrativa de CSV OBIS. Aplicar después de las migraciones anteriores.
-- Conserva filas originales, datos incompletos y duplicados. No publica automáticamente.
begin;

create table public.sighting_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'OBIS' check (source = 'OBIS'),
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_hash text not null unique,
  row_count integer not null,
  duplicate_count integer not null default 0,
  quality_summary jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','withdrawn')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawn_by uuid references auth.users(id) on delete set null
);
alter table public.sighting_import_batches enable row level security;
revoke all on public.sighting_import_batches from public, anon, authenticated;
grant select on public.sighting_import_batches to authenticated;
create policy import_batches_admin on public.sighting_import_batches for select to authenticated
  using ((select public.galeotrack_role()) = 'admin');

alter table public.sightings
  add column import_batch_id uuid references public.sighting_import_batches(id),
  add column import_row_number integer,
  add column source_name text,
  add column source_date text,
  add column source_year integer,
  add column source_month integer,
  add column date_precision text check (date_precision in ('day','month','year','unknown')),
  add column quality_flags text[],
  add column import_withdrawn_at timestamptz;
create unique index sightings_import_row_idx on public.sightings(import_batch_id, import_row_number)
  where import_batch_id is not null;

-- Los originales se mantienen en una tabla privada, no en la proyección pública.
create table public.sighting_import_rows (
  sighting_id uuid primary key references public.sightings(id) on delete cascade,
  batch_id uuid not null references public.sighting_import_batches(id),
  row_number integer not null,
  raw_record jsonb not null,
  duplicate_of_row integer,
  unique(batch_id, row_number)
);
alter table public.sighting_import_rows enable row level security;
revoke all on public.sighting_import_rows from public, anon, authenticated;
grant select on public.sighting_import_rows to authenticated;
create policy import_rows_admin on public.sighting_import_rows for select to authenticated
  using ((select public.galeotrack_role()) = 'admin');

create function public.import_obis_batch(file_name text, records jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); batch uuid; existing uuid; fingerprint text;
  entry record; raw jsonb; row_id uuid; row_hash text; seen jsonb := '{}'; duplicate_row integer;
  name text; lat double precision; lon double precision; amount integer; raw_amount text;
  raw_date text; raw_year text; date_value date; year_value integer; month_value integer; precision_value text;
  flags text[]; duplicates integer := 0; missing_dates integer := 0; partial_dates integer := 0; invalid_years integer := 0;
begin
  if actor is null or public.galeotrack_role() is distinct from 'admin' then
    raise exception 'Solo administración puede importar registros' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(file_name,''))) not between 1 and 200
    or jsonb_typeof(records) is distinct from 'array' then raise exception 'Archivo de importación inválido'; end if;
  if jsonb_array_length(records) not between 1 and 5000 or octet_length(records::text) > 5242880 then
    raise exception 'El lote debe contener entre 1 y 5000 filas y no superar 5 MB';
  end if;
  fingerprint := md5(records::text);
  perform pg_advisory_xact_lock(hashtextextended(fingerprint, 0));
  select id into existing from public.sighting_import_batches where content_hash = fingerprint;
  if found then return existing; end if;
  insert into public.sighting_import_batches(file_name, content_hash, row_count, created_by)
    values (btrim(file_name), fingerprint, jsonb_array_length(records), actor) returning id into batch;

  for entry in select value, ordinality::integer as row_no from jsonb_array_elements(records) with ordinality loop
    raw := entry.value;
    if jsonb_typeof(raw) is distinct from 'object' or upper(btrim(coalesce(raw->>'Fuente/datos',''))) <> 'OBIS' then
      raise exception 'Fila %: fuente OBIS no válida', entry.row_no;
    end if;
    name := btrim(coalesce(raw->>'Scientific Name',''));
    if char_length(name) not between 3 and 200 then raise exception 'Fila %: nombre científico inválido', entry.row_no; end if;
    begin
      lat := (nullif(btrim(raw->>'Decimal Latitude'),''))::double precision;
      lon := (nullif(btrim(raw->>'Decimal Longitude'),''))::double precision;
      if lat is null or lon is null or not (lat between -90 and 90) or not (lon between -180 and 180) then
        raise exception 'Coordenadas fuera de rango';
      end if;
    exception when others then raise exception 'Fila %: coordenadas inválidas', entry.row_no; end;
    amount := null; raw_amount := btrim(coalesce(raw->>'Individual Count',''));
    if raw_amount <> '' then
      if raw_amount !~ '^[0-9]+([.]0+)?$' or raw_amount::numeric not between 1 and 2147483647 then
        raise exception 'Fila %: cantidad inválida', entry.row_no;
      end if;
      amount := raw_amount::numeric::integer;
    end if;

    -- No se infiere salud, comportamiento, autor ni una hora local a partir de fechas externas.
    flags := array['taxonomy_unreviewed','license_not_provided','coordinate_uncertainty_not_provided','source_identifier_not_provided','count_requires_source_check'];
    if nullif(btrim(raw->>'locality'),'') is null then flags := array_append(flags,'missing_locality'); end if;
    if amount is null then flags := array_append(flags,'missing_count'); end if;
    raw_date := btrim(coalesce(raw->>'Event Date','')); raw_year := btrim(coalesce(raw->>'Year',''));
    date_value := null; year_value := null; month_value := null; precision_value := 'unknown';
    if raw_year ~ '^[0-9]{4}([.]0+)?$' and split_part(raw_year,'.',1)::integer between 1 and 9999 then
      year_value := split_part(raw_year,'.',1)::integer; precision_value := 'year';
    elsif raw_year <> '' then flags := array_append(flags,'invalid_source_year'); invalid_years := invalid_years + 1;
    end if;
    if raw_date ~ '^[0-9]{4}[-_](0[1-9]|1[0-2])$' then
      year_value := substring(raw_date,1,4)::integer; month_value := substring(raw_date,6,2)::integer;
      if year_value < 1 then raise exception 'Fila %: año inválido', entry.row_no; end if;
      precision_value := 'month'; partial_dates := partial_dates + 1; flags := array_append(flags,'partial_date');
    elsif raw_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}($|T)' then
      begin
        date_value := substring(raw_date,1,10)::date;
        if date_value > current_date then raise exception 'Fecha futura'; end if;
        if year_value is not null and year_value <> extract(year from date_value)::integer then flags := array_append(flags,'year_mismatch'); end if;
        year_value := extract(year from date_value)::integer; month_value := extract(month from date_value)::integer;
        precision_value := 'day';
        if position('T' in raw_date) > 0 then flags := array_append(flags,'source_time_not_interpreted'); end if;
      exception when others then date_value := null; flags := array_append(flags,'invalid_source_date'); end;
    elsif raw_date <> '' then flags := array_append(flags,'invalid_source_date');
    else flags := array_append(flags,'missing_date'); missing_dates := missing_dates + 1;
    end if;
    row_hash := md5(raw::text); duplicate_row := (seen->>row_hash)::integer;
    if duplicate_row is not null then
      flags := array_append(flags,'possible_duplicate'); duplicates := duplicates + 1;
    else seen := seen || jsonb_build_object(row_hash,entry.row_no);
    end if;
    insert into public.sightings(species, reporter_id, collaborator_role, location_name, sighting_date, quantity,
      latitude, longitude, status, import_batch_id, import_row_number, source_name, source_date, source_year, source_month, date_precision, quality_flags)
    values (name, null, null, nullif(btrim(raw->>'locality'),''), date_value, amount,
      lat, lon, 'pending', batch, entry.row_no, 'OBIS', nullif(raw_date,''), year_value, month_value, precision_value, flags)
    returning id into row_id;
    insert into public.sighting_import_rows(sighting_id,batch_id,row_number,raw_record,duplicate_of_row)
      values(row_id,batch,entry.row_no,raw,duplicate_row);
  end loop;
  update public.sighting_import_batches set duplicate_count = duplicates,
    quality_summary = jsonb_build_object('missing_dates',missing_dates,'partial_dates',partial_dates,'invalid_years',invalid_years)
    where id = batch;
  return batch;
end $$;
revoke all on function public.import_obis_batch(text,jsonb) from public, anon;
grant execute on function public.import_obis_batch(text,jsonb) to authenticated;

create function public.set_obis_batch_withdrawn(batch_id uuid, withdraw boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare target public.sighting_import_batches; affected integer; stamp timestamptz := clock_timestamp();
begin
  if auth.uid() is null or public.galeotrack_role() is distinct from 'admin' or withdraw is null then
    raise exception 'Solo administración puede retirar o restaurar lotes' using errcode = '42501';
  end if;
  select * into target from public.sighting_import_batches where id = batch_id for update;
  if not found then raise exception 'Lote no encontrado'; end if;
  if (withdraw and target.status = 'withdrawn') or (not withdraw and target.status = 'pending') then return 0; end if;
  if withdraw then
    update public.sightings set deleted_at = stamp, import_withdrawn_at = stamp, updated_at = stamp
      where import_batch_id = batch_id and deleted_at is null;
    get diagnostics affected = row_count;
    update public.sighting_import_batches set status = 'withdrawn', withdrawn_at = stamp, withdrawn_by = auth.uid() where id = batch_id;
  else
    -- Solo restaura filas retiradas por este lote, no las eliminadas individualmente antes.
    update public.sighting_import_batches set status = 'pending', withdrawn_at = null, withdrawn_by = null where id = batch_id;
    update public.sightings set deleted_at = null, import_withdrawn_at = null,
      status = 'pending', verified_by = null, verified_at = null, updated_at = stamp
      where import_batch_id = batch_id and import_withdrawn_at = target.withdrawn_at and deleted_at = target.withdrawn_at;
    get diagnostics affected = row_count;
  end if;
  return affected;
end $$;
revoke all on function public.set_obis_batch_withdrawn(uuid,boolean) from public, anon;
grant execute on function public.set_obis_batch_withdrawn(uuid,boolean) to authenticated;

create function public.guard_imported_sighting() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.import_batch_id is not null and new.deleted_at is null and exists (
    select 1 from public.sighting_import_batches where id = new.import_batch_id and status = 'withdrawn'
  ) then raise exception 'El lote está retirado; restáuralo desde la gestión de importaciones' using errcode = '42501'; end if;
  if row(old.import_batch_id,old.import_row_number,old.source_name,old.source_date,old.source_year,old.source_month,old.date_precision,old.quality_flags)
    is distinct from row(new.import_batch_id,new.import_row_number,new.source_name,new.source_date,new.source_year,new.source_month,new.date_precision,new.quality_flags) then
    raise exception 'La procedencia del registro no se puede cambiar' using errcode = '42501';
  end if;
  if old.import_batch_id is not null and
    (to_jsonb(old) - array['status','verified_by','verified_at','deleted_at','updated_at','import_withdrawn_at']) is distinct from
    (to_jsonb(new) - array['status','verified_by','verified_at','deleted_at','updated_at','import_withdrawn_at']) then
    raise exception 'El registro importado conserva sus datos originales; retira el lote si contiene errores' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_imported_sighting() from public, anon, authenticated;
create trigger sightings_guard_import before update on public.sightings for each row execute function public.guard_imported_sighting();

-- Amplía solo la proyección segura para distinguir OBIS y mostrar fechas parciales.
drop function public.public_map_sightings(integer);
create function public.public_map_sightings(page_offset integer default 0)
returns table (
  id uuid, species text, location_name text, sighting_date date, sighting_time time, quantity integer,
  latitude double precision, longitude double precision, source_name text, source_year integer, source_month integer, date_precision text
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.species, s.location_name, s.sighting_date, s.sighting_time, s.quantity,
    s.latitude, s.longitude, s.source_name, s.source_year, s.source_month, s.date_precision
  from public.sightings s
  where s.status = 'verified' and s.deleted_at is null
    and (s.import_batch_id is null or exists (select 1 from public.sighting_import_batches b where b.id = s.import_batch_id and b.status <> 'withdrawn'))
    and s.latitude between -90 and 90 and s.longitude between -180 and 180
  order by s.sighting_date desc nulls last, s.id limit 500 offset greatest(page_offset, 0);
$$;
revoke all on function public.public_map_sightings(integer) from public;
grant execute on function public.public_map_sightings(integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
