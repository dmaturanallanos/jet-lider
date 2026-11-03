-- Explicit owner-requested change: allow additional administrators.
drop index public.only_one_admin;

-- An administrator linked to an inactive worker must also lose operational access.
create or replace function public.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.workers w on w.id=p.worker_id
 where p.id=auth.uid() and ((p.role='admin' and p.worker_id is null) or w.active));
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active() and exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

-- Roles and account/worker links can never be changed through a direct profile update.
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;

create function public.grant_administrator(account_email text, administrator_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid; current_profile public.profiles; confirmed timestamptz; banned timestamptz; deleted timestamptz;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if administrator_name is null or account_email is null or length(btrim(administrator_name)) not between 2 and 120 or length(btrim(account_email)) not between 3 and 320 then
   raise exception 'Nombre o correo inválido' using errcode='23514';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('jet:administrator-grants',0));
 select id,email_confirmed_at,banned_until,deleted_at into target,confirmed,banned,deleted
 from auth.users where lower(email)=lower(btrim(account_email)) limit 1;
 if target is null then raise exception 'La cuenta no existe. Invita primero a la persona desde Equipo y espera que active su acceso.'; end if;
 if confirmed is null or deleted is not null or banned>now() then raise exception 'La cuenta debe estar confirmada y habilitada antes de otorgar permisos.'; end if;
 select * into current_profile from public.profiles where id=target for update;
 if current_profile.worker_id is not null then
   perform 1 from public.workers where id=current_profile.worker_id and active for update;
   if not found then raise exception 'Activa primero al trabajador antes de otorgar permisos.'; end if;
 end if;
 if current_profile.role='admin' then return target; end if;
 if current_profile.id is null then
   insert into public.profiles(id,role,display_name) values(target,'admin',btrim(administrator_name));
 else
   update public.profiles set role='admin' where id=target;
 end if;
 return target;
end $$;
revoke all on function public.grant_administrator(text,text) from public,anon,service_role;
grant execute on function public.grant_administrator(text,text) to authenticated;

-- Include the changed role in the trusted audit record without copying personal data.
create or replace function public.audit_payload(entity_name text,document jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_object_agg(key,value) from jsonb_each(document)
 where key=any(array['status','active','worker_id','starts_at','ends_at','start_date','end_date','all_day','break_minutes','type_id','type','title','description','visibility','pinned','priority','due_at','location','shared_note','entry_date','period','series_id','task_id','shift_id','completed_at','completed_by','version'])
 or (entity_name='shifts' and key='notes') or (entity_name='profiles' and key='role');
$$;

-- Re-sending access to a promoted worker must preserve its existing administrator role.
create or replace function public.invitee_account(target_worker uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare account uuid; invite public.worker_invitations; begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
 select * into invite from public.worker_invitations where worker_id=target_worker for update;
 if not found then raise exception 'Invitación no reservada'; end if;
 if not exists(select 1 from public.workers where id=target_worker and active) then raise exception 'Trabajador inactivo'; end if;
 select id into account from auth.users where lower(email)=lower(invite.email);
 if account is null then return null; end if;
 if exists(select 1 from public.profiles where id=account and worker_id is distinct from target_worker) then raise exception 'Cuenta ya vinculada a otro perfil'; end if;
 insert into public.profiles(id,worker_id,role,display_name) select account,id,'worker',full_name from public.workers where id=target_worker on conflict(id) do nothing;
 update public.worker_invitations set auth_user_id=account,status='linked' where id=invite.id;
 return account;
end $$;
