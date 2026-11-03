begin;
create table public.shift_attendance (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null default public.current_workspace() references public.workspaces(id),
 shift_id uuid not null unique, worker_id uuid not null,
 status text not null check(status in ('present','absent')), notes text not null default '' check(length(notes)<=1000),
 created_by uuid not null default auth.uid() references public.profiles(id), updated_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(workspace_id,id),
 foreign key(workspace_id,shift_id) references public.shifts(workspace_id,id) on delete cascade,
 foreign key(workspace_id,worker_id) references public.workers(workspace_id,id),
 foreign key(workspace_id,created_by) references public.profiles(workspace_id,id),
 foreign key(workspace_id,updated_by) references public.profiles(workspace_id,id)
);
create index attendance_workspace on public.shift_attendance(workspace_id,shift_id);
alter table public.shift_attendance enable row level security;
revoke all on public.shift_attendance from anon,authenticated;
grant select on public.shift_attendance to authenticated;
grant all on public.shift_attendance to service_role;
create policy attendance_admin_read on public.shift_attendance for select to authenticated
 using(public.is_admin() and workspace_id=public.current_workspace());
create trigger immutable_workspace before update on public.shift_attendance for each row execute function public.keep_workspace();
create trigger record_guard before insert or update on public.shift_attendance for each row execute function public.guard_record();
create trigger audit after insert or update or delete on public.shift_attendance for each row execute function public.audit_change();

create function public.attendance_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.shifts; begin
 select * into s from public.shifts where id=new.shift_id for update;
 if s.id is null or new.worker_id is null or s.workspace_id<>new.workspace_id or s.worker_id is distinct from new.worker_id
 or s.status='cancelled' or (s.starts_at at time zone 'America/Santiago')::date>(now() at time zone 'America/Santiago')::date then
   raise exception 'Solo puedes registrar asistencia de un turno asignado, no cancelado y del día actual o anterior.' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.attendance_guard() from public,anon,authenticated;
create trigger valid_attendance before insert or update on public.shift_attendance for each row execute function public.attendance_guard();

create function public.protect_attended_shift() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if (new.worker_id is distinct from old.worker_id or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at or new.status='cancelled' and old.status<>'cancelled')
 and exists(select 1 from public.shift_attendance where shift_id=old.id) then
   raise exception 'Quita primero el registro de asistencia antes de reasignar, cambiar el horario o cancelar este turno.';
 end if;
 return new;
end $$;
revoke all on function public.protect_attended_shift() from public,anon,authenticated;
create trigger protect_attendance before update on public.shifts for each row execute function public.protect_attended_shift();

create function public.save_attendance(target_shift uuid, attendance_status text, attendance_notes text, expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare s public.shifts; previous public.shift_attendance; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into s from public.shifts where id=target_shift and workspace_id=public.current_workspace() for update;
 if s.id is null then raise exception 'Turno no disponible'; end if;
 if attendance_status is null or attendance_status not in ('present','absent','pending') then raise exception 'Asistencia inválida'; end if;
 if attendance_notes is null or length(attendance_notes)>1000 or expected_version is null or expected_version<0 then raise exception 'Datos de asistencia inválidos'; end if;
 select * into previous from public.shift_attendance where shift_id=s.id for update;
 if coalesce(previous.version,0)<>expected_version then raise exception 'La asistencia cambió. Recarga el turno antes de guardar para no sobrescribir otra edición.' using errcode='40001'; end if;
 if attendance_status='pending' then
   delete from public.shift_attendance where shift_id=s.id;
 elsif previous.id is null then
   insert into public.shift_attendance(workspace_id,shift_id,worker_id,status,notes) values(s.workspace_id,s.id,s.worker_id,attendance_status,attendance_notes);
 else
   update public.shift_attendance set status=attendance_status,notes=attendance_notes,updated_by=auth.uid() where id=previous.id;
 end if;
end $$;
revoke all on function public.save_attendance(uuid,text,text,integer) from public,anon,service_role;
grant execute on function public.save_attendance(uuid,text,text,integer) to authenticated;

-- Single-statement snapshot; weeks group overnight shifts by their Chilean start date.
create function public.attendance_week(week_start date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if week_start is null or extract(isodow from week_start)<>1 then raise exception 'La semana debe comenzar el lunes'; end if;
 if (select count(*) from public.shifts where starts_at>=(week_start::timestamp at time zone 'America/Santiago') and starts_at<((week_start+7)::timestamp at time zone 'America/Santiago'))>10000 then raise exception 'La semana supera 10000 turnos. Divide el informe antes de exportar.'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at,r.worker_name,r.id),'[]'::jsonb) into result from (
 select s.id,s.worker_id,coalesce(w.full_name,'Sin asignar') as worker_name,s.starts_at,s.ends_at,s.break_minutes,s.status as shift_status,
 t.name as shift_type,coalesce(s.location,'') as location,a.status as attendance_status,coalesce(a.notes,'') as attendance_notes,
 a.updated_at as marked_at,coalesce(p.display_name,'') as marked_by
 from public.shifts s join public.shift_types t on t.id=s.type_id
 left join public.workers w on w.id=s.worker_id left join public.shift_attendance a on a.shift_id=s.id
 left join public.profiles p on p.id=a.updated_by
 where s.starts_at>=(week_start::timestamp at time zone 'America/Santiago') and s.starts_at<((week_start+7)::timestamp at time zone 'America/Santiago')
 ) r;
 return result;
end $$;
revoke all on function public.attendance_week(date) from public,anon,service_role;
grant execute on function public.attendance_week(date) to authenticated;

-- Admin-only corrections. Related historical records block deletion instead of disappearing silently.
create function public.delete_operational_record(record_kind text,target_id uuid,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid; v integer; files jsonb:='[]'::jsonb; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 tenant:=public.current_workspace();
 if record_kind='entry' then
   select version into v from public.logbook_entries where id=target_id and workspace_id=tenant for update;
 elsif record_kind='task' then
   select version into v from public.tasks where id=target_id and workspace_id=tenant for update;
 elsif record_kind='comment' then
   select version into v from public.task_comments where id=target_id and workspace_id=tenant for update;
 elsif record_kind='worker' then
   select version into v from public.workers where id=target_id and workspace_id=tenant for update;
 else raise exception 'Tipo de registro inválido'; end if;
 if v is null or expected_version is null or v<>expected_version then raise exception 'El registro cambió o ya no está disponible. Recarga antes de eliminar.' using errcode='40001'; end if;
 if record_kind='entry' then
   select coalesce(jsonb_agg(jsonb_build_object('bucket','logbook-evidence','path',path)),'[]'::jsonb) into files from public.logbook_attachments where entry_id=target_id and workspace_id=tenant;
   delete from public.logbook_attachments where entry_id=target_id and workspace_id=tenant;
   delete from public.logbook_entries where id=target_id and workspace_id=tenant;
 elsif record_kind='task' then
   if exists(select 1 from public.logbook_entries where task_id=target_id) then raise exception 'La tarea está relacionada con la bitácora. Corrige o elimina esas referencias antes de borrar la tarea.'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('bucket','task-evidence','path',path)),'[]'::jsonb) into files from public.task_attachments where task_id=target_id and workspace_id=tenant;
   delete from public.task_attachments where task_id=target_id and workspace_id=tenant;
   delete from public.task_comments where task_id=target_id and workspace_id=tenant;
   delete from public.task_assignees where task_id=target_id and workspace_id=tenant;
   delete from public.tasks where id=target_id and workspace_id=tenant;
 elsif record_kind='comment' then
   delete from public.task_comments where id=target_id and workspace_id=tenant;
 else
   if exists(select 1 from public.profiles where worker_id=target_id) then raise exception 'Este trabajador tiene una cuenta vinculada. Desactívalo para conservar su historial y bloquear su acceso.'; end if;
   if exists(select 1 from public.shifts where worker_id=target_id) or exists(select 1 from public.worker_absences where worker_id=target_id)
      or exists(select 1 from public.task_assignees where worker_id=target_id) or exists(select 1 from public.logbook_entries where worker_id=target_id) then
      raise exception 'Este trabajador conserva turnos, ausencias, tareas o registros de bitácora. Corrige esas relaciones primero o desactívalo para conservar el historial.';
   end if;
   select coalesce(jsonb_agg(jsonb_build_object('bucket','avatars','path',avatar_path)),'[]'::jsonb) into files from public.workers where id=target_id and avatar_path is not null;
   delete from public.worker_invitations where worker_id=target_id and workspace_id=tenant;
   delete from public.worker_private_details where id=target_id and workspace_id=tenant;
   delete from public.workers where id=target_id and workspace_id=tenant;
 end if;
 return files;
end $$;
revoke all on function public.delete_operational_record(text,uuid,integer) from public,anon,service_role;
grant execute on function public.delete_operational_record(text,uuid,integer) to authenticated;

create or replace function public.audit_payload(entity_name text,document jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_object_agg(key,value) from jsonb_each(document)
 where key=any(array['status','active','worker_id','starts_at','ends_at','start_date','end_date','all_day','break_minutes','type_id','type','title','description','visibility','pinned','priority','due_at','location','shared_note','entry_date','period','series_id','task_id','shift_id','completed_at','completed_by','version'])
 or (entity_name in ('shifts','shift_attendance') and key='notes') or (entity_name='profiles' and key='role') or (entity_name='task_comments' and key='body');
$$;
alter publication supabase_realtime add table public.shift_attendance;
notify pgrst,'reload schema';
commit;
