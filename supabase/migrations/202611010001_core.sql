create extension if not exists btree_gist;
create table public.workers (
 id uuid primary key default gen_random_uuid(), full_name text not null check(length(trim(full_name)) between 2 and 120),
 nickname text, job_title text, color text not null default '#00bfff' check(color ~ '^#[0-9A-Fa-f]{6}$'),
 active boolean not null default true, joined_on date, avatar_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.profiles (
 id uuid primary key references auth.users(id), worker_id uuid unique references public.workers(id),
 role text not null default 'worker' check(role in ('admin','worker')), display_name text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 check(role='admin' or worker_id is not null)
);
create unique index only_one_admin on public.profiles(role) where role='admin';
create table public.worker_private_details (
 id uuid primary key references public.workers(id), phone text, email text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create unique index unique_worker_email on public.worker_private_details(lower(email)) where email is not null and email <> '';
create table public.worker_invitations (
 id uuid primary key default gen_random_uuid(), worker_id uuid not null unique references public.workers(id), email text not null unique,
 auth_user_id uuid unique references auth.users(id), status text not null default 'pending' check(status in ('pending','sent','linked','failed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.shift_types (
 id uuid primary key default gen_random_uuid(), name text not null unique, color text not null default '#00bfff',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
insert into public.shift_types(name,color) values ('Mañana','#00bfff'),('Tarde','#9b87f5'),('Noche','#f4af45'),('Otro','#79beaa');
create table public.shift_series (
 id uuid primary key default gen_random_uuid(), description text not null, created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.shifts (
 id uuid primary key default gen_random_uuid(), worker_id uuid references public.workers(id), type_id uuid not null references public.shift_types(id),
 starts_at timestamptz not null, ends_at timestamptz not null, break_minutes integer not null default 0,
 location text, notes text, status text not null default 'scheduled' check(status in ('scheduled','confirmed','cancelled')),
 series_id uuid references public.shift_series(id), created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 check(ends_at>starts_at), check(break_minutes>=0 and break_minutes*60<=extract(epoch from ends_at-starts_at)),
 exclude using gist(worker_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelled' and worker_id is not null)
);
create index shifts_range on public.shifts(starts_at,ends_at);
create index shifts_series on public.shifts(series_id);
create table public.worker_absences (
 id uuid primary key default gen_random_uuid(), worker_id uuid not null references public.workers(id), type text not null,
 all_day boolean not null default true, start_date date, end_date date, starts_at timestamptz, ends_at timestamptz,
 shared_note text, created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 check((all_day and start_date is not null and end_date>=start_date and starts_at is null and ends_at is null) or
 (not all_day and starts_at is not null and ends_at>starts_at and start_date is null and end_date is null))
);
create index absence_worker on public.worker_absences(worker_id);
create table public.absence_private_notes (
 id uuid primary key references public.worker_absences(id), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 2 and 180), description text,
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
 status text not null default 'pending' check(status in ('pending','in_progress','completed','cancelled')), due_at timestamptz, location text,
 completed_at timestamptz, completed_by uuid references public.profiles(id), created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create index tasks_due on public.tasks(due_at,status);
create table public.task_assignees (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id), worker_id uuid not null references public.workers(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(task_id,worker_id)
);
create index assignees_worker on public.task_assignees(worker_id,task_id);
create table public.task_comments (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id), body text not null check(length(trim(body)) between 1 and 5000),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.logbook_entries (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 2 and 180), description text not null,
 type text not null default 'Observación', period text not null default 'day' check(period in ('day','week')), entry_date date not null,
 visibility text not null default 'team' check(visibility in ('team','admin')), pinned boolean not null default false,
 worker_id uuid references public.workers(id), shift_id uuid references public.shifts(id), task_id uuid references public.tasks(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create index logbook_date on public.logbook_entries(entry_date,visibility);
create table public.task_attachments (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id), path text not null unique,
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.logbook_attachments (
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.logbook_entries(id), path text not null unique,
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.activity_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null, entity text not null, entity_id uuid not null,
 before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create index activity_date on public.activity_logs(created_at desc);
create table public.operation_requests (
 id uuid primary key, actor_id uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now()
);

create function public.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.workers w on w.id=p.worker_id where p.id=auth.uid() and (p.role='admin' or w.active));
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create function public.my_worker_id() returns uuid language sql stable security definer set search_path='' as $$
 select worker_id from public.profiles where id=auth.uid() and public.is_active();
$$;
create function public.can_task(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active() and (public.is_admin() or exists(select 1 from public.task_assignees where task_id=target and worker_id=public.my_worker_id()));
$$;
create function public.can_entry(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active() and exists(select 1 from public.logbook_entries where id=target and (visibility='team' or public.is_admin()));
$$;

create function public.guard_record() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if new.version<>old.version then raise exception 'VERSION: versión inválida'; end if;
   new.version:=old.version+1; new.updated_at:=clock_timestamp();
 end if;
 if not public.is_admin() and auth.role()<>'service_role' then
   if tg_table_name='profiles' then
     if tg_op<>'UPDATE' or (to_jsonb(new)-array['display_name','updated_at','version'])<>(to_jsonb(old)-array['display_name','updated_at','version']) then raise exception 'FORBIDDEN: perfil protegido'; end if;
   elsif tg_table_name='tasks' then
     if tg_op<>'UPDATE' or (to_jsonb(new)-array['status','completed_at','completed_by','updated_at','version'])<>(to_jsonb(old)-array['status','completed_at','completed_by','updated_at','version']) or new.status='cancelled' or old.status in ('cancelled','completed') then raise exception 'FORBIDDEN: tarea protegida'; end if;
   elsif tg_table_name='logbook_entries' then
     if new.visibility<>'team' or new.pinned or (tg_op='UPDATE' and (new.created_by<>old.created_by or new.created_at<>old.created_at)) then raise exception 'FORBIDDEN: bitácora protegida'; end if;
   end if;
 end if;
 if tg_table_name='tasks' then
   if new.status='completed' then new.completed_at:=case when tg_op='UPDATE' and old.status='completed' then old.completed_at else now() end; new.completed_by:=case when tg_op='UPDATE' and old.status='completed' then old.completed_by else auth.uid() end;
   else new.completed_at:=null; new.completed_by:=null; end if;
 end if;
 return new;
end $$;

create function public.guard_assignment() returns trigger language plpgsql security definer set search_path='' as $$
declare w uuid; a timestamptz; b timestamptz;
begin
 w:=new.worker_id; if w is null then return new; end if;
 -- Same lock for shifts, absences, assignments and deactivation. Held until commit.
 perform 1 from public.workers where id=w for update;
 if tg_table_name='shifts' then
  if new.status='cancelled' then return new; end if;
 end if;
 if exists(select 1 from public.workers where id=w and not active) then raise exception 'INACTIVE: trabajador inactivo'; end if;
 if tg_table_name='shifts' then
   if exists(select 1 from public.worker_absences x where x.worker_id=w and tstzrange(new.starts_at,new.ends_at,'[)') &&
     case when x.all_day then tstzrange(x.start_date::timestamp at time zone 'America/Santiago',(x.end_date+1)::timestamp at time zone 'America/Santiago','[)') else tstzrange(x.starts_at,x.ends_at,'[)') end) then raise exception 'ABSENCE: el turno coincide con una ausencia'; end if;
 elsif tg_table_name='worker_absences' then
   if new.all_day then a:=new.start_date::timestamp at time zone 'America/Santiago'; b:=(new.end_date+1)::timestamp at time zone 'America/Santiago'; else a:=new.starts_at; b:=new.ends_at; end if;
   if exists(select 1 from public.shifts s where s.worker_id=w and s.status<>'cancelled' and tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange(a,b,'[)')) then raise exception 'SHIFT_CONFLICT: existen turnos; modifícalos antes de registrar la ausencia'; end if;
 end if;
 return new;
end $$;
create trigger assignment_guard before insert or update on public.shifts for each row execute function public.guard_assignment();
create trigger absence_guard before insert or update on public.worker_absences for each row execute function public.guard_assignment();
create trigger task_assignment_guard before insert or update on public.task_assignees for each row execute function public.guard_assignment();

create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_data jsonb; new_data jsonb;
begin
 -- Audit only operational fields; omit contact data, private notes and attachment URLs.
 if tg_op<>'INSERT' then select jsonb_object_agg(key,value) into old_data from jsonb_each(to_jsonb(old)) where key=any(array['status','active','worker_id','starts_at','ends_at','break_minutes','type_id','title','description','visibility','pinned','priority','due_at','version']); end if;
 if tg_op<>'DELETE' then select jsonb_object_agg(key,value) into new_data from jsonb_each(to_jsonb(new)) where key=any(array['status','active','worker_id','starts_at','ends_at','break_minutes','type_id','title','description','visibility','pinned','priority','due_at','version']); end if;
 insert into public.activity_logs(actor_id,action,entity,entity_id,before_data,after_data) values(auth.uid(),tg_op,tg_table_name,coalesce(new.id,old.id),old_data,new_data);
 return coalesce(new,old);
end $$;

do $$ declare t text; begin
 foreach t in array array['workers','profiles','worker_private_details','worker_invitations','shift_types','shift_series','shifts','worker_absences','absence_private_notes','tasks','task_assignees','task_comments','task_attachments','logbook_entries','logbook_attachments'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('create trigger record_guard before insert or update on public.%I for each row execute function public.guard_record()',t);
   execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;
alter table public.activity_logs enable row level security;
alter table public.operation_requests enable row level security;

create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy profiles_self on public.profiles for update to authenticated using(id=auth.uid() and public.is_active()) with check(id=auth.uid());
do $$ declare t text; begin
 foreach t in array array['workers','shift_types','shifts','shift_series','worker_absences'] loop
  execute format('create policy shared_read on public.%I for select to authenticated using(public.is_active())',t);
  execute format('create policy admin_write on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
 foreach t in array array['worker_private_details','worker_invitations','absence_private_notes'] loop
  execute format('create policy admin_only on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;
-- Self contact access is separate from admin notes; exposed through a narrow function below.
create policy tasks_read on public.tasks for select to authenticated using(public.can_task(id));
create policy tasks_admin on public.tasks for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy tasks_progress on public.tasks for update to authenticated using(public.can_task(id)) with check(public.can_task(id));
create policy assignees_read on public.task_assignees for select to authenticated using(public.can_task(task_id));
create policy assignees_admin on public.task_assignees for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy comments_read on public.task_comments for select to authenticated using(public.can_task(task_id));
create policy comments_insert on public.task_comments for insert to authenticated with check(public.can_task(task_id) and created_by=auth.uid());
create policy entries_read on public.logbook_entries for select to authenticated using(public.is_active() and (visibility='team' or public.is_admin()));
create policy entries_insert on public.logbook_entries for insert to authenticated with check(public.is_active() and created_by=auth.uid() and (public.is_admin() or (visibility='team' and not pinned)) and (task_id is null or public.can_task(task_id)));
create policy entries_update on public.logbook_entries for update to authenticated using(public.is_active() and (public.is_admin() or (created_by=auth.uid() and visibility='team'))) with check(public.is_active() and (public.is_admin() or (created_by=auth.uid() and visibility='team')) and (task_id is null or public.can_task(task_id)));
create policy task_files_read on public.task_attachments for select to authenticated using(public.can_task(task_id));
create policy task_files_insert on public.task_attachments for insert to authenticated with check(public.can_task(task_id) and created_by=auth.uid() and path like task_id::text||'/'||auth.uid()::text||'/%');
create policy task_files_delete on public.task_attachments for delete to authenticated using(public.can_task(task_id) and (created_by=auth.uid() or public.is_admin()));
create policy entry_files_read on public.logbook_attachments for select to authenticated using(public.can_entry(entry_id));
create policy entry_files_insert on public.logbook_attachments for insert to authenticated with check(public.can_entry(entry_id) and created_by=auth.uid() and path like entry_id::text||'/'||auth.uid()::text||'/%');
create policy entry_files_delete on public.logbook_attachments for delete to authenticated using(public.can_entry(entry_id) and (created_by=auth.uid() or public.is_admin()));
create policy audit_admin on public.activity_logs for select to authenticated using(public.is_admin());
create policy requests_admin on public.operation_requests for all to authenticated using(public.is_admin()) with check(public.is_admin() and actor_id=auth.uid());

-- All mutation RPCs use caller RLS and require explicit authorization.
create function public.save_worker(payload jsonb, private_data jsonb, expected_version integer default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid; begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if expected_version is null then
  insert into public.workers(full_name,nickname,job_title,color,joined_on) values(payload->>'full_name',nullif(payload->>'nickname',''),nullif(payload->>'job_title',''),coalesce(payload->>'color','#00bfff'),nullif(payload->>'joined_on','')::date) returning id into target;
 else
  update public.workers set full_name=payload->>'full_name',nickname=nullif(payload->>'nickname',''),job_title=nullif(payload->>'job_title',''),color=payload->>'color',joined_on=nullif(payload->>'joined_on','')::date,active=(payload->>'active')::boolean where id=(payload->>'id')::uuid and version=expected_version returning id into target;
  if target is null then raise exception 'CONFLICT: otra persona modificó este trabajador'; end if;
 end if;
 insert into public.worker_private_details(id,email,phone,notes) values(target,nullif(lower(trim(private_data->>'email')),''),private_data->>'phone',private_data->>'notes') on conflict(id) do update set email=excluded.email,phone=excluded.phone,notes=excluded.notes;
 return target;
end $$;

create function public.save_shift_batch(request_id uuid, items jsonb, series_description text default null) returns integer language plpgsql security invoker set search_path='' as $$
declare item jsonb; series uuid; n integer:=0; target uuid; begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if jsonb_array_length(items) not between 1 and 500 then raise exception 'VALIDATION: máximo 500 turnos'; end if;
 insert into public.operation_requests(id) values(request_id) on conflict do nothing;
 if not found then return 0; end if;
 if series_description is not null then insert into public.shift_series(description) values(series_description) returning id into series; end if;
 -- Lock workers in deterministic order to reduce deadlocks.
 perform 1 from public.workers where id in (select (value->>'worker_id')::uuid from jsonb_array_elements(items)) order by id for update;
 for item in select value from jsonb_array_elements(items) loop
  if item ? 'id' then
   update public.shifts set worker_id=nullif(item->>'worker_id','')::uuid,type_id=(item->>'type_id')::uuid,starts_at=(item->>'starts_at')::timestamptz,ends_at=(item->>'ends_at')::timestamptz,break_minutes=(item->>'break_minutes')::integer,location=item->>'location',notes=item->>'notes',status=item->>'status'
    where id=(item->>'id')::uuid and version=(item->>'version')::integer returning id into target;
   if not found then raise exception 'CONFLICT: turno modificado; recarga la vista'; end if;
  else
   insert into public.shifts(worker_id,type_id,starts_at,ends_at,break_minutes,location,notes,status,series_id) values(nullif(item->>'worker_id','')::uuid,(item->>'type_id')::uuid,(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz,coalesce((item->>'break_minutes')::integer,0),item->>'location',item->>'notes',coalesce(item->>'status','scheduled'),series);
  end if; n:=n+1;
 end loop; return n;
end $$;

create function public.save_task(payload jsonb, assignees uuid[], expected_version integer default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid; begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if expected_version is null then
 insert into public.tasks(title,description,priority,status,due_at,location) values(payload->>'title',payload->>'description',payload->>'priority',payload->>'status',nullif(payload->>'due_at','')::timestamptz,payload->>'location') returning id into target;
 else
 update public.tasks set title=payload->>'title',description=payload->>'description',priority=payload->>'priority',status=payload->>'status',due_at=nullif(payload->>'due_at','')::timestamptz,location=payload->>'location' where id=(payload->>'id')::uuid and version=expected_version returning id into target;
 if not found then raise exception 'CONFLICT: tarea modificada'; end if;
 end if;
 delete from public.task_assignees where task_id=target and worker_id<>all(assignees);
 insert into public.task_assignees(task_id,worker_id) select target,unnest(assignees) on conflict(task_id,worker_id) do nothing;
 return target;
end $$;

create function public.save_absence(payload jsonb, private_note text) returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid; begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 insert into public.worker_absences(worker_id,type,all_day,start_date,end_date,starts_at,ends_at,shared_note) values((payload->>'worker_id')::uuid,payload->>'type',(payload->>'all_day')::boolean,nullif(payload->>'start_date','')::date,nullif(payload->>'end_date','')::date,nullif(payload->>'starts_at','')::timestamptz,nullif(payload->>'ends_at','')::timestamptz,payload->>'shared_note') returning id into target;
 insert into public.absence_private_notes(id,notes) values(target,private_note); return target;
end $$;
create function public.my_contact() returns table(email text,phone text) language sql stable security definer set search_path='' as $$ select d.email,d.phone from public.worker_private_details d where d.id=public.my_worker_id() $$;

-- No callable privileged mutations for authenticated users.
revoke all on all functions in schema public from public, anon;
grant execute on function public.is_active(),public.is_admin(),public.my_worker_id(),public.can_task(uuid),public.can_entry(uuid),public.my_contact(),public.save_worker(jsonb,jsonb,integer),public.save_shift_batch(uuid,jsonb,text),public.save_task(jsonb,uuid[],integer),public.save_absence(jsonb,text) to authenticated;
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
revoke all on public.profiles from authenticated;
grant select,update(display_name) on public.profiles to authenticated;
revoke insert,update,delete on public.activity_logs from authenticated;
