create function public.invitee_account(target_worker uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare account uuid; invite public.worker_invitations; begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
 select * into invite from public.worker_invitations where worker_id=target_worker for update;
 if not found then raise exception 'Invitación no reservada'; end if;
 if not exists(select 1 from public.workers where id=target_worker and active) then raise exception 'Trabajador inactivo'; end if;
 select id into account from auth.users where lower(email)=lower(invite.email);
 if account is null then return null; end if;
 if exists(select 1 from public.profiles where id=account and (role<>'worker' or worker_id<>target_worker)) then raise exception 'Cuenta ya vinculada a otro perfil'; end if;
 insert into public.profiles(id,worker_id,role,display_name) select account,id,'worker',full_name from public.workers where id=target_worker on conflict(id) do nothing;
 update public.worker_invitations set auth_user_id=account,status='linked' where id=invite.id;
 return account;
end $$;
revoke all on function public.invitee_account(uuid) from public,anon,authenticated;
grant execute on function public.invitee_account(uuid) to service_role;
