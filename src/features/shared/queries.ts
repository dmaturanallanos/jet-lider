import 'server-only';
import { requireSession } from '@/features/auth/session';
import { dayRange, monday, addDays, today } from '@/utils/dates';
import { z } from 'zod';
import { canManage } from '@/lib/permissions';
import type { View, WorkspaceData } from './types';
import type { Row } from '@/types/database';
export async function getWorkspace(
  view: View,
  date: string,
  params: Record<string, string | undefined>,
): Promise<WorkspaceData> {
  const { db, profile } = await requireSession();
  const admin = canManage(profile.role);
  const start =
    view === 'turnos' && params.mode === 'month' ? monday(date.slice(0, 7) + '-01') : monday(date);
  const days = params.mode === 'month' ? 42 : 7;
  const range = dayRange(start, days);
  const page = Math.max(0, Math.min(10000, Number(params.page) || 0));
  let tq = db
    .from('tasks')
    .select('*')
    .order('due_at', { ascending: true, nullsFirst: false })
    .range(page * 50, page * 50 + 49);
  if (view === 'inicio') tq = tq.in('status', ['pending', 'in_progress']);
  let eq = db
    .from('logbook_entries')
    .select('*')
    .gte('entry_date', start)
    .lt('entry_date', addDays(start, days))
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * 50, page * 50 + 49);
  let sq = db
    .from('shifts')
    .select('*')
    .lt('starts_at', range.end)
    .gt('ends_at', range.start)
    .order('starts_at')
    .limit(1000);
  let wq = db.from('workers').select('*').order('full_name').limit(500);
  if (view === 'equipo') {
    wq = db
      .from('workers')
      .select('*')
      .order('full_name')
      .range(page * 50, page * 50 + 49);
    if (params.q) {
      const term = params.q.replace(/[%_,()]/g, ' ').slice(0, 120);
      wq = wq.or(`full_name.ilike.%${term}%,nickname.ilike.%${term}%,job_title.ilike.%${term}%`);
    }
    if (['true', 'false'].includes(params.active ?? ''))
      wq = wq.eq('active', params.active === 'true');
  }
  if (params.dueFrom && z.iso.date().safeParse(params.dueFrom).success)
    tq = tq.gte('due_at', dayRange(params.dueFrom).start);
  if (params.dueTo && z.iso.date().safeParse(params.dueTo).success)
    tq = tq.lt('due_at', dayRange(params.dueTo).end);
  if (params.q) {
    const q = params.q.replace(/[%_,()]/g, ' ').slice(0, 120);
    tq = tq.ilike('title', `%${q}%`);
    eq = eq.ilike('title', `%${q}%`);
  }
  if (params.status) tq = tq.eq('status', params.status);
  if (params.priority) tq = tq.eq('priority', params.priority);
  if (params.worker) sq = sq.eq('worker_id', params.worker);
  if (params.type) sq = sq.eq('type_id', params.type);
  if (params.location) sq = sq.ilike('location', `%${params.location.replace(/[%_]/g, '')}%`);
  if (params.shiftStatus) sq = sq.eq('status', params.shiftStatus);
  if (params.entryType) eq = eq.eq('type', params.entryType);
  if (params.author) eq = eq.eq('created_by', params.author);
  if (params.taskWorker) {
    const a = await db
      .from('task_assignees')
      .select('task_id')
      .eq('worker_id', params.taskWorker)
      .limit(1000);
    tq = tq.in(
      'id',
      (a.data ?? []).map((x) => x.task_id),
    );
  }
  const workerPromise = Promise.resolve(wq);
  const [
    workers,
    details,
    invitations,
    shifts,
    shiftTypes,
    absences,
    tasks,
    entries,
    activity,
    contact,
  ] = await Promise.all([
    workerPromise,
    workerPromise.then(async (r) =>
      admin && r.data?.length
        ? await db
            .from('worker_private_details')
            .select('*')
            .in(
              'id',
              r.data.map((w) => w.id),
            )
        : { data: [] as Row<'worker_private_details'>[], error: null },
    ),
    workerPromise.then(async (r) =>
      admin && r.data?.length
        ? await db
            .from('worker_invitations')
            .select('*')
            .in(
              'worker_id',
              r.data.map((w) => w.id),
            )
        : { data: [] as Row<'worker_invitations'>[], error: null },
    ),
    sq,
    db.from('shift_types').select('*').order('name'),
    db
      .from('worker_absences')
      .select('*')
      .or(
        `and(all_day.eq.true,start_date.lt.${addDays(start, days)},end_date.gte.${start}),and(all_day.eq.false,starts_at.lt.${range.end},ends_at.gt.${range.start})`,
      )
      .limit(1000),
    tq,
    eq,
    admin
      ? db
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * 20, page * 20 + 19)
      : Promise.resolve({ data: [], error: null }),
    db.rpc('my_contact'),
  ]);
  for (const r of [
    workers,
    details,
    invitations,
    shifts,
    shiftTypes,
    absences,
    tasks,
    entries,
    activity,
    contact,
  ])
    if (r.error)
      throw new Error(
        'No se pudieron cargar los datos. Comprueba la conexión y las migraciones de Supabase.',
      );
  if (shifts.data?.length === 1000 || absences.data?.length === 1000)
    throw new Error(
      'El rango supera el límite de carga del calendario. Reduce el rango o filtra por trabajador.',
    );
  let uq = db
    .from('shifts')
    .select('*')
    .gt('starts_at', new Date().toISOString())
    .neq('status', 'cancelled')
    .order('starts_at')
    .limit(5);
  if (!admin) uq = uq.eq('worker_id', profile.worker_id ?? '00000000-0000-4000-8000-000000000000');
  const [authors, summary, upcoming] = await Promise.all([
    db.rpc('team_authors'),
    view === 'inicio'
      ? db.rpc('dashboard_summary', { day: today(), week_start: monday(today()) })
      : Promise.resolve({ data: null, error: null }),
    view === 'inicio' ? uq : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [authors, summary, upcoming])
    if (result.error) throw new Error('No se pudo cargar el resumen operativo.');
  const counts = z
    .object({
      today_workers: z.number(),
      unassigned: z.number(),
      open: z.number(),
      urgent: z.number(),
      overdue: z.number(),
    })
    .safeParse(summary.data);
  const detail = params.detail;
  if (detail) {
    if (view === 'tareas' && !tasks.data?.some((t) => t.id === detail)) {
      const r = await db.from('tasks').select('*').eq('id', detail).maybeSingle();
      if (r.data) tasks.data?.push(r.data);
    }
    if (view === 'bitacora' && !entries.data?.some((t) => t.id === detail)) {
      const r = await db.from('logbook_entries').select('*').eq('id', detail).maybeSingle();
      if (r.data) entries.data?.push(r.data);
    }
    if (view === 'equipo' && !workers.data?.some((t) => t.id === detail)) {
      const r = await db.from('workers').select('*').eq('id', detail).maybeSingle();
      if (r.data) workers.data?.push(r.data);
      if (admin) {
        const p = await db
          .from('worker_private_details')
          .select('*')
          .eq('id', detail)
          .maybeSingle();
        if (p.data) details.data?.push(p.data);
      }
    }
  }
  const ids = (tasks.data ?? []).map((t) => t.id);
  const assignees = ids.length
    ? await db.from('task_assignees').select('*').in('task_id', ids)
    : { data: [], error: null };
  const comments =
    detail && view === 'tareas'
      ? await db
          .from('task_comments')
          .select('*')
          .eq('task_id', detail)
          .order('created_at')
          .range(
            Math.max(0, Number(params.commentsPage) || 0) * 50,
            Math.max(0, Number(params.commentsPage) || 0) * 50 + 49,
          )
      : { data: [], error: null };
  const taskFiles =
    detail && view === 'tareas'
      ? await db.from('task_attachments').select('*').eq('task_id', detail).limit(50)
      : { data: [], error: null };
  const entryFiles =
    detail && view === 'bitacora'
      ? await db.from('logbook_attachments').select('*').eq('entry_id', detail).limit(50)
      : { data: [], error: null };
  const history =
    detail && admin
      ? await db
          .from('activity_logs')
          .select('*')
          .eq('entity_id', detail)
          .order('created_at', { ascending: false })
          .range(page * 20, page * 20 + 19)
      : { data: [], error: null };
  for (const r of [assignees, comments, taskFiles, entryFiles, history])
    if (r.error) throw new Error('No se pudo cargar el detalle.');
  const administrators =
    admin && view === 'configuracion'
      ? await db.from('profiles').select('*').eq('role', 'admin').order('created_at').limit(100)
      : { data: [], error: null };
  if (administrators.error) throw new Error('No se pudieron cargar los administradores.');
  const shiftIds = admin ? (shifts.data ?? []).map((s) => s.id) : [];
  const attendance = await Promise.all(
    Array.from({ length: Math.ceil(shiftIds.length / 100) }, (_, i) =>
      db
        .from('shift_attendance')
        .select('*')
        .in('shift_id', shiftIds.slice(i * 100, i * 100 + 100)),
    ),
  );
  if (attendance.some((result) => result.error))
    throw new Error(
      'No se pudo cargar la asistencia. Revisa la migración 202611030013 y la conexión.',
    );
  return {
    attendance: attendance.flatMap((result) => result.data ?? []),
    administrators: administrators.data ?? [],
    authors: authors.data ?? [],
    summary: counts.success ? counts.data : undefined,
    upcoming: upcoming.data ?? [],
    now: new Date().toISOString(),
    profile,
    workers: workers.data ?? [],
    privateDetails: details.data ?? [],
    invitations: invitations.data ?? [],
    shifts: shifts.data ?? [],
    shiftTypes: shiftTypes.data ?? [],
    absences: absences.data ?? [],
    tasks: tasks.data ?? [],
    entries: entries.data ?? [],
    activity: activity.data ?? [],
    assignees: assignees.data ?? [],
    comments: comments.data ?? [],
    taskFiles: taskFiles.data ?? [],
    entryFiles: entryFiles.data ?? [],
    contact: contact.data?.[0] ?? null,
    hasMore:
      tasks.data?.length === 50 ||
      entries.data?.length === 50 ||
      (view === 'equipo' && workers.data?.length === 50),
    detailHistory: history.data ?? [],
  };
}
