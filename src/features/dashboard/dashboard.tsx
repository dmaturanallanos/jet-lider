'use client';
import Link from 'next/link';
import {
  CalendarDays,
  Users,
  AlertCircle,
  ClipboardList,
  ArrowUpRight,
  Pin,
  Clock3,
  Plus,
} from 'lucide-react';
import { canManage } from '@/lib/permissions';
import type { ViewProps } from '@/features/shared/view-props';
import { Avatar, Badge, Empty, Status } from '@/components/ui/primitives';
import { clock, dateLabel, dayRange, localInput, today } from '@/utils/dates';
export function Dashboard({ data, link, edit }: ViewProps) {
  const admin = canManage(data.profile.role),
    now = today(),
    r = dayRange(now);
  const shifts = data.shifts.filter(
    (s) =>
      s.status !== 'cancelled' &&
      Date.parse(s.starts_at) < Date.parse(r.end) &&
      Date.parse(s.ends_at) > Date.parse(r.start) &&
      (admin || s.worker_id === data.profile.worker_id),
  );
  const tasks = data.tasks.filter((t) => !['completed', 'cancelled'].includes(t.status));
  const overdue = tasks.filter((t) => t.due_at && Date.parse(t.due_at) < Date.parse(data.now));
  const unassigned = data.shifts.filter((s) => !s.worker_id && s.status !== 'cancelled');
  const upcoming = data.upcoming ?? data.shifts;
  const metrics = [
    {
      label: admin ? 'Equipo programado hoy' : 'Mis turnos de hoy',
      value: admin
        ? (data.summary?.today_workers ??
          new Set(shifts.filter((s) => s.worker_id).map((s) => s.worker_id)).size)
        : shifts.length,
      detail: admin ? 'Personas con turno en la jornada' : 'En horario de Chile',
      icon: Users,
      url: link('turnos', { mode: 'day', date: now }),
    },
    {
      label: 'Turnos sin asignar',
      value: data.summary?.unassigned ?? unassigned.length,
      detail: 'En la semana visible',
      icon: CalendarDays,
      url: link('turnos'),
    },
    {
      label: admin ? 'Tareas abiertas' : 'Mis tareas abiertas',
      value: data.summary?.open ?? tasks.length,
      detail: `${data.summary?.urgent ?? tasks.filter((t) => t.priority === 'urgent').length} con prioridad urgente`,
      icon: ClipboardList,
      url: link('tareas'),
    },
    {
      label: 'Tareas vencidas',
      value: data.summary?.overdue ?? overdue.length,
      detail: 'Requieren seguimiento',
      icon: AlertCircle,
      url: link('tareas', { status: 'pending' }),
    },
  ];
  return (
    <>
      <div className="metrics">
        {metrics.map((m) => (
          <Link className="metric" href={m.url} key={m.label}>
            <div className="eyebrow">
              {m.label}
              <m.icon />
            </div>
            <div className="value">{m.value.toString().padStart(2, '0')}</div>
            <p>{m.detail}</p>
          </Link>
        ))}
      </div>
      <div className="dashboardgrid">
        <div className="stack">
          <section className="panel">
            <div className="panelhead">
              <h2 className="sectionlabel">
                <CalendarDays />
                {admin ? 'La operación de hoy' : 'Mis turnos de hoy'}
              </h2>
              <Link className="link row" href={link('turnos', { mode: 'day', date: now })}>
                Ver agenda <ArrowUpRight size={14} />
              </Link>
            </div>
            {shifts.length ? (
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Trabajador</th>
                      <th>Horario</th>
                      <th>Turno</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => {
                      const w = data.workers.find((w) => w.id === s.worker_id),
                        type = data.shiftTypes.find((t) => t.id === s.type_id);
                      return (
                        <tr key={s.id}>
                          <td>
                            <div className="workername">
                              <Avatar name={w?.full_name ?? 'SA'} color={w?.color} />
                              <div>
                                <strong>{w?.full_name ?? 'Sin asignar'}</strong>
                                <div className="muted" style={{ fontSize: 10 }}>
                                  {w?.job_title ?? 'Pendiente de asignación'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="hours">
                            {clock(s.starts_at)} <span className="muted">–</span> {clock(s.ends_at)}
                            {localInput(s.starts_at).slice(0, 10) !==
                              localInput(s.ends_at).slice(0, 10) && (
                              <small className="muted"> +1</small>
                            )}
                          </td>
                          <td>
                            <Badge tone="blue">{type?.name}</Badge>
                          </td>
                          <td>
                            <Status value={s.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Sin turnos programados para hoy">
                Consulta la semana o programa el próximo turno.
              </Empty>
            )}
            <div
              className="panelbody row spread"
              style={{ padding: '12px 22px', background: 'var(--panel2)', fontSize: 10 }}
            >
              <span className="muted">Horario de 24 horas · America/Santiago</span>
              <span className="muted">
                {dateLabel(now, { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
          </section>
          <section className="panel">
            <div className="panelhead">
              <h2 className="sectionlabel">
                <ClipboardList />
                {admin ? 'Pendientes de la operación' : 'Mis tareas'}
              </h2>
              <Link className="link" href={link('tareas')}>
                Ver todas →
              </Link>
            </div>
            {tasks.length ? (
              tasks.slice(0, 5).map((t) => (
                <Link href={link('tareas', { detail: t.id })} className="taskline" key={t.id}>
                  <span className="taskcheck" />
                  <div className="taskcontent">
                    <p>{t.title}</p>
                    <div className="taskmeta">
                      <Status value={t.priority} />
                      <span>
                        {data.assignees
                          .filter((a) => a.task_id === t.id)
                          .map(
                            (a) =>
                              data.workers.find((w) => w.id === a.worker_id)?.nickname ??
                              data.workers.find((w) => w.id === a.worker_id)?.full_name,
                          )
                          .join(', ') || 'Sin responsable'}
                      </span>
                      <span>
                        <Clock3 size={11} style={{ display: 'inline' }} />{' '}
                        {t.due_at
                          ? `${dateLabel(t.due_at)} · ${clock(t.due_at)}`
                          : 'Sin vencimiento'}
                      </span>
                    </div>
                  </div>
                  <Status value={t.status} />
                </Link>
              ))
            ) : (
              <Empty title="Todo al día">No hay tareas abiertas en esta consulta.</Empty>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panelhead">
              <h2 className="sectionlabel">
                <Pin />
                Entrega de turno
              </h2>
              <Link className="link" href={link('bitacora')}>
                Bitácora →
              </Link>
            </div>
            {data.entries.length ? (
              data.entries.slice(0, 3).map((e) => (
                <Link
                  className="note"
                  style={{ display: 'block' }}
                  href={link('bitacora', { detail: e.id })}
                  key={e.id}
                >
                  <div className="row spread">
                    <Badge tone={e.pinned ? 'amber' : 'blue'}>
                      {e.pinned ? 'Fijado · ' : ''}
                      {e.type}
                    </Badge>
                    <span className="muted" style={{ fontSize: 10 }}>
                      {dateLabel(e.entry_date, { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <h3>{e.title}</h3>
                  <p>{e.description}</p>
                </Link>
              ))
            ) : (
              <Empty title="Sin observaciones">Aquí aparecerá la información del período.</Empty>
            )}
          </section>
          <section className="panel">
            <div className="panelhead">
              <h2>Próximos turnos</h2>
            </div>
            {upcoming
              .filter(
                (s) =>
                  s.status !== 'cancelled' &&
                  Date.parse(s.starts_at) > Date.parse(data.now) &&
                  (admin || s.worker_id === data.profile.worker_id),
              )
              .slice(0, 3)
              .map((s) => (
                <Link
                  href={link('turnos', { date: localInput(s.starts_at).slice(0, 10), mode: 'day' })}
                  key={s.id}
                  className="taskline"
                >
                  <CalendarDays size={17} className="muted" />
                  <div className="taskcontent">
                    <p>
                      {data.workers.find((w) => w.id === s.worker_id)?.full_name ?? 'Sin asignar'}
                    </p>
                    <div className="taskmeta">
                      {dateLabel(s.starts_at)} · {clock(s.starts_at)} – {clock(s.ends_at)}
                    </div>
                  </div>
                </Link>
              ))}
            {!upcoming.some(
              (s) =>
                s.status !== 'cancelled' &&
                Date.parse(s.starts_at) > Date.parse(data.now) &&
                (admin || s.worker_id === data.profile.worker_id),
            ) && <Empty title="Sin próximos turnos en la semana" />}
          </section>
          {admin && (
            <div className="row wrap">
              <button className="btn" onClick={() => edit({ kind: 'worker' })}>
                <Plus />
                Trabajador
              </button>
              <button className="btn" onClick={() => edit({ kind: 'task' })}>
                <Plus />
                Tarea
              </button>
              <button className="btn" onClick={() => edit({ kind: 'entry' })}>
                <Plus />
                Observación
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
