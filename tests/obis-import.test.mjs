import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { OBIS_COLUMNS, parseObisCsv, summarizeObis } from '../lib/sightings/obis-import.ts'
import { formatImportedDate } from '../lib/sightings/import-date.ts'

const csv = await readFile(new URL('../avistamientos-obis-datos.csv', import.meta.url), 'utf8')

test('CSV real OBIS: 115 filas sin borrar duplicados, fechas parciales ni errores originales', () => {
  const records = parseObisCsv(csv)
  assert.equal(records.length, 115)
  assert.deepEqual(summarizeObis(records), { duplicates: 31, missingDates: 38, partialDates: 5, invalidYears: 5, missingLocalities: 45 })
  assert.equal(records.filter((record) => record.Year === '#VALUE!').length, 5)
  assert.equal(records[0]['Scientific Name'], 'Squalus cubensis')
  assert.ok(records.some((record) => record.locality.includes(',')), 'quoted localities retain commas')
  assert.equal(formatImportedDate({ date_precision: 'month', source_year: 2021, source_month: 4 }), 'abril de 2021')
  assert.equal(formatImportedDate({ date_precision: 'year', source_year: 1933 }), '1933')
})

test('lector CSV rechaza archivos inválidos sin guardar y admite comillas y saltos de línea', () => {
  assert.throws(() => parseObisCsv('columna\nvalor'), /columnas/)
  assert.throws(() => parseObisCsv('"campo sin cerrar'), /comillas/)
  assert.throws(() => parseObisCsv(csv.replace('18.496667', '91')), /coordenadas/)
  assert.throws(() => parseObisCsv(csv.replace('Puerto Rico,OBIS', 'Puerto Rico,OTRA')), /fuente/)
  assert.throws(() => parseObisCsv(csv.replace('1.0,Puerto Rico', '-1,Puerto Rico')), /cantidad/)
  const header = OBIS_COLUMNS.join(',')
  const quoted = `${header}\r\nGaleus arae,18,-67,,,"Puerto, \"\"Norte\"\"\nCosta",1,Puerto Rico,OBIS\r\n`
  assert.equal(parseObisCsv(quoted)[0].locality, 'Puerto, "Norte"\nCosta')
})

test('importación real: autorización, alta atómica, idempotencia y retirada/restauración aislada del lote', async () => {
  const db = new PGlite()
  const ids = Object.fromEntries(['admin', 'community', 'researcher', 'student', 'pending_scientist'].map((role, i) => [role, `00000000-0000-4000-8000-00000000000${i + 1}`]))
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
      grant usage on schema public, auth, storage to anon, authenticated;
      create table public.profiles(id uuid primary key references auth.users(id), role text, full_name text);
      create table public.sightings(id uuid primary key default gen_random_uuid(), species text, location_name text, sighting_date date, quantity integer,
        estimated_size numeric, latitude double precision, longitude double precision, behavior text, notes text,
        status text default 'pending', verified_by uuid, verified_at timestamptz, created_at timestamptz default now(), updated_at timestamptz);
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, metadata jsonb);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to authenticated;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    `)
    for (const file of ['202609280001_community_platform.sql', '202610020001_sighting_observations.sql', '202610130001_sighting_crud.sql', '202610150001_account_management.sql', '202610150002_sighting_profile_role.sql', '202610150003_obis_import_batches.sql', '202610160001_sighting_statistics.sql', '202610160002_public_map_review_states.sql', '202610170001_visual_health_statistics.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    }
    for (const [role, id] of Object.entries(ids)) {
      await db.query('insert into auth.users(id) values ($1)', [id])
      await db.query('update profiles set role=$1 where id=$2', [role, id])
    }
    async function as(role, run) {
      await db.exec(`set role ${role === 'anon' ? 'anon' : 'authenticated'}`)
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[role] ?? ''])
      try { return await run() } finally { await db.exec('reset role') }
    }
    const records = parseObisCsv(csv)
    const importRows = (rows = records, name = 'avistamientos-obis-datos.csv') => db.query('select public.import_obis_batch($1,$2::jsonb) as id', [name, JSON.stringify(rows)])
    for (const role of ['community', 'researcher', 'student', 'pending_scientist', 'anon']) await as(role, async () => {
      await assert.rejects(importRows())
      await assert.rejects(db.query('select public.set_obis_batch_withdrawn($1,true)', [crypto.randomUUID()]))
    })
    let batch
    await as('admin', async () => {
      const invalid = records.map((row) => ({ ...row }))
      invalid[114]['Decimal Latitude'] = '200'
      await assert.rejects(importRows(invalid), /coordenadas/)
      assert.equal((await db.query('select count(*)::int as n from sightings')).rows[0].n, 0, 'invalid final row rolls back the whole batch')
      assert.equal((await db.query('select count(*)::int as n from sighting_import_batches')).rows[0].n, 0)
      batch = (await importRows()).rows[0].id
      assert.equal((await importRows(records, 'mismo-contenido-otro-nombre.csv')).rows[0].id, batch, 'retry or rename cannot create another copy')
      assert.equal((await db.query('select count(*)::int as n from sightings')).rows[0].n, 115)
      const info = (await db.query('select * from sighting_import_batches where id=$1', [batch])).rows[0]
      assert.equal(info.duplicate_count, 31)
      const stats = (await db.query("select public.sighting_statistics('all','obis',null,null,false,false) as data")).rows[0].data
      assert.equal(stats.total, 115)
      assert.equal(stats.pending, 115)
      assert.deepEqual(stats.visual_health, { without_marks: 0, with_signs: 0, unknown: 115, signs: { wounds: 0, entanglement: 0, parasites: 0, other: 0 } }, 'missing health in all 115 imports is never treated as healthy')
      assert.equal(stats.quality.without_year, 38)
      assert.equal(stats.quality.partial_date, 5)
      assert.equal(stats.quality.possible_duplicates, 31)
      assert.deepEqual(info.quality_summary, { missing_dates: 38, partial_dates: 5, invalid_years: 5 })
      const rows = (await db.query('select * from sightings')).rows
      assert.ok(rows.every((row) => row.reporter_id === null && row.status === 'pending' && row.source_name === 'OBIS' && row.sighting_time === null))
      assert.equal(rows.filter((row) => row.date_precision === 'month' && row.sighting_date === null && row.source_year === 2021).length, 5)
      assert.equal(rows.filter((row) => row.date_precision === 'unknown' && row.sighting_date === null).length, 38)
      assert.equal(rows.filter((row) => row.quality_flags.includes('possible_duplicate')).length, 31)
      assert.equal((await db.query("select count(*)::int as n from sighting_import_rows where raw_record->>'Year'='#VALUE!'")).rows[0].n, 5)
      await assert.rejects(db.query("update sightings set species='Otra especie' where import_batch_id=$1", [batch]), /datos originales/)
      await assert.rejects(db.query('update sightings set import_batch_id=null where import_batch_id=$1', [batch]), /procedencia/)
    })
    await as('student', async () => {
      assert.equal((await db.query('select * from sighting_import_batches')).rows.length, 0)
      assert.equal((await db.query('select * from sighting_import_rows')).rows.length, 0)
    })
    await as('anon', async () => {
      const publicRows = (await db.query('select * from public_map_sightings(0)')).rows
      assert.equal(publicRows.length, 115, 'all active OBIS records appear even while pending')
      assert.ok(publicRows.every((row) => row.status === 'pending' && row.source_name === 'OBIS'))
      assert.ok(publicRows.every((row) => !('reporter_id' in row) && !('raw_record' in row) && !('notes' in row)))
      assert.equal(publicRows.filter((row) => row.sighting_date === null).length, 43, 'missing and partial dates remain visible without fabricated dates')
    })

    const communityReport = crypto.randomUUID()
    await db.query("insert into sightings(id, reporter_id, species, status, latitude, longitude) values ($1,$2,'Reporte comunitario','verified',18,-67)", [communityReport, ids.community])
    await as('admin', async () => {
      const imported = (await db.query('select id from sightings where import_batch_id=$1 order by import_row_number limit 2', [batch])).rows
      await db.query('select public.delete_sighting($1)', [imported[0].id])
      await db.query("update sightings set status='verified' where id=$1", [imported[1].id])
      assert.equal((await db.query('select public.set_obis_batch_withdrawn($1,true) as n', [batch])).rows[0].n, 114)
      assert.equal((await db.query('select public.set_obis_batch_withdrawn($1,true) as n', [batch])).rows[0].n, 0)
      assert.equal((await db.query('select deleted_at from sightings where id=$1', [communityReport])).rows[0].deleted_at, null)
      await assert.rejects(db.query('update sightings set deleted_at=null where id=$1', [imported[1].id]), /lote está retirado/)
      assert.equal((await importRows()).rows[0].id, batch, 'retired content is not silently reimported')
    })
    await as('anon', async () => { assert.deepEqual((await db.query('select id from public_map_sightings(0)')).rows.map((row) => row.id), [communityReport]) })
    await as('admin', async () => {
      assert.equal((await db.query('select public.set_obis_batch_withdrawn($1,false) as n', [batch])).rows[0].n, 114)
      assert.equal((await db.query("select count(*)::int as n from sightings where import_batch_id=$1 and deleted_at is null and status='pending'", [batch])).rows[0].n, 114)
      assert.equal((await db.query('select count(*)::int as n from sightings')).rows[0].n, 116, 'all raw observations remain recoverable')
      const secondBatch = (await importRows([{ ...records[0], 'Scientific Name': 'Galeus arae' }], 'segundo-lote.csv')).rows[0].id
      await db.query('select public.set_obis_batch_withdrawn($1,true)', [batch])
      assert.equal((await db.query('select count(*)::int as n from sightings where import_batch_id=$1 and deleted_at is null', [secondBatch])).rows[0].n, 1, 'withdrawing the first batch does not affect a different batch')
    })
  } finally { await db.close() }
})
