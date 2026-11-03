-- One independent workspace per administrator. No operational records are deleted.
-- Existing operational data belongs to the oldest administrator; other admins start empty.
begin;
set local lock_timeout='10s';
lock table public.workers,public.profiles,public.worker_private_details,public.worker_invitations,
 public.shift_types,public.shift_series,public.shifts,public.worker_absences,public.absence_private_notes,
 public.tasks,public.task_assignees,public.task_comments,public.task_attachments,public.logbook_entries,
 public.logbook_attachments,public.activity_logs,public.operation_requests in share row exclusive mode;
do $$ declare legacy uuid; t text; found_other boolean; begin
 select id into legacy from public.profiles where role='admin' order by created_at,id limit 1;
 foreach t in array array['shifts','shift_series','worker_absences','tasks','task_comments','task_attachments','logbook_entries','logbook_attachments'] loop
   execute format('select exists(select 1 from public.%I r join public.profiles p on p.id=r.created_by where p.role=''admin'' and p.id<>$1)',t) into found_other using legacy;
   if found_other then raise exception 'Otro administrador ya creó registros en %. Revisa su asignación antes de migrar; no se modificó ningún dato.',t; end if;
 end loop;
end $$;
create table public.workspaces (
 id uuid primary key, owner_id uuid unique references auth.users(id),
 name text not null, created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
insert into public.workspaces(id,owner_id,name)
 select id,id,'Espacio de '||display_name from public.profiles where role='admin';
do $$ begin
 if not exists(select 1 from public.workspaces) then
   insert into public.workspaces(id,name) values('00000000-0000-4000-8000-ffffffffffff','Espacio inicial');
 end if;
 if exists(select 1 from public.profiles where role='admin' and worker_id is not null) then
   raise exception 'Hay administradores vinculados a trabajadores. Revisa su traslado antes de separar los espacios.';
 end if;
end $$;

-- Backfill without changing versions, timestamps or generating fictitious business edits.
do $$ declare t text; legacy uuid; begin
 select p.id into legacy from public.profiles p where role='admin' order by created_at,id limit 1;
 legacy:=coalesce(legacy,'00000000-0000-4000-8000-ffffffffffff'::uuid);
 foreach t in array array['workers','profiles','worker_private_details','worker_invitations','shift_types','shift_series','shifts','worker_absences','absence_private_notes','tasks','task_assignees','task_comments','task_attachments','logbook_entries','logbook_attachments','activity_logs','operation_requests'] loop
   execute format('alter table public.%I add column workspace_id uuid references public.workspaces(id)',t);
   execute format('alter table public.%I disable trigger user',t);
   execute format('update public.%I set workspace_id=$1',t) using legacy;
   if t='profiles' then
     update public.profiles set workspace_id=id where role='admin';
   end if;
   execute format('alter table public.%I enable trigger user',t);
 end loop;
 -- The only historical cross-space records are profile-creation audit events.
 update public.activity_logs a set workspace_id=p.workspace_id
 from public.profiles p where a.entity='profiles' and a.entity_id=p.id;
end $$;

create function public.current_workspace() returns uuid language sql stable security definer set search_path='' as $$
 select p.workspace_id from public.profiles p where p.id=auth.uid();
$$;
revoke all on function public.current_workspace() from public,anon;
grant execute on function public.current_workspace() to authenticated,service_role;

-- Additional restrictive policies compose with all existing role/record policies.
do $$ declare t text; begin
 foreach t in array array['workers','profiles','worker_private_details','worker_invitations','shift_types','shift_series','shifts','worker_absences','absence_private_notes','tasks','task_assignees','task_comments','task_attachments','logbook_entries','logbook_attachments','activity_logs','operation_requests'] loop
   execute format('alter table public.%I alter column workspace_id set not null',t);
   execute format('alter table public.%I alter column workspace_id set default public.current_workspace()',t);
   execute format('create index %I on public.%I(workspace_id)',t||'_workspace',t);
   execute format('alter table public.%I add constraint %I unique(workspace_id,id)',t,t||'_workspace_identity');
   execute format('create policy workspace_boundary on public.%I as restrictive for all to authenticated using(workspace_id=public.current_workspace()) with check(workspace_id=public.current_workspace())',t);
 end loop;
end $$;
create policy own_workspace on public.workspaces for select to authenticated using(id=public.current_workspace());
grant select on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
revoke insert,update,delete on public.workspaces from authenticated,anon;

-- Enforce the tenant of every related operational record, including privileged RPC writes.
do $$ declare r record; begin
 for r in
 select c.conname,src.relname as source,dst.relname as target,sa.attname as source_column,da.attname as target_column,c.confdeltype
 from pg_constraint c join pg_class src on src.oid=c.conrelid join pg_namespace sn on sn.oid=src.relnamespace
 join pg_class dst on dst.oid=c.confrelid join pg_namespace dn on dn.oid=dst.relnamespace
 join pg_attribute sa on sa.attrelid=src.oid and sa.attnum=c.conkey[1]
 join pg_attribute da on da.attrelid=dst.oid and da.attnum=c.confkey[1]
 where c.contype='f' and cardinality(c.conkey)=1 and sn.nspname='public' and dn.nspname='public'
 and src.relname not in ('workspaces','activity_logs') and dst.relname<>'workspaces'
 loop
   execute format('alter table public.%I add constraint %I foreign key(workspace_id,%I) references public.%I(workspace_id,%I)%s',
     r.source,r.conname||'_workspace',r.source_column,r.target,r.target_column,
     case when r.confdeltype='c' then ' on delete cascade' else '' end);
 end loop;
end $$;

-- Catalog names and optional worker emails are unique only inside their own space.
alter table public.shift_types drop constraint shift_types_name_key;
alter table public.shift_types add unique(workspace_id,name);
drop index public.unique_worker_email;
create unique index unique_worker_email on public.worker_private_details(workspace_id,lower(email)) where email is not null and email<>'';
alter table public.worker_invitations drop constraint worker_invitations_email_key;
alter table public.worker_invitations add unique(workspace_id,email);
drop index public.unique_active_shift_occurrence;
create unique index unique_active_shift_occurrence on public.shifts(workspace_id,worker_id,starts_at,ends_at,type_id,(coalesce(location,''))) nulls not distinct where status<>'cancelled';

create function public.keep_workspace() returns trigger language plpgsql set search_path='' as $$ begin
 if new.workspace_id is distinct from old.workspace_id then raise exception 'FORBIDDEN: no se puede trasladar un registro de espacio' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.keep_workspace() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['workers','profiles','worker_private_details','worker_invitations','shift_types','shift_series','shifts','worker_absences','absence_private_notes','tasks','task_assignees','task_comments','task_attachments','logbook_entries','logbook_attachments','activity_logs','operation_requests'] loop
   execute format('create trigger immutable_workspace before update on public.%I for each row execute function public.keep_workspace()',t);
 end loop;
end $$;

create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_data jsonb; new_data jsonb; tenant uuid; begin
 if tg_op<>'INSERT' then old_data:=public.audit_payload(tg_table_name,to_jsonb(old)); end if;
 if tg_op<>'DELETE' then new_data:=public.audit_payload(tg_table_name,to_jsonb(new)); end if;
 tenant:=coalesce((to_jsonb(new)->>'workspace_id')::uuid,(to_jsonb(old)->>'workspace_id')::uuid);
 insert into public.activity_logs(actor_id,action,entity,entity_id,before_data,after_data,workspace_id)
 values(auth.uid(),tg_op,tg_table_name,coalesce(new.id,old.id),old_data,new_data,tenant);
 return coalesce(new,old);
end $$;

-- Every new administrator receives a new space; workers inherit their employer's space.
create function public.initialize_profile_workspace() returns trigger language plpgsql security definer set search_path='' as $$
declare tenant uuid; begin
 if new.role='admin' then
   if new.worker_id is not null then raise exception 'Un administrador independiente no puede vincularse a un trabajador de otro espacio'; end if;
   tenant:=new.id;
   -- Fresh installations retain the initial shift type UUIDs.
   if not exists(select 1 from public.profiles where role='admin')
      and exists(select 1 from public.workspaces where id='00000000-0000-4000-8000-ffffffffffff' and owner_id is null) then
     tenant:='00000000-0000-4000-8000-ffffffffffff';
     update public.workspaces set owner_id=new.id,name='Espacio de '||new.display_name where id=tenant;
   else
     insert into public.workspaces(id,owner_id,name) values(tenant,new.id,'Espacio de '||new.display_name);
   end if;
   new.workspace_id:=tenant;
   insert into public.shift_types(workspace_id,name,color) values
    (tenant,'Mañana','#00bfff'),(tenant,'Tarde','#9b87f5'),(tenant,'Noche','#f4af45'),(tenant,'Otro','#79beaa') on conflict(workspace_id,name) do nothing;
 else
   select workspace_id into tenant from public.workers where id=new.worker_id;
   if tenant is null then raise exception 'Trabajador no disponible'; end if;
   new.workspace_id:=tenant;
 end if;
 return new;
end $$;
revoke all on function public.initialize_profile_workspace() from public,anon,authenticated;
create trigger initialize_workspace before insert on public.profiles for each row execute function public.initialize_profile_workspace();
-- Give existing independent administrators only an empty catalog, never copied operations.
insert into public.shift_types(workspace_id,name,color)
 select w.id,v.name,v.color from public.workspaces w cross join (values
 ('Mañana','#00bfff'),('Tarde','#9b87f5'),('Noche','#f4af45'),('Otro','#79beaa')) as v(name,color)
 on conflict(workspace_id,name) do nothing;

create or replace function public.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.workers w on w.id=p.worker_id
 where p.id=auth.uid() and ((p.role='admin' and p.worker_id is null) or (w.active and w.workspace_id=p.workspace_id)));
$$;
create or replace function public.can_task(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active() and exists(select 1 from public.tasks t where t.id=target and t.workspace_id=public.current_workspace()
 and (public.is_admin() or exists(select 1 from public.task_assignees a where a.task_id=t.id and a.workspace_id=t.workspace_id and a.worker_id=public.my_worker_id())));
$$;
create or replace function public.can_entry(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active() and exists(select 1 from public.logbook_entries where id=target and workspace_id=public.current_workspace() and (visibility='team' or public.is_admin()));
$$;
create or replace function public.can_edit_entry(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active() and exists(select 1 from public.logbook_entries where id=target and workspace_id=public.current_workspace() and (public.is_admin() or (visibility='team' and created_by=auth.uid())));
$$;
create or replace function public.team_authors() returns table(user_id uuid,name text) language sql stable security definer set search_path='' as $$
 select p.id,p.display_name from public.profiles p where public.is_active() and p.workspace_id=public.current_workspace();
$$;
create or replace function public.set_avatar(target_worker uuid,object_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active() or not(public.is_admin() or target_worker=public.my_worker_id())
 or not exists(select 1 from public.workers where id=target_worker and workspace_id=public.current_workspace()) then raise exception 'FORBIDDEN'; end if;
 if object_path not like target_worker::text||'/'||auth.uid()::text||'/%' or not exists(select 1 from storage.objects where bucket_id='avatars' and name=object_path) then raise exception 'Archivo no válido'; end if;
 update public.workers set avatar_path=object_path where id=target_worker and workspace_id=public.current_workspace();
end $$;

create or replace function public.grant_administrator(account_email text, administrator_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; existing public.profiles; confirmed timestamptz; banned timestamptz; deleted timestamptz; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if administrator_name is null or account_email is null or length(btrim(administrator_name)) not between 2 and 120 or length(btrim(account_email)) not between 3 and 320 then raise exception 'Nombre o correo inválido' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('jet:administrator-grants',0));
 select id,email_confirmed_at,banned_until,deleted_at into target,confirmed,banned,deleted from auth.users where lower(email)=lower(btrim(account_email)) limit 1;
 if target is null then raise exception 'Crea primero una cuenta independiente en Supabase Auth y confirma su correo. No uses la invitación de trabajadores para crear un administrador independiente.'; end if;
 if confirmed is null or deleted is not null or banned>now() then raise exception 'La cuenta debe estar confirmada y habilitada antes de otorgar permisos.'; end if;
 select * into existing from public.profiles where id=target for update;
 if existing.role='admin' then return target; end if;
 if existing.id is not null then raise exception 'Esta cuenta ya pertenece a un equipo. Usa una cuenta diferente para crear un espacio independiente.'; end if;
 insert into public.profiles(id,role,display_name) values(target,'admin',btrim(administrator_name));
 return target;
end $$;

-- File paths retain their parent UUIDs. Permissions follow the parent's workspace.
drop policy files_read on storage.objects;
drop policy files_upload on storage.objects;
drop policy files_delete on storage.objects;
create policy files_read on storage.objects for select to authenticated using(public.is_active() and (
 (bucket_id='task-evidence' and public.can_task(public.file_parent(name))) or
 (bucket_id='logbook-evidence' and public.can_entry(public.file_parent(name))) or
 (bucket_id='avatars' and exists(select 1 from public.workers where id=public.file_parent(name) and workspace_id=public.current_workspace()))
));
create policy files_upload on storage.objects for insert to authenticated with check(public.is_active() and (storage.foldername(name))[2]=auth.uid()::text and (
 (bucket_id='task-evidence' and public.can_task(public.file_parent(name))) or
 (bucket_id='logbook-evidence' and public.can_edit_entry(public.file_parent(name))) or
 (bucket_id='avatars' and exists(select 1 from public.workers where id=public.file_parent(name) and workspace_id=public.current_workspace()) and (public.is_admin() or public.file_parent(name)=public.my_worker_id()))
));
create policy files_delete on storage.objects for delete to authenticated using(public.is_active() and (public.is_admin() or (storage.foldername(name))[2]=auth.uid()::text) and (
 (bucket_id='task-evidence' and public.can_task(public.file_parent(name))) or
 (bucket_id='logbook-evidence' and public.can_entry(public.file_parent(name))) or
 (bucket_id='avatars' and exists(select 1 from public.workers where id=public.file_parent(name) and workspace_id=public.current_workspace()) and (public.is_admin() or public.file_parent(name)=public.my_worker_id()))
));
notify pgrst,'reload schema';
commit;
