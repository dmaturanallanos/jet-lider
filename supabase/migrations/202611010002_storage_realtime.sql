insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('task-evidence','task-evidence',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('logbook-evidence','logbook-evidence',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp']);
create function public.file_parent(path text) returns uuid language plpgsql immutable set search_path='' as $$ begin return split_part(path,'/',1)::uuid; exception when invalid_text_representation then return null; end $$;
revoke all on function public.file_parent(text) from public;
grant execute on function public.file_parent(text) to authenticated;
create policy files_read on storage.objects for select to authenticated using(public.is_active() and (
 (bucket_id='task-evidence' and public.can_task(public.file_parent(name))) or
 (bucket_id='logbook-evidence' and public.can_entry(public.file_parent(name))) or
 (bucket_id='avatars' and exists(select 1 from public.workers where id=public.file_parent(name)))
));
create policy files_upload on storage.objects for insert to authenticated with check(public.is_active() and (storage.foldername(name))[2]=auth.uid()::text and (
 (bucket_id='task-evidence' and public.can_task(public.file_parent(name))) or
 (bucket_id='logbook-evidence' and public.can_entry(public.file_parent(name))) or
 (bucket_id='avatars' and (public.is_admin() or public.file_parent(name)=public.my_worker_id()))
));
create policy files_delete on storage.objects for delete to authenticated using(public.is_active() and (public.is_admin() or (storage.foldername(name))[2]=auth.uid()::text) and (
 (bucket_id='task-evidence' and public.can_task(public.file_parent(name))) or
 (bucket_id='logbook-evidence' and public.can_entry(public.file_parent(name))) or
 (bucket_id='avatars' and (public.is_admin() or public.file_parent(name)=public.my_worker_id()))
));
alter publication supabase_realtime add table public.shifts, public.worker_absences, public.tasks, public.logbook_entries;
