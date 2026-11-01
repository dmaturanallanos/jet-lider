create function public.audit_payload(entity_name text,document jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_object_agg(key,value) from jsonb_each(document)
 where key=any(array['status','active','worker_id','starts_at','ends_at','start_date','end_date','all_day','break_minutes','type_id','type','title','description','visibility','pinned','priority','due_at','location','shared_note','entry_date','period','series_id','task_id','shift_id','completed_at','completed_by','version'])
 or (entity_name='shifts' and key='notes');
$$;
revoke all on function public.audit_payload(text,jsonb) from public,anon,authenticated;
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_data jsonb; new_data jsonb;
begin
 if tg_op<>'INSERT' then old_data:=public.audit_payload(tg_table_name,to_jsonb(old)); end if;
 if tg_op<>'DELETE' then new_data:=public.audit_payload(tg_table_name,to_jsonb(new)); end if;
 insert into public.activity_logs(actor_id,action,entity,entity_id,before_data,after_data)
 values(auth.uid(),tg_op,tg_table_name,coalesce(new.id,old.id),old_data,new_data);
 return coalesce(new,old);
end $$;
