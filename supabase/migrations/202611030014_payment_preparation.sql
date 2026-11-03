begin;
-- Employment/payment modality is private HR information, never part of the shared calendar.
alter table public.worker_private_details add column employment_type text check(employment_type in ('boleta','contrato'));
create table public.payment_entries (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null default public.current_workspace() references public.workspaces(id),
 worker_id uuid not null,week_start date not null check(extract(isodow from week_start)=1),
 overtime_minutes integer not null default 0 check(overtime_minutes between 0 and 10080),
 additions integer not null default 0 check(additions between 0 and 1000000000),
 deductions integer not null default 0 check(deductions between 0 and 1000000000),
 contract_net integer check(contract_net between 0 and 1000000000),
 notes text not null default '' check(length(notes)<=2000),
 created_by uuid not null default auth.uid() references public.profiles(id),updated_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,
 unique(workspace_id,worker_id,week_start),unique(workspace_id,id),
 foreign key(workspace_id,worker_id) references public.workers(workspace_id,id),
 foreign key(workspace_id,created_by) references public.profiles(workspace_id,id),foreign key(workspace_id,updated_by) references public.profiles(workspace_id,id)
);
create index payment_week_lookup on public.payment_entries(workspace_id,week_start);
alter table public.payment_entries enable row level security;
revoke all on public.payment_entries from anon,authenticated;
grant select on public.payment_entries to authenticated;
grant all on public.payment_entries to service_role;
create policy payments_admin on public.payment_entries for select to authenticated using(public.is_admin() and workspace_id=public.current_workspace());
create trigger immutable_workspace before update on public.payment_entries for each row execute function public.keep_workspace();
create trigger record_guard before insert or update on public.payment_entries for each row execute function public.guard_record();
create trigger audit after insert or update or delete on public.payment_entries for each row execute function public.audit_change();

create or replace function public.save_worker(payload jsonb, private_data jsonb, expected_version integer default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid; begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if expected_version is null then
  target:=coalesce((payload->>'request_id')::uuid,gen_random_uuid());
  insert into public.workers(id,full_name,nickname,job_title,color,joined_on) values(target,payload->>'full_name',nullif(payload->>'nickname',''),nullif(payload->>'job_title',''),coalesce(payload->>'color','#00bfff'),nullif(payload->>'joined_on','')::date) on conflict(id) do nothing;
  if not found then
    if not exists(select 1 from public.workers where id=target and workspace_id=public.current_workspace()) then raise exception 'FORBIDDEN'; end if;
    return target;
  end if;
 else
  update public.workers set full_name=payload->>'full_name',nickname=nullif(payload->>'nickname',''),job_title=nullif(payload->>'job_title',''),color=payload->>'color',joined_on=nullif(payload->>'joined_on','')::date,active=(payload->>'active')::boolean where id=(payload->>'id')::uuid and version=expected_version returning id into target;
  if target is null then raise exception 'CONFLICT: otra persona modificó este trabajador'; end if;
 end if;
 insert into public.worker_private_details(id,email,phone,notes,employment_type) values(target,nullif(lower(trim(private_data->>'email')),''),private_data->>'phone',private_data->>'notes',nullif(private_data->>'employment_type',''))
 on conflict(id) do update set email=excluded.email,phone=excluded.phone,notes=excluded.notes,
 employment_type=case when private_data ? 'employment_type' then excluded.employment_type else public.worker_private_details.employment_type end;
 return target;
end $$;

create function public.save_payment_entry(payload jsonb,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare target uuid; week date; previous public.payment_entries; mode text; minutes integer; extra integer; discount integer; manual integer; note text; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 target:=(payload->>'worker_id')::uuid;week:=(payload->>'week_start')::date;
 perform 1 from public.workers where id=target and workspace_id=public.current_workspace() for update;
 if not found then raise exception 'Trabajador no disponible'; end if;
 if week is null or extract(isodow from week)<>1 or expected_version is null or expected_version<0 then raise exception 'Semana o versión inválida'; end if;
 select employment_type into mode from public.worker_private_details where id=target;
 if mode is null then raise exception 'Selecciona Boleta o Contrato en la ficha del trabajador antes de preparar su pago.'; end if;
 minutes:=(payload->>'overtime_minutes')::integer;extra:=(payload->>'additions')::integer;discount:=(payload->>'deductions')::integer;manual:=nullif(payload->>'contract_net','')::integer;note:=coalesce(payload->>'notes','');
 if minutes is null or minutes not between 0 and 10080 or extra is null or extra not between 0 and 1000000000 or discount is null or discount not between 0 and 1000000000
 or manual is not null and manual not between 0 and 1000000000 or length(note)>2000 then raise exception 'Revisa los montos y minutos ingresados'; end if;
 if (minutes>0 or extra>0 or discount>0) and length(btrim(note))=0 then raise exception 'Agrega una nota para explicar horas extra, otros honorarios o descuentos.'; end if;
 if mode='contrato' and minutes<>0 then raise exception 'Para contrato ingresa el líquido manual, incluyendo sus horas extra. No se aplica la tarifa de honorarios.'; end if;
 if mode='boleta' then manual:=null; end if;
 select * into previous from public.payment_entries where workspace_id=public.current_workspace() and worker_id=target and week_start=week for update;
 if coalesce(previous.version,0)<>expected_version then raise exception 'Los datos de pago cambiaron. Recarga antes de guardar.' using errcode='40001'; end if;
 if previous.id is null then
   insert into public.payment_entries(worker_id,week_start,overtime_minutes,additions,deductions,contract_net,notes) values(target,week,minutes,extra,discount,manual,note);
 else
   update public.payment_entries set overtime_minutes=minutes,additions=extra,deductions=discount,contract_net=manual,notes=note,updated_by=auth.uid() where id=previous.id;
 end if;
end $$;
revoke all on function public.save_payment_entry(jsonb,integer) from public,anon,service_role;
grant execute on function public.save_payment_entry(jsonb,integer) to authenticated;

create function public.payment_week(week_start date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare people jsonb; shifts jsonb; entries jsonb; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if week_start is null or extract(isodow from week_start)<>1 then raise exception 'La semana debe comenzar el lunes'; end if;
 if (select count(*) from public.workers)>2000 then raise exception 'El equipo supera el límite de 2000 trabajadores del informe.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'full_name',w.full_name,'active',w.active,'employment_type',d.employment_type) order by w.full_name,w.id),'[]'::jsonb)
 into people from public.workers w left join public.worker_private_details d on d.id=w.id;
 shifts:=public.attendance_week(week_start);
 select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into entries from public.payment_entries e where e.week_start=payment_week.week_start;
 return jsonb_build_object('workers',people,'shifts',shifts,'entries',entries,'as_of',now());
end $$;
revoke all on function public.payment_week(date) from public,anon,service_role;
grant execute on function public.payment_week(date) to authenticated;

create or replace function public.audit_payload(entity_name text,document jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_object_agg(key,value) from jsonb_each(document)
 where key=any(array['status','active','worker_id','starts_at','ends_at','start_date','end_date','all_day','break_minutes','type_id','type','title','description','visibility','pinned','priority','due_at','location','shared_note','entry_date','period','series_id','task_id','shift_id','completed_at','completed_by','version'])
 or (entity_name in ('shifts','shift_attendance','payment_entries') and key='notes') or (entity_name='profiles' and key='role') or (entity_name='task_comments' and key='body')
 or (entity_name='worker_private_details' and key='employment_type') or (entity_name='payment_entries' and key=any(array['week_start','overtime_minutes','additions','deductions','contract_net']));
$$;
notify pgrst,'reload schema';
commit;
