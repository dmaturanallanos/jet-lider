import type { WorkspaceData } from './types';
import type { Row } from '@/types/database';
import { addDays, dayRange, localToInstant, monday, today } from '@/utils/dates';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function demoData(date = today()): WorkspaceData {
  const week = monday(date),
    stamp = dayRange(week).start,
    base = { created_at: stamp, updated_at: stamp, version: 1, workspace_id: uuid(100) };
  const names = [
    'Camila Rojas',
    'Matías González',
    'Valentina Soto',
    'Diego Muñoz',
    'Fernanda Pérez',
    'Nicolás Silva',
  ];
  const colors = ['#00bfff', '#9b87f5', '#f4af45', '#79beaa', '#f080a0', '#75a3f5'];
  const workers = names.map((full_name, i) => ({
    ...base,
    id: uuid(i + 1),
    full_name,
    nickname: full_name.split(' ')[0],
    job_title: i === 0 ? 'Coordinadora de operaciones' : 'Operador logístico',
    color: colors[i],
    active: true,
    joined_on: '2026-03-02',
    avatar_path: null,
  }));
  const profile = {
    ...base,
    id: uuid(100),
    role: 'admin',
    worker_id: null,
    display_name: 'Líder de operaciones',
  };
  const shiftTypes = ['Mañana', 'Tarde', 'Noche', 'Otro'].map((name, i) => ({
    ...base,
    id: uuid(200 + i),
    name,
    color: colors[i],
  }));
  const shifts: Row<'shifts'>[] = workers.flatMap((w, i) =>
    [0, 1, 2, 3, 4]
      .filter((d) => !(i === 4 && d === 2))
      .map((d) => {
        const night = i === 5 && d === 3;
        const h = i % 2 === 0 ? '07:00' : '14:00';
        return {
          ...base,
          id: uuid(300 + i * 7 + d),
          worker_id: w.id,
          type_id: shiftTypes[night ? 2 : i % 2].id,
          starts_at: localToInstant(`${addDays(week, d)}T${night ? '22:00' : h}`),
          ends_at: localToInstant(
            `${addDays(week, d + (night ? 1 : 0))}T${night ? '06:00' : i % 2 === 0 ? '15:00' : '22:00'}`,
          ),
          break_minutes: 30,
          location: 'Centro de distribución',
          notes: night ? 'Relevo nocturno y recepción de carga.' : null,
          status: d === 0 ? 'confirmed' : 'scheduled',
          series_id: null,
          created_by: profile.id,
        };
      }),
  );
  shifts.push({
    ...shifts[0],
    id: uuid(399),
    worker_id: null,
    starts_at: localToInstant(`${addDays(week, 5)}T09:00`),
    ends_at: localToInstant(`${addDays(week, 5)}T17:00`),
    status: 'scheduled',
  });
  const taskTitles = [
    'Preparar despacho de primera ruta',
    'Revisar diferencias de inventario',
    'Verificar sellos de recepción',
    'Ordenar zona de devoluciones',
    'Revisar equipos de radio',
    'Actualizar registro de carga',
    'Inspeccionar pasillos de seguridad',
    'Cerrar pendientes de recepción',
    'Preparar documentación de ruta',
    'Confirmar entrega de materiales',
  ];
  const tasks = taskTitles.map((title, i) => ({
    ...base,
    id: uuid(500 + i),
    title,
    description: 'Verificar la operación y dejar evidencia al finalizar.',
    priority: ['urgent', 'high', 'medium', 'low'][i % 4],
    status: ['pending', 'in_progress', 'completed', 'pending', 'cancelled'][i % 5],
    due_at: localToInstant(`${addDays(week, i % 5)}T16:00`),
    location: 'Centro de distribución',
    completed_at: i % 5 === 2 ? stamp : null,
    completed_by: i % 5 === 2 ? profile.id : null,
    created_by: profile.id,
  }));
  const entries = [
    'Entrega de turno · recepción',
    'Pendiente de revisión de pallets',
    'Cierre de la jornada',
    'Incidencia de etiquetado',
    'Resumen operativo semanal',
  ].map((title, i) => ({
    ...base,
    id: uuid(600 + i),
    title,
    description: [
      'Recepción completada. Se entregan equipos y zona de carga en condiciones para el siguiente turno.',
      'Revisar los pallets señalizados antes de liberarlos a despacho.',
    ][i % 2],
    type: i === 1 ? 'Pendiente' : 'Observación',
    period: i === 4 ? 'week' : 'day',
    entry_date: addDays(week, i % 4),
    visibility: 'team',
    pinned: i === 1,
    worker_id: null,
    shift_id: null,
    task_id: null,
    created_by: profile.id,
  }));
  return {
    authors: [{ user_id: profile.id, name: profile.display_name }],
    now: new Date().toISOString(),
    profile,
    workers,
    privateDetails: workers.map((w, i) => ({
      ...base,
      id: w.id,
      email: null,
      phone: null,
      notes: null,
      employment_type: i % 2 === 0 ? 'boleta' : 'contrato',
    })),
    payments: {
      workers: workers.map((w, i) => ({
        id: w.id,
        full_name: w.full_name,
        active: w.active,
        employment_type: i % 2 === 0 ? 'boleta' : 'contrato',
      })),
      shifts: shifts.map((s) => ({
        id: s.id,
        worker_id: s.worker_id,
        worker_name: workers.find((w) => w.id === s.worker_id)?.full_name ?? 'Sin asignar',
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        break_minutes: s.break_minutes,
        shift_status: s.status as 'scheduled' | 'confirmed' | 'cancelled',
        shift_type: shiftTypes.find((t) => t.id === s.type_id)?.name ?? 'Otro',
        location: s.location ?? '',
        attendance_status: s.worker_id ? 'present' : null,
        attendance_notes: 'Dato ficticio de demostración',
        marked_at: stamp,
        marked_by: profile.display_name,
      })),
      entries: workers.map((w, i) => ({
        worker_id: w.id,
        overtime_minutes: i === 0 ? 60 : 0,
        additions: 0,
        deductions: 0,
        contract_net: i % 2 === 1 ? 160000 : null,
        notes: 'Dato ficticio de demostración',
        version: 1,
      })),
      as_of: dayRange(addDays(week, 7)).start,
    },
    invitations: [],
    shifts,
    shiftTypes,
    absences: [
      {
        ...base,
        id: uuid(700),
        worker_id: workers[4].id,
        type: 'Día libre',
        all_day: true,
        start_date: addDays(week, 2),
        end_date: addDays(week, 2),
        starts_at: null,
        ends_at: null,
        shared_note: 'Descanso programado',
        created_by: profile.id,
      },
    ],
    tasks,
    assignees: tasks.map((t, i) => ({
      ...base,
      id: uuid(800 + i),
      task_id: t.id,
      worker_id: workers[i % 6].id,
    })),
    entries,
    activity: [],
    comments: [],
    taskFiles: [],
    entryFiles: [],
    contact: null,
    hasMore: false,
    detailHistory: [],
  };
}
