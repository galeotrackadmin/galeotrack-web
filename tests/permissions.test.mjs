import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { canAccess, homeForRole } from '../lib/access.ts'
import { publicationSchema, speciesSchema } from '../lib/community.ts'

test('rutas y matriz de modos: el administrador conserva acceso completo', () => {
  for (const role of ['student', 'researcher', 'community', 'admin']) {
    assert.ok(homeForRole(role).startsWith('/'))
    for (const mode of ['student', 'researcher', 'community', 'admin']) assert.equal(canAccess(role, mode), role === 'admin' || role === mode)
  }
  for (const role of ['pending_scientist', 'unassigned']) {
    for (const mode of ['student', 'researcher', 'community', 'admin']) assert.equal(canAccess(role, mode), false)
  }
})

test('publicaciones y fuentes validan contenido y protocolos', () => {
  assert.equal(publicationSchema.safeParse({ title: 'Título', summary: 'Resumen de la investigación', content: 'Una investigación sobre observaciones marinas.', references_text: '', status: 'published' }).success, true)
  assert.equal(publicationSchema.safeParse({ title: 'x', summary: '', content: '', status: 'published' }).success, false)
  assert.equal(speciesSchema.safeParse({ name: 'Tiburón', scientific_name: '', description: 'Descripción suficientemente larga.', habitat: '', source_url: 'javascript:alert(1)' }).success, false)
})

test('migración y RLS reales: perfiles, registro, revisión, autoría y borradores', async () => {
  const db = new PGlite()
  const ids = { admin: '00000000-0000-4000-8000-000000000001', student: '00000000-0000-4000-8000-000000000002', researcher: '00000000-0000-4000-8000-000000000003', community: '00000000-0000-4000-8000-000000000004', pending: '00000000-0000-4000-8000-000000000005', social: '00000000-0000-4000-8000-000000000006', other: '00000000-0000-4000-8000-000000000007' }
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create table public.profiles(id uuid primary key references auth.users(id), role text check(role in ('admin','researcher')), full_name text);
      create table public.sightings(id uuid primary key default gen_random_uuid(), species text, status text default 'pending', verified_by uuid, verified_at timestamptz, updated_at timestamptz);
      alter table public.sightings enable row level security;
      create policy legacy_public on public.sightings for all using (true) with check (true);
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/202609280001_community_platform.sql', import.meta.url), 'utf8'))
    async function user(id, metadata) { await db.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', [id, JSON.stringify(metadata)]) }
    await user(ids.admin, { requested_role: 'admin', role: 'admin' })
    assert.equal((await db.query('select role from public.profiles where id = $1', [ids.admin])).rows[0].role, 'unassigned', 'metadata cannot grant admin')
    await db.query("update profiles set role = 'admin' where id = $1", [ids.admin])
    await user(ids.student, { requested_role: 'student' })
    await user(ids.community, { requested_role: 'community' })
    await user(ids.researcher, { requested_role: 'researcher', full_name: 'Científica', affiliation: 'Instituto' })
    await user(ids.pending, { requested_role: 'researcher' })
    await user(ids.social, {})
    await user(ids.other, { requested_role: 'researcher' })
    async function as(id, run, role = 'authenticated') {
      await db.exec(`set role ${role}`)
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ''])
      try { return await run() } finally { await db.exec('reset role') }
    }
    await as(ids.social, async () => {
      await assert.rejects(db.query("select public.complete_profile('admin', 'Usuario', '')"))
      await db.query("select public.complete_profile('student', 'Usuario social', '')")
      await assert.rejects(db.query("select public.complete_profile('researcher', 'Usuario social', '')"))
      await assert.rejects(db.query("update public.profiles set role = 'admin' where id = $1", [ids.social]))
    })
    await as(ids.pending, async () => {
      assert.equal((await db.query('select * from public.species_guides')).rows.length, 0)
      await assert.rejects(db.query('select public.review_scientist($1, true)', [ids.pending]))
    })
    await as(ids.admin, async () => {
      await db.query('select public.review_scientist($1, true)', [ids.researcher])
      await db.query('select public.review_scientist($1, true)', [ids.other])
      await db.query("select public.review_scientist($1, false, 'Falta información')", [ids.pending])
      await assert.rejects(db.query('select public.review_scientist($1, true)', [ids.researcher]), 'concurrent review must fail')
    })
    await as(null, async () => { await assert.rejects(db.query('select * from public.sightings')); await assert.rejects(db.query('select * from public.species_guides')) }, 'anon')
    let sightingId
    await as(ids.community, async () => {
      sightingId = (await db.query("insert into public.sightings(species, reporter_id) values ('Tiburón', $1) returning id", [ids.community])).rows[0].id
      await assert.rejects(db.query("insert into public.sightings(reporter_id, status) values ($1, 'verified')", [ids.community]))
      await assert.rejects(db.query('insert into public.sightings(reporter_id) values ($1)', [ids.student]))
      assert.equal((await db.query("update public.sightings set status = 'verified' where id = $1 returning id", [sightingId])).rows.length, 0)
    })
    for (const id of [ids.student, ids.researcher]) {
      await as(id, async () => {
        await assert.rejects(db.query('insert into public.sightings(reporter_id) values ($1)', [id]))
        assert.equal((await db.query("update public.sightings set status = 'verified' where id = $1 returning id", [sightingId])).rows.length, 0)
        assert.equal((await db.query('select * from public.sightings')).rows.length, 1)
      })
    }
    await as(ids.admin, async () => { assert.equal((await db.query("update public.sightings set status = 'rejected' where id = $1 returning id", [sightingId])).rows.length, 1) })
    await as(ids.student, async () => { assert.equal((await db.query('select status from public.sightings')).rows[0].status, 'rejected') })
    let draftId, publishedId
    await as(ids.researcher, async () => {
      const post = ['Investigación marina', 'Un resumen de investigación.', 'Contenido científico suficientemente extenso.']
      draftId = (await db.query("insert into publications(author_id,title,summary,content) values ($1,$2,$3,$4) returning id", [ids.researcher, ...post])).rows[0].id
      publishedId = (await db.query("insert into publications(author_id,title,summary,content,status) values ($1,$2,$3,$4,'published') returning id", [ids.researcher, ...post])).rows[0].id
      await assert.rejects(db.query("insert into publications(author_id,title,summary,content) values ($1,$2,$3,$4)", [ids.other, ...post]))
      assert.equal((await db.query('select * from publications')).rows.length, 2)
    })
    for (const id of [ids.student, ids.community, ids.other]) {
      await as(id, async () => {
        assert.deepEqual((await db.query('select id from publications')).rows.map((p) => p.id), [publishedId])
        assert.equal((await db.query("update publications set title = 'Título ajeno' where id = $1 returning id", [publishedId])).rows.length, 0)
        assert.equal((await db.query('delete from publications where id = $1 returning id', [draftId])).rows.length, 0)
        await assert.rejects(db.query("insert into species_guides(name, description) values ('Otra especie', 'Descripción de especie suficientemente larga.')"))
      })
    }
    await as(ids.admin, async () => {
      assert.equal((await db.query('select * from publications')).rows.length, 2)
      assert.equal((await db.query("update publications set status = 'draft' where id = $1 returning id", [publishedId])).rows.length, 1)
      await db.query("insert into species_guides(name, description) values ('Otra especie', 'Descripción de especie suficientemente larga.')")
    })
    await as(ids.student, async () => { assert.equal((await db.query('select * from publications')).rows.length, 0) })
  } finally { await db.close() }
})
