create index activity_entity_history on public.activity_logs(entity_id,created_at desc);
create index comments_task_history on public.task_comments(task_id,created_at);
create index task_files_parent on public.task_attachments(task_id);
create index logbook_files_parent on public.logbook_attachments(entry_id);
create index workers_active_name on public.workers(active,full_name);
