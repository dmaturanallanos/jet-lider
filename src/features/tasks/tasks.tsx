'use client';
import Link from 'next/link';
import { Clock3, MapPin } from 'lucide-react';
import type { ViewProps } from '@/features/shared/view-props';
import { Badge, Empty, Status, statusLabels } from '@/components/ui/primitives';
import { clock, dateLabel } from '@/utils/dates';
export function Tasks({ data, params, link }: ViewProps) {
  const board = params.mode === 'board',
    mine = params.mine === '1';
  const tasks = data.tasks.filter(
    (t) =>
      !mine ||
      data.assignees.some((a) => a.task_id === t.id && a.worker_id === data.profile.worker_id),
  );
  function card(t: (typeof tasks)[number]) {
    const overdue =
      t.due_at &&
      Date.parse(t.due_at) < Date.parse(data.now) &&
      !['completed', 'cancelled'].includes(t.status);
    return (
      <Link
        className={board ? 'taskcard' : 'taskline'}
        href={link('tareas', { detail: t.id })}
        key={t.id}
      >
        <div className="taskcontent">
          <div className="row spread" style={{ marginBottom: 8 }}>
            <Status value={t.priority} />
            {overdue && <Badge tone="red">Vencida</Badge>}
          </div>
          <p style={{ fontSize: 13, margin: '10px 0' }}>{t.title}</p>
          <div className="taskmeta">
            <span>
              {data.assignees
                .filter((a) => a.task_id === t.id)
                .map((a) => data.workers.find((w) => w.id === a.worker_id)?.full_name)
                .join(', ') || 'Sin responsable'}
            </span>
            {t.due_at && (
              <span>
                <Clock3 size={11} style={{ display: 'inline' }} />{' '}
                {dateLabel(t.due_at, { day: 'numeric', month: 'short' })} · {clock(t.due_at)}
              </span>
            )}
            {t.location && (
              <span>
                <MapPin size={11} style={{ display: 'inline' }} /> {t.location}
              </span>
            )}
          </div>
        </div>
        {!board && <Status value={t.status} />}
      </Link>
    );
  }
  return (
    <>
      <div className="toolbar">
        <div className="segmented">
          <Link className={!mine ? 'selected' : ''} href={link('tareas', { mine: '' })}>
            Tareas autorizadas
          </Link>
          {data.profile.worker_id && (
            <Link className={mine ? 'selected' : ''} href={link('tareas', { mine: '1' })}>
              Mis tareas
            </Link>
          )}
        </div>
        <div className="segmented">
          <Link className={!board ? 'selected' : ''} href={link('tareas', { mode: 'list' })}>
            Lista
          </Link>
          <Link className={board ? 'selected' : ''} href={link('tareas', { mode: 'board' })}>
            Tablero
          </Link>
        </div>
      </div>
      <form className="filters">
        <input
          name="q"
          placeholder="Buscar tareas…"
          aria-label="Buscar tareas"
          defaultValue={params.q}
        />
        <input type="hidden" name="mode" value={board ? 'board' : 'list'} />
        <input type="hidden" name="mine" value={params.mine ?? ''} />
        <select name="status" aria-label="Estado" defaultValue={params.status ?? ''}>
          <option value="">Todos los estados</option>
          {['pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
            <option value={s} key={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <select name="priority" aria-label="Prioridad" defaultValue={params.priority ?? ''}>
          <option value="">Todas las prioridades</option>
          {['low', 'medium', 'high', 'urgent'].map((s) => (
            <option value={s} key={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <select name="taskWorker" aria-label="Responsable" defaultValue={params.taskWorker ?? ''}>
          <option value="">Todos los responsables</option>
          {data.workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.full_name}
            </option>
          ))}
        </select>
        <input
          name="dueFrom"
          type="date"
          aria-label="Vencimiento desde"
          defaultValue={params.dueFrom}
        />
        <input
          name="dueTo"
          type="date"
          aria-label="Vencimiento hasta"
          defaultValue={params.dueTo}
        />
        <button className="btn">Aplicar filtros</button>
      </form>
      {board ? (
        <div className="board">
          {['pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
            <section className="boardcol" key={s}>
              <div className="row spread">
                <h2 style={{ fontSize: 12 }}>{statusLabels[s]}</h2>
                <Badge>{tasks.filter((t) => t.status === s).length}</Badge>
              </div>
              {tasks.filter((t) => t.status === s).map(card)}
              {!tasks.some((t) => t.status === s) && (
                <p className="muted" style={{ fontSize: 11, padding: 8 }}>
                  Sin tareas en este estado
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          {tasks.map(card)}
          {!tasks.length && (
            <Empty title="Sin tareas en esta consulta">
              Las tareas son visibles solo para el administrador y sus responsables.
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
