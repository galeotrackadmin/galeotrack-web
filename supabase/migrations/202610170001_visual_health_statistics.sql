-- Amplía los agregados existentes sin modificar observaciones ni ampliar permisos.
-- Requiere 202610160001_sighting_statistics.sql y sus migraciones anteriores.
begin;

create or replace function public.sighting_statistics(
  selected_status text default 'verified', selected_source text default 'all',
  selected_year integer default null, selected_taxon text default null,
  own_only boolean default false, exclude_duplicates boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role text := public.galeotrack_role(); result jsonb;
begin
  if actor is null or coalesce(actor_role,'') not in ('student','researcher','community','admin') then
    raise exception 'No tienes acceso a las estadísticas' using errcode = '42501';
  end if;
  if selected_status is null or selected_status not in ('all','pending','verified','rejected')
    or selected_source is null or selected_source not in ('all','community','obis','other','unknown')
    or (selected_year is not null and selected_year not between 0 and 9999)
    or char_length(selected_taxon) > 200 or own_only is null or exclude_duplicates is null then
    raise exception 'Filtros de estadísticas inválidos';
  end if;

  with base as materialized (
    select s.status,
      case when upper(btrim(coalesce(s.source_name,''))) = 'OBIS' then 'obis'
        when s.import_batch_id is not null or nullif(btrim(s.source_name),'') is not null then 'other'
        when s.reporter_id is not null then 'community' else 'unknown' end as source_key,
      case when s.sighting_date is not null then extract(year from s.sighting_date)::integer
        when s.date_precision in ('year','month') and s.source_year between 1 and 9999 then s.source_year else null end as event_year,
      coalesce(case when s.species = 'Otro' then nullif(btrim(s.species_other),'') end,
        nullif(btrim(s.species),''), 'Sin identificar') as taxon,
      s.sighting_date is null as incomplete_date,
      s.sighting_date is null and s.date_precision in ('month','year') and s.source_year between 1 and 9999 as partial_date,
      (s.latitude between -90 and 90 and s.longitude between -180 and 180) is not true as missing_coordinates,
      'possible_duplicate' = any(coalesce(s.quality_flags,'{}')) as possible_duplicate,
      'taxonomy_unreviewed' = any(coalesce(s.quality_flags,'{}')) as taxonomy_unreviewed,
      coalesce(cardinality(s.quality_flags),0) > 0 as flagged,
      -- Una clasificación por registro, nunca ponderada por quantity.
      -- «Sin marcas» no es un diagnóstico. Nulos, desconocidos y contradicciones van aparte.
      case when s.health_conditions = array['Sano / sin marcas visibles']::text[] then 'without_marks'
        when cardinality(s.health_conditions) > 0
          and array_position(s.health_conditions, null) is null
          and s.health_conditions <@ array['Ectoparásitos visibles','Heridas o cicatrices','Anzuelo / red / basura enganchada','Otro']::text[]
          and (not ('Otro' = any(s.health_conditions)) or coalesce(char_length(btrim(s.health_other)),0) >= 2)
          then 'with_signs'
        else 'unknown' end as health_key,
      coalesce(s.health_conditions,'{}'::text[]) as health_conditions
    from public.sightings s
    where s.deleted_at is null
      and (not own_only or s.reporter_id = actor)
      and (s.import_batch_id is null or exists (
        select 1 from public.sighting_import_batches b where b.id = s.import_batch_id and b.status <> 'withdrawn'
      ))
  ), filtered as materialized (
    select *, lower(taxon) not in ('sin identificar','no identificado','especie desconocida','otro') as identified
    from base where (selected_status = 'all' or status = selected_status)
      and (selected_source = 'all' or source_key = selected_source)
      and (selected_year is null or (selected_year = 0 and event_year is null) or event_year = selected_year)
      and (nullif(btrim(selected_taxon),'') is null or taxon = btrim(selected_taxon))
      and (not exclude_duplicates or not possible_duplicate)
  ), year_counts as (
    select event_year, count(*) as count from filtered group by event_year
  ), taxon_counts as (
    select taxon, count(*) as count, row_number() over (order by count(*) desc, taxon) as position
    from filtered group by taxon
  ), chart_taxa as (
    select taxon as label, count, position from taxon_counts where position <= 8
    union all select 'Otros grupos', sum(count)::bigint, 9 from taxon_counts where position > 8 having count(*) > 0
  ), source_counts as (
    select source_key, count(*) as count from filtered group by source_key
  )
  select jsonb_build_object(
    'total', count(*),
    'pending', count(*) filter (where status = 'pending'),
    'verified', count(*) filter (where status = 'verified'),
    'rejected', count(*) filter (where status = 'rejected'),
    'distinct_taxa', count(distinct taxon) filter (where identified),
    'years_with_records', count(distinct event_year),
    'quality', jsonb_build_object(
      'without_year', count(*) filter (where event_year is null),
      'incomplete_date', count(*) filter (where incomplete_date),
      'partial_date', count(*) filter (where partial_date),
      'missing_coordinates', count(*) filter (where missing_coordinates),
      'possible_duplicates', count(*) filter (where possible_duplicate),
      'taxonomy_unreviewed', count(*) filter (where taxonomy_unreviewed),
      'unidentified', count(*) filter (where not identified),
      'with_warnings', count(*) filter (where flagged or incomplete_date or missing_coordinates or not identified)
    ),
    'by_year', coalesce((select jsonb_agg(jsonb_build_object('year',event_year,'count',count) order by event_year nulls last) from year_counts),'[]'),
    'by_taxon', coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by position) from chart_taxa),'[]'),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('source',source_key,'count',count) order by source_key) from source_counts),'[]'),
    'visual_health', jsonb_build_object(
      'without_marks', count(*) filter (where health_key = 'without_marks'),
      'with_signs', count(*) filter (where health_key = 'with_signs'),
      'unknown', count(*) filter (where health_key = 'unknown'),
      'signs', jsonb_build_object(
        'wounds', count(*) filter (where health_key = 'with_signs' and 'Heridas o cicatrices' = any(health_conditions)),
        'entanglement', count(*) filter (where health_key = 'with_signs' and 'Anzuelo / red / basura enganchada' = any(health_conditions)),
        'parasites', count(*) filter (where health_key = 'with_signs' and 'Ectoparásitos visibles' = any(health_conditions)),
        'other', count(*) filter (where health_key = 'with_signs' and 'Otro' = any(health_conditions))
      )
    ),
    'options', jsonb_build_object(
      'years', coalesce((select jsonb_agg(event_year order by event_year desc) from (select distinct event_year from base where event_year is not null) y),'[]'),
      'taxa', coalesce((select jsonb_agg(taxon order by taxon) from (select distinct taxon from base) t),'[]')
    ),
    'batches', case when actor_role = 'admin' then (
      select jsonb_build_object('active',count(*) filter (where status = 'pending'), 'withdrawn',count(*) filter (where status = 'withdrawn'))
      from public.sighting_import_batches
    ) else null end,
    'generated_at', statement_timestamp()
  ) into result from filtered;
  return result;
end $$;

revoke all on function public.sighting_statistics(text,text,integer,text,boolean,boolean) from public, anon;
grant execute on function public.sighting_statistics(text,text,integer,text,boolean,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
