'use client';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pin, LockKeyhole } from 'lucide-react';
import type { ViewProps } from '@/features/shared/view-props';
import { Badge, Empty } from '@/components/ui/primitives';
import { addDays, dateLabel, dayRange, monday } from '@/utils/dates';
export function Logbook({ data, date, params, link }: ViewProps) {
  const daily = params.mode === 'day';
  const entries = data.entries.filter((e) => !daily || e.entry_date === date);
  const r = dayRange(daily ? date : monday(date), daily ? 1 : 7);
  const shifts = data.shifts.filter(
    (s) =>
      Date.parse(s.starts_at) < Date.parse(r.end) &&
      Date.parse(s.ends_at) > Date.parse(r.start) &&
      s.status !== 'cancelled',
  );
  const tasks = data.tasks.filter(
    (t) =>
      t.due_at &&
      Date.parse(t.due_at) >= Date.parse(r.start) &&
      Date.parse(t.due_at) < Date.parse(r.end),
  );
  return (
    <>
      <div className="toolbar">
        <div className="row">
          <Link
            className="iconbtn"
            href={link('bitacora', { date: addDays(date, daily ? -1 : -7) })}
            aria-label="Período anterior"
          >
            <ChevronLeft />
          </Link>
          <h2 style={{ fontSize: 14 }}>
            {daily ? dateLabel(date) : `Semana del ${dateLabel(monday(date))}`}
          </h2>
          <Link
            className="iconbtn"
            href={link('bitacora', { date: addDays(date, daily ? 1 : 7) })}
            aria-label="Período siguiente"
          >
            <ChevronRight />
          </Link>
        </div>
        <div className="segmented">
          <Link className={daily ? 'selected' : ''} href={link('bitacora', { mode: 'day' })}>
            Diaria
          </Link>
          <Link className={!daily ? 'selected' : ''} href={link('bitacora', { mode: 'week' })}>
            Semanal
          </Link>
        </div>
      </div>
      <form className="filters">
        <input
          name="q"
          aria-label="Buscar registros"
          placeholder="Buscar en la bitácora…"
          defaultValue={params.q}
        />
        <input name="date" type="date" aria-label="Fecha de bitácora" defaultValue={date} />
        <input name="mode" value={daily ? 'day' : 'week'} type="hidden" />
        <input
          name="entryType"
          placeholder="Tipo de registro"
          aria-label="Filtrar tipo"
          defaultValue={params.entryType}
        />
        <select name="author" aria-label="Filtrar autor" defaultValue={params.author ?? ''}>
          <option value="">Todos los autores</option>
          {data.authors.map((a) => (
            <option value={a.user_id} key={a.user_id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="btn">Aplicar filtros</button>
      </form>
      <div className="notice" style={{ marginBottom: 20 }}>
        <strong>Resumen del período:</strong> {shifts.length} turnos activos ·{' '}
        {tasks.filter((t) => t.status === 'completed').length} tareas completadas de {tasks.length}{' '}
        con vencimiento en el período y visibles en esta consulta · {entries.length} registros
        visibles. Las cifras respetan tus permisos y filtros.
      </div>
      <div className="stack">
        {entries.map((e) => (
          <Link className="panel note" href={link('bitacora', { detail: e.id })} key={e.id}>
            <div className="row spread">
              <div className="row">
                <Badge tone={e.pinned ? 'amber' : 'blue'}>{e.type}</Badge>
                {e.pinned && <Pin size={13} className="muted" />}
                {e.visibility === 'admin' && (
                  <Badge tone="red">
                    <LockKeyhole size={10} />
                    Solo administrador
                  </Badge>
                )}
                <Badge>{e.period === 'week' ? 'Semanal' : 'Diario'}</Badge>
              </div>
              <span className="muted" style={{ fontSize: 11 }}>
                {dateLabel(e.entry_date)}
              </span>
            </div>
            <h3 style={{ fontSize: 16, margin: '14px 0 8px' }}>{e.title}</h3>
            <p>{e.description}</p>
            <div className="taskmeta" style={{ marginTop: 16 }}>
              <span>
                Autor:{' '}
                {data.authors.find((a) => a.user_id === e.created_by)?.name ??
                  'Integrante del equipo'}
              </span>
              <span>
                Actualizado{' '}
                {dateLabel(e.updated_at, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                })}
              </span>
            </div>
          </Link>
        ))}
        {!entries.length && (
          <section className="panel">
            <Empty title="La bitácora está despejada">
              Registra observaciones, incidencias o pendientes para el próximo turno.
            </Empty>
          </section>
        )}
      </div>
    </>
  );
}
