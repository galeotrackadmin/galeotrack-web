-- Cuenta, historial de solicitudes de rol y eliminación con conservación anonimizada de observaciones.
begin;

create table public.profile_role_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  previous_role text not null,
  requested_role text not null check (requested_role in ('student','community','researcher')),
  status text not null check (status in ('completed','pending','approved','rejected','withdrawn')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create index profile_role_history_user_idx on public.profile_role_history(user_id, created_at desc);
alter table public.profile_role_history enable row level security;
revoke all on public.profile_role_history from anon, authenticated;
grant select on public.profile_role_history to authenticated;
create policy profile_role_history_read on public.profile_role_history for select to authenticated
  using (user_id = (select auth.uid()) or (select public.galeotrack_role()) = 'admin');

-- Registra solicitudes pendientes que ya existían antes de activar el historial.
insert into public.profile_role_history(user_id, previous_role, requested_role, status, review_note, created_at)
select id, 'unassigned', 'researcher',
  case when science_status = 'approved' then 'approved' when science_status = 'rejected' then 'rejected' else 'pending' end,
  request_note, coalesce(reviewed_at, now())
from public.profiles where role in ('researcher','pending_scientist') and science_status is not null;

create or replace function public.update_my_profile(display_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or char_length(btrim(coalesce(display_name,''))) not between 2 and 120 then
    raise exception 'El nombre debe tener entre 2 y 120 caracteres';
  end if;
  update public.profiles set full_name = btrim(display_name) where id = auth.uid();
  if not found then raise exception 'No existe un perfil para esta cuenta'; end if;
end $$;
revoke all on function public.update_my_profile(text) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;

create or replace function public.complete_profile(selected_role text, display_name text, organization text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare assigned_role text;
begin
  if auth.uid() is null or selected_role not in ('student', 'community', 'researcher')
    or char_length(btrim(display_name)) not between 2 and 120 or char_length(organization) > 200
  then raise exception 'Perfil no válido'; end if;
  insert into public.profiles(id, role, full_name) values (auth.uid(), 'unassigned', '') on conflict (id) do nothing;
  assigned_role := case when selected_role = 'researcher' then 'pending_scientist' else selected_role end;
  update public.profiles set full_name = btrim(display_name), affiliation = btrim(organization),
    role = assigned_role, science_status = case when selected_role = 'researcher' then 'pending' end
  where id = auth.uid() and role = 'unassigned';
  if not found then raise exception 'El perfil ya está asignado'; end if;
  insert into public.profile_role_history(user_id, previous_role, requested_role, status)
    values (auth.uid(), 'unassigned', selected_role, case when selected_role = 'researcher' then 'pending' else 'completed' end);
end $$;
revoke all on function public.complete_profile(text,text,text) from public, anon;
grant execute on function public.complete_profile(text,text,text) to authenticated;

create function public.change_my_role(selected_role text, organization text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare old_role text; next_role text;
begin
  if auth.uid() is null or selected_role not in ('student','community','researcher') or char_length(organization) > 200
    or (selected_role = 'researcher' and char_length(btrim(coalesce(organization,''))) not between 2 and 200) then
    raise exception 'Solicitud de rol no válida';
  end if;
  select role into old_role from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'No existe un perfil para esta cuenta'; end if;
  if old_role = 'admin' then raise exception 'La administración no puede cambiar de rol desde esta opción'; end if;
  if (old_role = selected_role) or (old_role = 'pending_scientist' and selected_role = 'researcher' and
      exists (select 1 from public.profiles where id = auth.uid() and science_status = 'pending')) then
    raise exception 'Ese rol ya está activo o pendiente';
  end if;
  update public.profile_role_history set status = 'withdrawn', reviewed_at = now()
    where user_id = auth.uid() and status = 'pending';
  next_role := case when selected_role = 'researcher' then 'pending_scientist' else selected_role end;
  update public.profiles set role = next_role,
    science_status = case when selected_role = 'researcher' then 'pending' else null end,
    affiliation = case when selected_role = 'researcher' then nullif(btrim(organization),'') else affiliation end,
    request_note = null, reviewed_by = null, reviewed_at = null
  where id = auth.uid();
  insert into public.profile_role_history(user_id, previous_role, requested_role, status)
    values (auth.uid(), old_role, selected_role, case when selected_role = 'researcher' then 'pending' else 'completed' end);
end $$;
revoke all on function public.change_my_role(text,text) from public, anon;
grant execute on function public.change_my_role(text,text) to authenticated;

create or replace function public.review_scientist(profile_id uuid, approve boolean, note text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.galeotrack_role() is distinct from 'admin' then raise exception 'Acceso denegado'; end if;
  if approve is null or char_length(note) > 1000 then raise exception 'Revisión no válida'; end if;
  update public.profiles set role = case when approve then 'researcher' else 'pending_scientist' end,
    science_status = case when approve then 'approved' else 'rejected' end,
    request_note = note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = profile_id and role = 'pending_scientist' and science_status = 'pending';
  if not found then raise exception 'La solicitud ya fue revisada'; end if;
  update public.profile_role_history set status = case when approve then 'approved' else 'rejected' end,
    review_note = note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = (select h.id from public.profile_role_history h where h.user_id = profile_id and h.status = 'pending'
    order by h.created_at desc limit 1);
end $$;
revoke all on function public.review_scientist(uuid,boolean,text) from public, anon;
grant execute on function public.review_scientist(uuid,boolean,text) to authenticated;

-- Se invoca exclusivamente desde la Edge Function con service_role.
create or replace function public.guard_sighting_owner_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor_role text := public.galeotrack_role();
begin
  if coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') = 'service_role' or actor_role = 'admin' then return new; end if;
  if actor_role not in ('community','researcher') or old.reporter_id is distinct from auth.uid() or old.deleted_at is not null then
    raise exception 'No tienes permiso para editar este avistamiento' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.reporter_id is distinct from old.reporter_id
    or new.created_at is distinct from old.created_at or new.deleted_at is distinct from old.deleted_at then
    raise exception 'No puedes cambiar la autoría ni el historial del avistamiento' using errcode = '42501';
  end if;
  new.status := 'pending'; new.verified_by := null; new.verified_at := null; new.updated_at := now();
  return new;
end $$;
revoke all on function public.guard_sighting_owner_update() from public, anon, authenticated;

alter table public.publications alter column author_id drop not null;
create function public.prepare_account_deletion(target_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;
  if target_user_id is null or not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'Cuenta no encontrada';
  end if;
  if exists (select 1 from public.profiles where id = target_user_id and role = 'admin') then
    raise exception 'Para eliminar una cuenta administradora, contacta con otro administrador';
  end if;
  delete from public.sighting_contacts c using public.sightings s
    where c.sighting_id = s.id and s.reporter_id = target_user_id;
  delete from public.sighting_submissions where reporter_id = target_user_id;
  update public.sightings set reporter_id = null, photo_path = null, video_path = null,
    notes = null, species_other = null, behavior_other = null, health_other = null, updated_at = now()
    where reporter_id = target_user_id;
  delete from public.publications where author_id = target_user_id and status = 'draft';
  update public.publications set author_id = null where author_id = target_user_id and status = 'published';
  delete from public.profiles where id = target_user_id;
end $$;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
