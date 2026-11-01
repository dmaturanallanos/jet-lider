-- OPTIONAL. Manual use only in a disposable local/staging database.
-- No accounts or passwords. Refuses an existing workforce and requires an admin.
begin;
do $$
declare actor uuid; person uuid; morning uuid; afternoon uuid; night uuid; week date; i int; d int; task uuid;
 names text[]:=array['Camila Rojas','Matías González','Valentina Soto','Diego Muñoz','Fernanda Pérez','Nicolás Silva'];
begin
 if exists(select 1 from public.workers) then raise exception 'Demo requires an empty workforce. No data changed.'; end if;
 select id into actor from public.profiles where role='admin'; if actor is null then raise exception 'Bootstrap the administrator first.'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 week:=date_trunc('week',now() at time zone 'America/Santiago')::date;
 select id into morning from public.shift_types where name='Mañana'; select id into afternoon from public.shift_types where name='Tarde';select id into night from public.shift_types where name='Noche';
 for i in 1..6 loop
  insert into public.workers(full_name,nickname,job_title) values('[DEMO] '||names[i],split_part(names[i],' ',1),'Operador logístico') returning id into person;
  for d in 0..4 loop
   if not(i=5 and d=2) then
    insert into public.shifts(worker_id,type_id,starts_at,ends_at,break_minutes,location,created_by) values(person,
     case when i=6 and d=3 then night when i%2=1 then morning else afternoon end,
     ((week+d)+case when i=6 and d=3 then time '22:00' when i%2=1 then time '07:00' else time '14:00' end) at time zone 'America/Santiago',
     ((week+d+case when i=6 and d=3 then 1 else 0 end)+case when i=6 and d=3 then time '06:00' when i%2=1 then time '15:00' else time '22:00' end) at time zone 'America/Santiago',30,'[DEMO] Centro de distribución',actor);
   end if;
  end loop;
  if i=5 then insert into public.worker_absences(worker_id,type,start_date,end_date,created_by) values(person,'Día libre',week+2,week+2,actor);end if;
 end loop;
 insert into public.shifts(type_id,starts_at,ends_at,break_minutes,created_by) values(morning,((week+5)+time '09:00') at time zone 'America/Santiago',((week+5)+time '17:00') at time zone 'America/Santiago',30,actor);
 for i in 1..10 loop
  insert into public.tasks(title,description,priority,status,due_at,created_by) values('[DEMO] Control operativo '||i,'Revisar la zona y registrar el resultado.',(array['low','medium','high','urgent'])[1+(i%4)],(array['pending','in_progress','completed','cancelled'])[1+(i%4)],((week+(i%5))+time '16:00') at time zone 'America/Santiago',actor) returning id into task;
  select id into person from public.workers order by full_name offset (i%6) limit 1;
  insert into public.task_assignees(task_id,worker_id) values(task,person);
 end loop;
 for i in 0..4 loop insert into public.logbook_entries(title,description,type,period,entry_date,created_by,pinned) values('[DEMO] Entrega operativa '||i,'Información ficticia para el siguiente turno.','Entrega de turno',case when i=4 then 'week' else 'day' end,week+(i%4),actor,i=1);end loop;
end $$;
commit;
