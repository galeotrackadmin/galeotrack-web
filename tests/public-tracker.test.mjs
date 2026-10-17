import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { loadPublicMapSightings } from '../lib/sightings/public-map.ts'
import { groupMapSightings } from '../lib/sightings/map-data.ts'

test('tracker público: pendientes y verificados activos, paginación y datos privados inaccesibles', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      grant usage on schema public to anon, authenticated;
      create table public.sightings(id uuid primary key default gen_random_uuid(), species text,
        location_name text, sighting_date date, sighting_time time, quantity integer,
        latitude double precision, longitude double precision, status text,
        reporter_id uuid, notes text, photo_path text, deleted_at timestamptz, import_batch_id uuid,
        source_name text, source_year integer, source_month integer, date_precision text);
      create table public.sighting_import_batches(id uuid primary key, status text);
      create table public.sighting_contacts(sighting_id uuid, email text);
      create table public.sighting_import_rows(sighting_id uuid, raw_record jsonb);
      alter table public.sightings enable row level security;
      insert into public.sightings(species,status,latitude,longitude,sighting_date,notes,photo_path)
      select 'Tiburón ' || i, 'verified', 18.3, -67.2, '2026-10-01', 'privado', 'archivo-privado'
      from generate_series(1, 501) i;
      insert into public.sightings(species,status,latitude,longitude) values
        ('Pendiente','pending',18,-67), ('Rechazado','rejected',18,-67),
        ('Sin GPS','verified',null,null), ('Inválido','verified',91,-67),
         ('NaN','verified','NaN'::float8,-67);
      insert into sighting_import_batches values ('00000000-0000-4000-8000-000000000001','withdrawn');
      insert into sightings(species,status,latitude,longitude,deleted_at) values ('Eliminado','pending',18,-67,now());
      insert into sightings(species,status,latitude,longitude,import_batch_id) values ('Lote retirado','pending',18,-67,'00000000-0000-4000-8000-000000000001');
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/202610040001_public_tracker.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/202610160002_public_map_review_states.sql', import.meta.url), 'utf8'))
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      const first = (await db.query('select * from public.public_map_sightings(0)')).rows
      const second = (await db.query('select * from public.public_map_sightings(500)')).rows
      assert.equal(first.length, 500)
      assert.equal(second.length, 2)
      const rows = [...first, ...second]
      assert.equal(new Set(rows.map((row) => row.id)).size, 502)
      assert.equal(rows.filter((row) => row.status === 'pending').length, 1)
      assert.equal(rows.filter((row) => row.status === 'verified').length, 501)
      assert.ok(!rows.some((row) => ['Rechazado','Eliminado','Lote retirado','Sin GPS','Inválido','NaN'].includes(row.species)))
      assert.deepEqual(Object.keys(first[0]).sort(), ['id', 'species', 'location_name', 'sighting_date', 'sighting_time', 'quantity', 'latitude', 'longitude', 'source_name', 'source_year', 'source_month', 'date_precision', 'status'].sort())
      await assert.rejects(db.query('select * from public.sightings'))
      await assert.rejects(db.query('select * from public.sighting_import_batches'))
      await assert.rejects(db.query('select * from public.sighting_import_rows'))
      await assert.rejects(db.query('select * from public.sighting_contacts'))
      await assert.rejects(db.query("update public.sightings set status='verified'"))
      await db.exec('reset role')
    }
  } finally { await db.close() }
})

test('el cliente recorre todas las páginas del tracker sin duplicados y propaga errores', async () => {
  const offsets = []
  const first = Array.from({ length: 500 }, (_, i) => ({ id: `${i}`, latitude: 18, longitude: -67, status: i % 2 === 0 ? 'pending' : 'verified' }))
  const client = { rpc(name, { page_offset }) {
    assert.equal(name, 'public_map_sightings'); offsets.push(page_offset)
    return { overrideTypes: async () => ({ data: page_offset === 0 ? first : [{ id: '500', latitude: 18, longitude: -67, status: 'pending' }, first[0], { id: 'invalid', latitude: 100, longitude: -67, status: 'verified' }, { id: 'rejected', latitude: 18, longitude: -67, status: 'rejected' }], error: null }) }
  } }
  const rows = await loadPublicMapSightings(client)
  assert.equal(rows.length, 501)
  assert.deepEqual(offsets, [0, 500])
  assert.equal(rows[0].status, 'pending')
  assert.equal(groupMapSightings(rows, 8)[0].sightings[0].status, 'pending', 'grouping must not turn pending records into verified ones')
  await assert.rejects(loadPublicMapSightings({ rpc: () => ({ overrideTypes: async () => ({ data: null, error: { message: 'Unavailable' } }) }) }), /No se pudieron cargar/)
  await assert.rejects(loadPublicMapSightings({ rpc: () => ({ overrideTypes: async () => ({ data: null, error: { code: 'PGRST202' } }) }) }), /pendiente de configuración en Supabase/)
  await assert.rejects(loadPublicMapSightings({ rpc: () => ({ overrideTypes: async () => ({ data: [{ id: 'legacy', latitude: 18, longitude: -67 }], error: null }) }) }), /202610160002/)
})
