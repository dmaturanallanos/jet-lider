alter publication supabase_realtime add table public.workers;
create function public.worker_impact(target uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object('shifts',(select count(*) from public.shifts where worker_id=target and ends_at>now() and status<>'cancelled'),'tasks',(select count(*) from public.tasks t where t.status not in ('completed','cancelled') and exists(select 1 from public.task_assignees a where a.task_id=t.id and a.worker_id=target)));
end $$;
revoke all on function public.worker_impact(uuid) from public,anon;
grant execute on function public.worker_impact(uuid) to authenticated;
create function public.dashboard_summary(day date,week_start date) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'today_workers',(select count(distinct worker_id) from public.shifts where status<>'cancelled' and starts_at<(day+1)::timestamp at time zone 'America/Santiago' and ends_at>day::timestamp at time zone 'America/Santiago'),
 'unassigned',(select count(*) from public.shifts where worker_id is null and status<>'cancelled' and starts_at>=(week_start::timestamp at time zone 'America/Santiago') and starts_at<((week_start+7)::timestamp at time zone 'America/Santiago')),
 'open',(select count(*) from public.tasks where status in ('pending','in_progress')),
 'urgent',(select count(*) from public.tasks where status in ('pending','in_progress') and priority='urgent'),
 'overdue',(select count(*) from public.tasks where status in ('pending','in_progress') and due_at<now())
 );
$$;
revoke all on function public.dashboard_summary(date,date) from public,anon;
grant execute on function public.dashboard_summary(date,date) to authenticated;
-- Own-entry writes also apply to its photographs; shared visibility grants read access only.
create function public.can_edit_entry(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active() and exists(select 1 from public.logbook_entries where id=target and (public.is_admin() or (visibility='team' and created_by=auth.uid())));
$$;
revoke all on function public.can_edit_entry(uuid) from public,anon;
grant execute on function public.can_edit_entry(uuid) to authenticated;
drop policy entry_files_insert on public.logbook_attachments;
create policy entry_files_insert on public.logbook_attachments for insert to authenticated with check(public.can_edit_entry(entry_id) and created_by=auth.uid() and path like entry_id::text||'/'||auth.uid()::text||'/%');
drop policy files_upload on storage.objects;
create policy files_upload on storage.objects for insert to authenticated with check(public.is_active() and (storage.foldername(name))[2]=auth.uid()::text and (
 (bucket_id='task-evidence' and public.can_task(public.file_parent(name))) or
 (bucket_id='logbook-evidence' and public.can_edit_entry(public.file_parent(name))) or
 (bucket_id='avatars' and (public.is_admin() or public.file_parent(name)=public.my_worker_id()))
));
