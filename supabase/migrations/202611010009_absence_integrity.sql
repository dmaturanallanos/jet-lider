alter table public.absence_private_notes drop constraint absence_private_notes_id_fkey;
alter table public.absence_private_notes add constraint absence_private_notes_id_fkey foreign key(id) references public.worker_absences(id) on delete cascade;
alter table public.logbook_entries add constraint entry_description_length check(length(trim(description)) between 1 and 10000);
alter table public.tasks add constraint task_description_length check(description is null or length(description)<=5000);
alter table public.shifts add constraint shift_notes_length check(notes is null or length(notes)<=5000);
