import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('registro ampliado: transacción, unidades, RLS de contacto, Storage e idempotencia', async () => {
  const db = new PGlite()
  const ids = Object.fromEntries(['admin', 'student', 'researcher', 'community', 'pending_scientist', 'other'].map((role, i) => [role, `00000000-0000-4000-8000-00000000000${i + 1}`]))
  const reportId = '10000000-0000-4000-8000-000000000001'
  const payload = {
    collaborator_role: 'Buzo', species: 'Tiburón gata (Ginglymostoma cirratum)', location_name: 'Rincón',
    sighting_date: '2026-09-24', sighting_time: '10:30', quantity: 2, total_length_m: 1.9812,
    latitude: 18.34, longitude: -67.25, sex: 'No determinado', behavior: 'Nadando tranquilamente',
    health_conditions: ['Sano / sin marcas visibles'], contact: { name: 'Ana', email: 'ana@example.test', phone: null },
    photo_path: `${ids.community}/${reportId}/photo-test.jpg`,
  }
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
    for (const file of ['202609280001_community_platform.sql', '202610020001_sighting_observations.sql', '202610130001_sighting_crud.sql', '202610150001_account_management.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    const historicalId = crypto.randomUUID()
    await db.query("insert into sightings(id, collaborator_role) values ($1, 'Buzo')", [historicalId])
    await db.exec(await readFile(new URL('../supabase/migrations/202610150002_sighting_profile_role.sql', import.meta.url), 'utf8'))
    assert.equal((await db.query('select collaborator_role from sightings where id=$1', [historicalId])).rows[0].collaborator_role, 'Buzo', 'migration does not rewrite legacy activity')
    await db.query('delete from sightings where id=$1', [historicalId])
    for (const [role, id] of Object.entries(ids)) {
      await db.query('insert into auth.users(id) values ($1)', [id])
      await db.query('update profiles set role=$1 where id=$2', [role === 'other' ? 'community' : role, id])
    }
    async function as(role, action) {
      await db.exec(`set role ${role === 'anon' ? 'anon' : 'authenticated'}`)
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[role] ?? ''])
      try { return await action() } finally { await db.exec('reset role') }
    }
    const submit = (id, values) => db.query('select public.submit_sighting($1, $2::jsonb) as id', [id, JSON.stringify(values)])
    await as('community', async () => {
      await assert.rejects(db.query('insert into sightings(species) values ($1)', ['bypass']), 'no direct inserts')
      await assert.rejects(submit(reportId, payload), 'must upload evidence first')
      assert.equal((await db.query('select * from sightings')).rows.length, 0)
      await db.query("insert into storage.objects(bucket_id,name,metadata) values ('sighting-evidence',$1,$2)", [payload.photo_path, JSON.stringify({ mimetype: 'image/jpeg' })])
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('sighting-evidence',$1)", [`${ids.other}/fake/file.jpg`]))
      await submit(reportId, payload)
      await submit(reportId, payload)
      assert.equal((await db.query('select * from sightings')).rows.length, 1, 'retry does not duplicate')
      const row = (await db.query('select * from sightings')).rows[0]
      assert.equal(row.reporter_id, ids.community)
      assert.equal(row.collaborator_role, 'Pescador / Buzo', 'stored role comes from authenticated profile, ignoring the payload activity')
      await submit(reportId, { ...payload, collaborator_role: 'Administrador' })
      assert.equal((await db.query('select collaborator_role from sightings where id=$1', [reportId])).rows[0].collaborator_role, 'Pescador / Buzo', 'tampered role is ignored even on retry')
      assert.equal(row.status, 'pending')
      assert.equal(Number(row.total_length_m), 1.9812)
      assert.equal(new Date(row.observed_at).toISOString(), '2026-09-24T14:30:00.000Z')
      assert.equal(row.estimated_size, null, 'new morphology does not masquerade as legacy estimate')
      assert.equal((await db.query('select * from sighting_contacts')).rows.length, 1)
      await assert.rejects(submit(reportId, { ...payload, quantity: 5 }), /otro envío/)
      await db.query('delete from storage.objects where name=$1', [payload.photo_path])
      assert.equal((await db.query('select * from storage.objects')).rows.length, 1, 'committed evidence cannot be removed')
      await assert.rejects(db.query('select * from sighting_submissions'), 'payload receipts private')
    })
    for (const role of ['student', 'other']) await as(role, async () => {
      assert.equal((await db.query('select * from sighting_contacts')).rows.length, 0, 'no contact disclosure')
      assert.equal((await db.query('select * from storage.objects')).rows.length, 1, 'evidence for community')
    })
    for (const role of ['admin', 'researcher']) await as(role, async () => {
      assert.equal((await db.query('select * from sighting_contacts')).rows.length, 1)
      const id = crypto.randomUUID()
      const { collaborator_role: ignoredRole, ...roleFreePayload } = payload
      assert.equal(ignoredRole, 'Buzo')
      await submit(id, { ...roleFreePayload, photo_path: null, contact: null })
      assert.equal((await db.query('select collaborator_role from sightings where id=$1', [id])).rows[0].collaborator_role, role === 'admin' ? 'Administrador' : 'Científico / Investigador')
    })
    await as('community', async () => {
      await db.query("update sightings set location_name='Aguadilla', status='verified' where id=$1", [reportId])
      const updated = (await db.query('select location_name, status, verified_by from sightings where id=$1', [reportId])).rows[0]
      assert.deepEqual(updated, { location_name: 'Aguadilla', status: 'pending', verified_by: null }, 'owner edit requires fresh review')
      await assert.rejects(db.query("update sightings set reporter_id=$1 where id=$2", [ids.other, reportId]), /autoría/)
      await assert.rejects(db.query("update sightings set collaborator_role='Administrador' where id=$1", [reportId]), /perfil del colaborador/)
    })
    await as('student', async () => {
      await db.query("update sightings set location_name='No permitido' where id=$1", [reportId])
      assert.equal((await db.query('select location_name from sightings where id=$1', [reportId])).rows[0].location_name, 'Aguadilla')
      await assert.rejects(db.query('select public.delete_sighting($1)', [reportId]), /Acceso denegado/)
    })
    await as('other', async () => {
      assert.equal((await db.query('select public.delete_sighting($1) as deleted', [reportId])).rows[0].deleted, false, 'author cannot remove someone else\'s report')
    })
    await as('admin', async () => {
      await assert.rejects(db.query("update sightings set collaborator_role='Buzo' where id=$1", [reportId]), /perfil del colaborador/)
      await db.query("update sightings set location_name='Admin edit', status='verified', verified_by=$1 where id=$2", [ids.admin, reportId])
      assert.deepEqual((await db.query('select location_name, status from sightings where id=$1', [reportId])).rows[0], { location_name: 'Admin edit', status: 'verified' })
      assert.equal((await db.query('select public.delete_sighting($1) as deleted', [reportId])).rows[0].deleted, true, 'admin can delete any report')
      assert.equal((await db.query('select count(*)::int as total from sightings where deleted_at is null')).rows[0].total, 2, 'soft-deleted record is excluded from active feeds')
      assert.equal((await db.query('select count(*)::int as total from sightings where id=$1', [reportId])).rows[0].total, 1, 'admin retains access to archived records')
    })
    await as('student', async () => {
      assert.equal((await db.query('select * from sightings where id=$1', [reportId])).rows.length, 0, 'deleted records are hidden from read-only students')
    })
    for (const role of ['student', 'pending_scientist', 'anon']) await as(role, async () => {
      await assert.rejects(submit(crypto.randomUUID(), { ...payload, photo_path: null }))
    })
    await as('other', async () => {
      await assert.rejects(submit(crypto.randomUUID(), { ...payload, photo_path: null, latitude: 91 }))
      await assert.rejects(submit(crypto.randomUUID(), { ...payload, photo_path: null, total_length_m: -1 }))
      await assert.rejects(submit(crypto.randomUUID(), { ...payload, photo_path: null, health_conditions: ['Sano / sin marcas visibles', 'Heridas o cicatrices'] }))
      const invalidId = crypto.randomUUID()
      await assert.rejects(submit(invalidId, { ...payload, photo_path: null, contact: { name: 'A', email: 'bad' } }))
      assert.equal((await db.query('select * from sightings where id=$1', [invalidId])).rows.length, 0, 'contact failure rolls back report')
      await assert.rejects(submit(crypto.randomUUID(), payload), 'cannot attach another user evidence')
      const path = `${ids.other}/${crypto.randomUUID()}/photo-temp.jpg`
      await db.query("insert into storage.objects(bucket_id,name) values ('sighting-evidence',$1)", [path])
      await db.query('delete from storage.objects where name=$1', [path])
      assert.equal((await db.query('select * from storage.objects where name=$1', [path])).rows.length, 0)
    })
    await as('community', async () => {
      assert.equal((await db.query('select public.claim_geocoding_request() as allowed')).rows[0].allowed, true)
      assert.equal((await db.query('select public.claim_geocoding_request() as allowed')).rows[0].allowed, false)
    })
    await as('other', async () => {
      await db.query("select public.update_my_profile('Nombre actualizado')")
      assert.equal((await db.query('select full_name from profiles where id=$1', [ids.other])).rows[0].full_name, 'Nombre actualizado')
      await db.query("select public.change_my_role('researcher','Universidad del Mar')")
      assert.equal((await db.query('select role, science_status, affiliation from profiles where id=$1', [ids.other])).rows[0].role, 'pending_scientist')
      assert.equal((await db.query("select status from profile_role_history where user_id=$1 order by created_at desc limit 1", [ids.other])).rows[0].status, 'pending')
      await assert.rejects(db.query("select public.change_my_role('admin','')"), /Solicitud de rol no válida/)
    })
    await as('admin', async () => {
      assert.equal((await db.query('select role from profiles where id=$1', [ids.admin])).rows[0].role, 'admin')
      await assert.rejects(db.query("select public.change_my_role('student','')"), /administración no puede cambiar de rol/)
    })
    await as('student', async () => { await db.query("select public.change_my_role('researcher','Instituto Marino')") })
    await as('admin', async () => { await db.query("select public.review_scientist($1, true, 'Perfil validado')", [ids.student]) })
    assert.equal((await db.query('select role, science_status from profiles where id=$1', [ids.student])).rows[0].role, 'researcher')
    assert.equal((await db.query("select status from profile_role_history where user_id=$1 order by created_at desc limit 1", [ids.student])).rows[0].status, 'approved')
    const privateReport = crypto.randomUUID()
    const privateDraft = crypto.randomUUID()
    const privatePublished = crypto.randomUUID()
    await db.query("insert into sightings(id, reporter_id, species, notes, species_other, photo_path) values ($1,$2,'Otro','me llamo Ana','Tiburón identificable',$3)", [privateReport, ids.other, `${ids.other}/${privateReport}/photo-private.jpg`])
    await db.query('insert into sighting_contacts(sighting_id,name,email) values ($1,$2,$3)', [privateReport, 'Ana del Mar', 'ana@example.test'])
    await db.query('insert into sighting_submissions(sighting_id,reporter_id,payload) values ($1,$2,$3)', [privateReport, ids.other, JSON.stringify({ contact: { email: 'ana@example.test' } })])
    const publication = ['Investigación marina', 'Resumen suficientemente largo para pasar la validación.', 'Contenido científico con suficiente extensión para cumplir los requisitos de la publicación.']
    await db.query("insert into publications(id,author_id,title,summary,content,status) values ($1,$2,$3,$4,$5,'draft'),($6,$2,$3,$4,$5,'published')", [privateDraft, ids.other, ...publication, privatePublished])
    await db.exec("set role service_role")
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)")
    try {
      await assert.rejects(db.query('select public.prepare_account_deletion($1)', [ids.admin]), /administradora/)
      await db.query('select public.prepare_account_deletion($1)', [ids.other])
    } finally { await db.exec('reset role') }
    const anonymized = (await db.query('select reporter_id, notes, species_other, photo_path from sightings where id=$1', [privateReport])).rows[0]
    assert.deepEqual(anonymized, { reporter_id: null, notes: null, species_other: null, photo_path: null }, 'keeps the observation while removing attribution and potentially identifying free text/evidence')
    assert.equal((await db.query('select * from sighting_contacts where sighting_id=$1', [privateReport])).rows.length, 0)
    assert.equal((await db.query('select * from sighting_submissions where sighting_id=$1', [privateReport])).rows.length, 0)
    assert.equal((await db.query('select * from publications where id=$1', [privateDraft])).rows.length, 0)
    assert.equal((await db.query('select author_id from publications where id=$1', [privatePublished])).rows[0].author_id, null)
    assert.equal((await db.query('select * from profiles where id=$1', [ids.other])).rows.length, 0)
  } finally { await db.close() }
})
