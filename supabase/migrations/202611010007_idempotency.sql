-- Repeated copies must not create duplicate vacancies either.
create unique index unique_active_shift_occurrence on public.shifts(worker_id,starts_at,ends_at,type_id,(coalesce(location,''))) nulls not distinct where status<>'cancelled';
create or replace function public.save_worker(payload jsonb, private_data jsonb, expected_version integer default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid; begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if expected_version is null then
  target:=coalesce((payload->>'request_id')::uuid,gen_random_uuid());
  insert into public.workers(id,full_name,nickname,job_title,color,joined_on) values(target,payload->>'full_name',nullif(payload->>'nickname',''),nullif(payload->>'job_title',''),coalesce(payload->>'color','#00bfff'),nullif(payload->>'joined_on','')::date) on conflict(id) do nothing;
  if not found then return target; end if;
 else
  update public.workers set full_name=payload->>'full_name',nickname=nullif(payload->>'nickname',''),job_title=nullif(payload->>'job_title',''),color=payload->>'color',joined_on=nullif(payload->>'joined_on','')::date,active=(payload->>'active')::boolean where id=(payload->>'id')::uuid and version=expected_version returning id into target;
  if target is null then raise exception 'CONFLICT: otra persona modificó este trabajador'; end if;
 end if;
 insert into public.worker_private_details(id,email,phone,notes) values(target,nullif(lower(trim(private_data->>'email')),''),private_data->>'phone',private_data->>'notes') on conflict(id) do update set email=excluded.email,phone=excluded.phone,notes=excluded.notes;
 return target;
end $$;
