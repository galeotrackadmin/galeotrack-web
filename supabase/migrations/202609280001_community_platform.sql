-- Aplicar sobre el esquema profiles/sightings descrito en README.md.
-- Sustituye las políticas de estas tablas por la matriz de permisos de GaleoTrack.
begin;

-- El proyecto original puede usar text o un enum para role.
do $$ declare c record; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\mrole\M'
  loop execute format('alter table public.profiles drop constraint %I', c.conname); end loop;
end $$;
alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using role::text;
alter table public.profiles alter column role set default 'unassigned';
update public.profiles set role = 'unassigned' where role is null;
alter table public.profiles alter column role set not null;
alter table public.profiles add constraint galeotrack_profile_role check
  (role in ('admin', 'researcher', 'student', 'community', 'pending_scientist', 'unassigned')) not valid;
-- Falla y revierte si hay roles anteriores sin mapear; no los modifica silenciosamente.
alter table public.profiles validate constraint galeotrack_profile_role;
alter table public.profiles add column if not exists science_status text
  check (science_status in ('pending', 'approved', 'rejected'));
alter table public.profiles add column if not exists affiliation text;
alter table public.profiles add column if not exists request_note text;
alter table public.profiles add column if not exists reviewed_by uuid references auth.users(id);
alter table public.profiles add column if not exists reviewed_at timestamptz;

alter table public.sightings add column if not exists reporter_id uuid references auth.users(id) on delete set null;
create index if not exists sightings_reporter_idx on public.sightings(reporter_id);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  summary text not null check (char_length(btrim(summary)) between 10 and 500),
  content text not null check (char_length(btrim(content)) between 20 and 30000),
  references_text text not null default '' check (char_length(references_text) <= 4000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index publications_feed_idx on public.publications(status, created_at desc, id);
create index publications_author_idx on public.publications(author_id);

create table public.species_guides (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 3 and 120),
  scientific_name text not null default '' check (char_length(scientific_name) <= 160),
  description text not null check (char_length(btrim(description)) between 20 and 10000),
  habitat text not null default '' check (char_length(habitat) <= 1000),
  source_url text not null default '' check (source_url = '' or source_url ~ '^https://'),
  updated_at timestamptz not null default now()
);
insert into public.species_guides(name, scientific_name, description, habitat, source_url) values
('Tiburón nodriza', 'Ginglymostoma cirratum', 'Se reconoce por su cabeza ancha y los barbillones próximos a la boca. Suele descansar sobre el fondo durante el día. Observa sin tocar, alimentar ni bloquear su paso.', 'Aguas costeras tropicales y subtropicales, fondos arenosos y arrecifes.', 'https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/ginglymostoma-cirratum/'),
('Tiburón tigre', 'Galeocerdo cuvier', 'Presenta un hocico ancho y un patrón de bandas oscuras, más marcado en ejemplares jóvenes. La identificación debe apoyarse en varios rasgos y en la revisión de especialistas.', 'Ambientes tropicales y templados cálidos, tanto costeros como oceánicos.', 'https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/galeocerdo-cuvier/'),
('Tiburones martillo', 'Familia Sphyrnidae', 'El nombre agrupa varias especies con la cabeza extendida lateralmente. Un avistamiento de “tiburón martillo” no identifica por sí solo una especie concreta. Registra únicamente los rasgos que hayas observado.', 'La distribución y el hábitat varían según la especie.', 'https://www.floridamuseum.ufl.edu/discover-fish/sharks/');

create function public.galeotrack_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;
revoke all on function public.galeotrack_role() from public;
grant execute on function public.galeotrack_role() to authenticated;

create function public.galeotrack_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare requested text := new.raw_user_meta_data->>'requested_role';
begin
  insert into public.profiles(id, full_name, role, science_status, affiliation)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    case when requested in ('student', 'community') then requested
         when requested = 'researcher' then 'pending_scientist' else 'unassigned' end,
    case when requested = 'researcher' then 'pending' end,
    left(coalesce(new.raw_user_meta_data->>'affiliation', ''), 200))
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.galeotrack_new_user() from public;
create trigger galeotrack_user_created after insert on auth.users
  for each row execute function public.galeotrack_new_user();

create function public.complete_profile(selected_role text, display_name text, organization text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or selected_role not in ('student', 'community', 'researcher')
    or char_length(btrim(display_name)) not between 2 and 120 or char_length(organization) > 200
  then raise exception 'Perfil no válido'; end if;
  insert into public.profiles(id, role, full_name) values (auth.uid(), 'unassigned', '') on conflict (id) do nothing;
  update public.profiles set full_name = btrim(display_name), affiliation = btrim(organization),
    role = case when selected_role = 'researcher' then 'pending_scientist' else selected_role end,
    science_status = case when selected_role = 'researcher' then 'pending' end
  where id = auth.uid() and role = 'unassigned';
  if not found then raise exception 'El perfil ya está asignado'; end if;
end $$;
revoke all on function public.complete_profile(text,text,text) from public;
grant execute on function public.complete_profile(text,text,text) to authenticated;

create function public.review_scientist(profile_id uuid, approve boolean, note text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.galeotrack_role() is distinct from 'admin' then raise exception 'Acceso denegado'; end if;
  if approve is null or char_length(note) > 1000 then raise exception 'Revisión no válida'; end if;
  update public.profiles set role = case when approve then 'researcher' else 'pending_scientist' end,
    science_status = case when approve then 'approved' else 'rejected' end,
    request_note = note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = profile_id and role = 'pending_scientist' and science_status = 'pending';
  if not found then raise exception 'La solicitud ya fue revisada'; end if;
end $$;
revoke all on function public.review_scientist(uuid,boolean,text) from public;
grant execute on function public.review_scientist(uuid,boolean,text) to authenticated;

-- Los usuarios no pueden alterar sus roles ni usar políticas antiguas permisivas.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'sightings')
  loop execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename); end loop;
end $$;
alter table public.profiles enable row level security;
alter table public.sightings enable row level security;
alter table public.publications enable row level security;
alter table public.species_guides enable row level security;
revoke all on public.profiles, public.sightings, public.publications, public.species_guides from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.sightings to authenticated;
grant select, insert, update, delete on public.publications, public.species_guides to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.galeotrack_role()) = 'admin');
create policy sightings_read on public.sightings for select to authenticated
  using ((select public.galeotrack_role()) in ('student','community','researcher','admin'));
create policy sightings_create on public.sightings for insert to authenticated
  with check ((select public.galeotrack_role()) in ('community','admin') and reporter_id = (select auth.uid())
    and status = 'pending' and verified_by is null and verified_at is null);
create policy sightings_review on public.sightings for update to authenticated
  using ((select public.galeotrack_role()) = 'admin') with check ((select public.galeotrack_role()) = 'admin');
create policy publications_read on public.publications for select to authenticated using (
  (select public.galeotrack_role()) = 'admin' or
  ((select public.galeotrack_role()) in ('student','community','researcher') and status = 'published') or
  ((select public.galeotrack_role()) = 'researcher' and author_id = (select auth.uid())));
create policy publications_create on public.publications for insert to authenticated
  with check ((select public.galeotrack_role()) in ('researcher','admin') and author_id = (select auth.uid()));
create policy publications_edit on public.publications for update to authenticated
  using ((select public.galeotrack_role()) = 'admin' or ((select public.galeotrack_role()) = 'researcher' and author_id = (select auth.uid())))
  with check ((select public.galeotrack_role()) = 'admin' or ((select public.galeotrack_role()) = 'researcher' and author_id = (select auth.uid())));
create policy publications_delete on public.publications for delete to authenticated
  using ((select public.galeotrack_role()) = 'admin' or ((select public.galeotrack_role()) = 'researcher' and author_id = (select auth.uid())));
create policy species_read on public.species_guides for select to authenticated
  using ((select public.galeotrack_role()) in ('student','community','researcher','admin'));
create policy species_manage on public.species_guides for all to authenticated
  using ((select public.galeotrack_role()) = 'admin') with check ((select public.galeotrack_role()) = 'admin');
commit;
