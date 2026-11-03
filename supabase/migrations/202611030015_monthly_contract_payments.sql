begin;
create table public.contract_monthly_payments (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null default public.current_workspace() references public.workspaces(id),
 worker_id uuid not null,month_start date not null check(extract(day from month_start)=1),
 salary_net integer not null check(salary_net between 200000 and 1000000000),
 advance_net integer not null default 200000 check(advance_net=200000),
 notes text not null default '' check(length(notes)<=2000),
 created_by uuid not null default auth.uid() references public.profiles(id),updated_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,
 unique(workspace_id,worker_id,month_start),unique(workspace_id,id),
 foreign key(workspace_id,worker_id) references public.workers(workspace_id,id),
 foreign key(workspace_id,created_by) references public.profiles(workspace_id,id),foreign key(workspace_id,updated_by) references public.profiles(workspace_id,id)
);
create index contract_month_lookup on public.contract_monthly_payments(workspace_id,month_start);
alter table public.contract_monthly_payments enable row level security;
revoke all on public.contract_monthly_payments from anon,authenticated;
grant select on public.contract_monthly_payments to authenticated;
grant all on public.contract_monthly_payments to service_role;
create policy monthly_pay_admin on public.contract_monthly_payments for select to authenticated using(public.is_admin() and workspace_id=public.current_workspace());
create trigger immutable_workspace before update on public.contract_monthly_payments for each row execute function public.keep_workspace();
create trigger record_guard before insert or update on public.contract_monthly_payments for each row execute function public.guard_record();
create trigger audit after insert or update or delete on public.contract_monthly_payments for each row execute function public.audit_change();

create function public.save_contract_month(payload jsonb,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare target uuid; period date; amount integer; previous public.contract_monthly_payments; note text; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 target:=(payload->>'worker_id')::uuid;period:=(payload->>'month_start')::date;amount:=(payload->>'salary_net')::integer;note:=coalesce(payload->>'notes','');
 perform 1 from public.workers w join public.worker_private_details d on d.id=w.id where w.id=target and w.workspace_id=public.current_workspace() and d.employment_type='contrato' for update of w;
 if not found then raise exception 'Trabajador de contrato no disponible en tu espacio'; end if;
 if period is null or extract(day from period)<>1 or expected_version is null or expected_version<0 or amount is null or amount not between 200000 and 1000000000 or length(note)>2000 then
   raise exception 'Revisa el mes y el sueldo líquido. El sueldo no puede ser menor que el anticipo fijo de $200.000.';
 end if;
 select * into previous from public.contract_monthly_payments where workspace_id=public.current_workspace() and worker_id=target and month_start=period for update;
 if coalesce(previous.version,0)<>expected_version then raise exception 'El sueldo mensual cambió. Recarga antes de guardar.' using errcode='40001'; end if;
 if previous.id is null then
   insert into public.contract_monthly_payments(worker_id,month_start,salary_net,advance_net,notes) values(target,period,amount,200000,note);
 else
   update public.contract_monthly_payments set salary_net=amount,notes=note,updated_by=auth.uid() where id=previous.id;
 end if;
end $$;
revoke all on function public.save_contract_month(jsonb,integer) from public,anon,service_role;
grant execute on function public.save_contract_month(jsonb,integer) to authenticated;

create function public.contract_payment_month(month_start date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare people jsonb; records jsonb; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if month_start is null or extract(day from month_start)<>1 then raise exception 'El período debe comenzar el primer día del mes'; end if;
 if (select count(*) from public.workers)>2000 then raise exception 'El equipo supera el límite de 2000 trabajadores'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'full_name',w.full_name,'active',w.active) order by w.full_name,w.id),'[]'::jsonb) into people
 from public.workers w left join public.worker_private_details d on d.id=w.id
 where (w.active and d.employment_type='contrato' and (w.joined_on is null or w.joined_on<(contract_payment_month.month_start+interval '1 month')::date))
 or exists(select 1 from public.contract_monthly_payments m where m.worker_id=w.id and m.month_start=contract_payment_month.month_start);
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) into records from public.contract_monthly_payments m where m.month_start=contract_payment_month.month_start;
 return jsonb_build_object('workers',people,'entries',records,'as_of',now());
end $$;
revoke all on function public.contract_payment_month(date) from public,anon,service_role;
grant execute on function public.contract_payment_month(date) to authenticated;

-- Weekly entries are now only for honorarios. Legacy contract drafts are retained for review.
create or replace function public.save_payment_entry(payload jsonb,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare target uuid; week date; previous public.payment_entries; mode text; minutes integer; extra integer; discount integer; note text; begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 target:=(payload->>'worker_id')::uuid;week:=(payload->>'week_start')::date;
 perform 1 from public.workers where id=target and workspace_id=public.current_workspace() for update;
 if not found then raise exception 'Trabajador no disponible'; end if;
 if week is null or extract(isodow from week)<>1 or expected_version is null or expected_version<0 then raise exception 'Semana o versión inválida'; end if;
 select employment_type into mode from public.worker_private_details where id=target;
 if mode is null then raise exception 'Selecciona Boleta o Contrato en la ficha del trabajador antes de preparar su pago.'; end if;
 if mode<>'boleta' then raise exception 'El contrato se prepara por mes, con sueldo y anticipo, en Contratos mensual.'; end if;
 minutes:=(payload->>'overtime_minutes')::integer;extra:=(payload->>'additions')::integer;discount:=(payload->>'deductions')::integer;note:=coalesce(payload->>'notes','');
 if minutes is null or minutes not between 0 and 10080 or extra is null or extra not between 0 and 1000000000 or discount is null or discount not between 0 and 1000000000 or length(note)>2000 then raise exception 'Revisa los montos y minutos ingresados'; end if;
 if (minutes>0 or extra>0 or discount>0) and length(btrim(note))=0 then raise exception 'Agrega una nota para explicar las horas extra o ajustes.'; end if;
 select * into previous from public.payment_entries where workspace_id=public.current_workspace() and worker_id=target and week_start=week for update;
 if coalesce(previous.version,0)<>expected_version then raise exception 'Los datos de pago cambiaron. Recarga antes de guardar.' using errcode='40001'; end if;
 if previous.id is null then
   insert into public.payment_entries(worker_id,week_start,overtime_minutes,additions,deductions,contract_net,notes) values(target,week,minutes,extra,discount,null,note);
 else
   update public.payment_entries set overtime_minutes=minutes,additions=extra,deductions=discount,contract_net=null,notes=note,updated_by=auth.uid() where id=previous.id;
 end if;
end $$;

create or replace function public.audit_payload(entity_name text,document jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_object_agg(key,value) from jsonb_each(document)
 where key=any(array['status','active','worker_id','starts_at','ends_at','start_date','end_date','all_day','break_minutes','type_id','type','title','description','visibility','pinned','priority','due_at','location','shared_note','entry_date','period','series_id','task_id','shift_id','completed_at','completed_by','version'])
 or (entity_name in ('shifts','shift_attendance','payment_entries','contract_monthly_payments') and key='notes') or (entity_name='profiles' and key='role') or (entity_name='task_comments' and key='body')
 or (entity_name='worker_private_details' and key='employment_type') or (entity_name='payment_entries' and key=any(array['week_start','overtime_minutes','additions','deductions','contract_net']))
 or (entity_name='contract_monthly_payments' and key=any(array['month_start','salary_net','advance_net']));
$$;
notify pgrst,'reload schema';
commit;
