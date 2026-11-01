import type { Row } from '@/types/database';
export type View =
  'inicio' | 'turnos' | 'tareas' | 'bitacora' | 'equipo' | 'perfil' | 'configuracion' | 'mas';
export type WorkspaceData = {
  now: string;
  authors: { user_id: string; name: string }[];
  summary?: {
    today_workers: number;
    unassigned: number;
    open: number;
    urgent: number;
    overdue: number;
  };
  upcoming?: Row<'shifts'>[];
  profile: Row<'profiles'>;
  workers: Row<'workers'>[];
  privateDetails: Row<'worker_private_details'>[];
  invitations: Row<'worker_invitations'>[];
  shifts: Row<'shifts'>[];
  shiftTypes: Row<'shift_types'>[];
  absences: Row<'worker_absences'>[];
  tasks: Row<'tasks'>[];
  assignees: Row<'task_assignees'>[];
  entries: Row<'logbook_entries'>[];
  activity: Row<'activity_logs'>[];
  comments: Row<'task_comments'>[];
  taskFiles: Row<'task_attachments'>[];
  entryFiles: Row<'logbook_attachments'>[];
  contact: { email: string | null; phone: string | null } | null;
  hasMore: boolean;
  detailHistory: Row<'activity_logs'>[];
};
