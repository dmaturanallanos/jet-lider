create function public.set_avatar(target_worker uuid,object_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active() or not(public.is_admin() or target_worker=public.my_worker_id()) then raise exception 'FORBIDDEN'; end if;
 if object_path not like target_worker::text||'/'||auth.uid()::text||'/%' or not exists(select 1 from storage.objects where bucket_id='avatars' and name=object_path) then raise exception 'Archivo no válido'; end if;
 update public.workers set avatar_path=object_path where id=target_worker;
end $$;
revoke all on function public.set_avatar(uuid,text) from public,anon;
grant execute on function public.set_avatar(uuid,text) to authenticated;
