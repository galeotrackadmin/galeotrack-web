import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { PGlite } from '@electric-sql/pglite'
import { defaultStatisticsFilters, loadSightingStatistics } from '../lib/sightings/statistics.ts'

const empty = {
  total: 0, pending: 0, verified: 0, rejected: 0, distinct_taxa: 0, years_with_records: 0,
  quality: { without_year: 0, incomplete_date: 0, partial_date: 0, missing_coordinates: 0, possible_duplicates: 0, taxonomy_unreviewed: 0, unidentified: 0, with_warnings: 0 },
  by_year: [], by_taxon: [], by_source: [], options: { years: [], taxa: [] }, batches: null, generated_at: '2026-10-16T00:00:00Z',
}

test('estadísticas: valores iniciales por modo y validación de respuestas completas, vacías y fallidas', async () => {
  assert.equal(defaultStatisticsFilters('student').status, 'verified')
  assert.equal(defaultStatisticsFilters('researcher').status, 'verified')
  assert.equal(defaultStatisticsFilters('community').ownOnly, true)
  assert.equal(defaultStatisticsFilters('admin').status, 'all')
  let payload = empty; let status = 200; let request
  const client = createClient('https://statistics.example.test', 'public-key', { auth: { persistSession: false }, global: { fetch: async (url, init) => {
    request = JSON.parse(init.body)
    return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  } } })
  assert.deepEqual(await loadSightingStatistics(client, defaultStatisticsFilters('student')), empty)
  const zeroHealth = { without_marks: 0, with_signs: 0, unknown: 0, signs: { wounds: 0, entanglement: 0, parasites: 0, other: 0 } }
  payload = { ...empty, visual_health: zeroHealth }
  assert.deepEqual((await loadSightingStatistics(client, defaultStatisticsFilters('student'))).visual_health, zeroHealth)
  payload = { ...empty, visual_health: { ...zeroHealth, unknown: 1 } }
  await assert.rejects(loadSightingStatistics(client, defaultStatisticsFilters('student')), /salud visual/)
  payload = { ...empty, visual_health: { ...zeroHealth, signs: { ...zeroHealth.signs, wounds: 1 } } }
  await assert.rejects(loadSightingStatistics(client, defaultStatisticsFilters('student')), /salud visual/)
  assert.equal(request.own_only, false)
  assert.equal(request.selected_status, 'verified')
  assert.equal(Object.hasOwn(request, 'reporter_id'), false, 'only the authenticated uid defines the personal scope')
  payload = { total: 0 }
  await assert.rejects(loadSightingStatistics(client, defaultStatisticsFilters('student')), /incompletas/)
  payload = { ...empty, total: 1 }
  await assert.rejects(loadSightingStatistics(client, defaultStatisticsFilters('student')), /totales/)
  payload = { code: 'PGRST202' }; status = 404
  await assert.rejects(loadSightingStatistics(client, defaultStatisticsFilters('student')), /202610160001/)
  payload = { message: 'Database unavailable' }; status = 503
  await assert.rejects(loadSightingStatistics(client, defaultStatisticsFilters('student')), /No se pudieron/)
})

test('estadísticas SQL: más de 1000 registros, fuentes, fechas parciales, permisos y exclusión de retirados', async () => {
  const db = new PGlite()
  const admin = '00000000-0000-4000-8000-000000000001'
  const community = '00000000-0000-4000-8000-000000000002'
  const researcher = '00000000-0000-4000-8000-000000000003'
  const student = '00000000-0000-4000-8000-000000000004'
  const pending = '00000000-0000-4000-8000-000000000005'
  const unassigned = '00000000-0000-4000-8000-000000000006'
  const activeBatch = '10000000-0000-4000-8000-000000000001'
  const withdrawnBatch = '10000000-0000-4000-8000-000000000002'
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated;
      create table profiles(id uuid primary key,role text);
      create function public.galeotrack_role() returns text language sql stable security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() $$;
      create table sighting_import_batches(id uuid primary key,status text);
      create table sightings(id uuid primary key default gen_random_uuid(),status text,reporter_id uuid,species text,species_other text,sighting_date date,
        import_batch_id uuid,source_name text,source_year integer,date_precision text,quality_flags text[],latitude double precision,longitude double precision,deleted_at timestamptz,
        health_conditions text[],health_other text,quantity integer);
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/202610160001_sighting_statistics.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/202610170001_visual_health_statistics.sql', import.meta.url), 'utf8'))
    for (const [id, role] of [[admin, 'admin'], [community, 'community'], [researcher, 'researcher'], [student, 'student'], [pending, 'pending_scientist'], [unassigned, 'unassigned']]) await db.query('insert into profiles values($1,$2)', [id, role])
    await db.query("insert into sighting_import_batches values($1,'pending'),($2,'withdrawn')", [activeBatch, withdrawnBatch])
    await db.query("insert into sightings(status,reporter_id,species,sighting_date,latitude,longitude) select 'verified',$1,case when n=1 then 'Carcharhinus' else 'Ginglymostoma cirratum' end,'2026-01-10',18,-67 from generate_series(1,1205) n", [community])
    await db.query(`insert into sightings(status,species,import_batch_id,source_name,source_year,date_precision,quality_flags,latitude,longitude) values
      ('verified','Carcharhinus',$1,'OBIS',2021,'month',array['possible_duplicate','taxonomy_unreviewed'],18,-67),
      ('verified','Squalus cubensis',$1,'OBIS',2020,'year',array['taxonomy_unreviewed'],18,-67),
      ('verified','Registro retirado',$2,'OBIS',2010,'year','{}',18,-67)`, [activeBatch, withdrawnBatch])
    await db.query("insert into sightings(status,species,import_batch_id,source_name,sighting_date,latitude,longitude) values('pending','No identificado',$1,'OBIS','2019-06-01',18,-67)", [activeBatch])
    await db.exec("insert into sightings(status) values('pending'); insert into sightings(status,species,deleted_at) values('verified','Eliminado',now())")
    const samples = (await db.query('select id from sightings where reporter_id=$1 order by id limit 7', [community])).rows
    for (const [index, conditions, other] of [
      [0, ['Sano / sin marcas visibles'], null],
      [1, ['Heridas o cicatrices', 'Anzuelo / red / basura enganchada'], null],
      [2, ['Ectoparásitos visibles'], null],
      [3, ['Otro'], 'Detalle privado que nunca debe salir en los agregados'],
      [4, ['Sano / sin marcas visibles', 'Heridas o cicatrices'], null],
      [5, ['Dato no reconocido'], null],
      [6, ['Otro'], null],
    ]) await db.query('update sightings set health_conditions=$1,health_other=$2,quantity=100 where id=$3', [conditions, other, samples[index].id])
    await db.exec("update sightings set health_conditions=array['Sano / sin marcas visibles'] where deleted_at is not null or species='Registro retirado'")

    async function as(id, run, role = 'authenticated') {
      await db.exec(`set role ${role}`)
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ''])
      try { return await run() } finally { await db.exec('reset role') }
    }
    const query = async (filters = {}) => (await db.query('select public.sighting_statistics($1,$2,$3,$4,$5,$6) as stats', [filters.status ?? 'all', filters.source ?? 'all', filters.year ?? null, filters.taxon ?? null, filters.mine ?? false, filters.excludeDuplicates ?? false])).rows[0].stats
    for (const id of [pending, unassigned, null]) await as(id, async () => { await assert.rejects(query(), /acceso/) })
    await as(null, async () => { await assert.rejects(query()) }, 'anon')
    await as(admin, async () => {
      const stats = await query()
      assert.equal(stats.total, 1209)
      assert.equal(stats.verified, 1207)
      assert.equal(stats.pending, 2)
      assert.deepEqual(stats.visual_health, { without_marks: 1, with_signs: 3, unknown: 1205, signs: { wounds: 1, entanglement: 1, parasites: 1, other: 1 } }, 'health counts records, not quantity, and overlapping signs only count once in the pie')
      assert.ok(!JSON.stringify(stats).includes('Detalle privado'))
      assert.equal(stats.distinct_taxa, 3, 'named genera are groups, not confirmed species; unknown labels are excluded')
      assert.equal(stats.quality.without_year, 1)
      assert.equal(stats.quality.partial_date, 2)
      assert.equal(stats.quality.incomplete_date, 3)
      assert.equal(stats.quality.possible_duplicates, 1)
      assert.deepEqual(stats.batches, { active: 1, withdrawn: 1 })
      assert.equal(stats.by_year.find((point) => point.year === 2021).count, 1)
      assert.equal(stats.by_year.find((point) => point.year === null).count, 1)
      assert.equal(stats.by_source.find((point) => point.source === 'community').count, 1205)
      assert.equal(stats.by_source.find((point) => point.source === 'unknown').count, 1)
      for (const series of [stats.by_source, stats.by_year, stats.by_taxon]) assert.equal(series.reduce((sum, point) => sum + point.count, 0), stats.total)
      assert.equal((await query({ source: 'obis' })).total, 3)
      assert.equal((await query({ source: 'obis' })).visual_health.unknown, 3, 'OBIS health is unknown, not healthy')
      assert.equal((await query({ status: 'pending' })).visual_health.unknown, 2)
      assert.equal((await query({ year: 2021, excludeDuplicates: true })).visual_health.unknown, 0)
      assert.equal((await query({ source: 'obis', year: 2021 })).total, 1)
      assert.equal((await query({ year: 0 })).total, 1)
      assert.equal((await query({ taxon: 'Carcharhinus' })).total, 2)
      assert.equal((await query({ excludeDuplicates: true })).total, 1208)
      assert.equal((await query({ year: 2021, excludeDuplicates: true })).total, 0)
      assert.equal((await query({ mine: true })).total, 0)
      await assert.rejects(query({ status: 'fake' }), /inválidos/)
      await assert.rejects(query({ year: -1 }), /inválidos/)
    })
    await as(community, async () => {
      const stats = await query({ mine: true })
      assert.equal(stats.total, 1205)
      assert.equal(stats.visual_health.without_marks, 1)
      assert.equal(stats.visual_health.with_signs, 3)
      assert.equal(stats.visual_health.unknown, 1201)
      assert.equal(stats.batches, null)
      assert.equal(stats.options.taxa.includes('Squalus cubensis'), false, 'personal options do not leak records outside the personal scope')
    })
    for (const id of [student, researcher]) await as(id, async () => {
      const stats = await query({ status: 'verified' })
      assert.equal(stats.total, 1207)
      assert.equal(stats.batches, null, 'batch administration summary is never exposed to other roles')
      assert.equal(Object.hasOwn(stats, 'reporter_id'), false)
    })
    await db.exec("insert into sightings(status,species,sighting_date) select 'verified','Grupo '||n,'2026-01-01' from generate_series(1,12)n")
    await as(admin, async () => {
      const stats = await query()
      assert.equal(stats.by_taxon.length, 9)
      assert.ok(stats.by_taxon.some((point) => point.label === 'Otros grupos'))
      assert.equal(stats.by_taxon.reduce((sum, point) => sum + point.count, 0), 1221)
    })
  } finally { await db.close() }
})
