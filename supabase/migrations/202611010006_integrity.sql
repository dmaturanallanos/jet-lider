alter table public.worker_absences drop constraint worker_absences_check;
alter table public.worker_absences add constraint absence_period_valid check(
 (all_day and start_date is not null and end_date is not null and end_date>=start_date and starts_at is null and ends_at is null) or
 (not all_day and starts_at is not null and ends_at is not null and ends_at>starts_at and start_date is null and end_date is null)
);
create function public.team_authors() returns table(user_id uuid,name text) language sql stable security definer set search_path='' as $$
 select p.id,p.display_name from public.profiles p where public.is_active();
$$;
revoke all on function public.team_authors() from public,anon;
grant execute on function public.team_authors() to authenticated;
-- Existing inactive assignees may remain for history; only new assignments are checked.
create or replace function public.save_task(payload jsonb, assignees uuid[], expected_version integer default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid; begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if expected_version is null then
 insert into public.tasks(title,description,priority,status,due_at,location) values(payload->>'title',payload->>'description',payload->>'priority',payload->>'status',nullif(payload->>'due_at','')::timestamptz,payload->>'location') returning id into target;
 else
 update public.tasks set title=payload->>'title',description=payload->>'description',priority=payload->>'priority',status=payload->>'status',due_at=nullif(payload->>'due_at','')::timestamptz,location=payload->>'location' where id=(payload->>'id')::uuid and version=expected_version returning id into target;
 if not found then raise exception 'CONFLICT: tarea modificada'; end if;
 end if;
 delete from public.task_assignees where task_id=target and worker_id<>all(assignees);
 insert into public.task_assignees(task_id,worker_id) select target,x.worker_id from (select distinct unnest(assignees) as worker_id) x where not exists(select 1 from public.task_assignees a where a.task_id=target and a.worker_id=x.worker_id);
 return target;
end $$;
