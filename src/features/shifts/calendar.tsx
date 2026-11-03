'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, CalendarDays, Plus, Sun } from 'lucide-react';
import { canManage } from '@/lib/permissions';
import { DeleteShift } from './delete-shift';
import { Attendance, attendanceLabels } from './attendance';
import { ExportAttendance } from './export-attendance';
import type { ViewProps } from '@/features/shared/view-props';
import type { Row } from '@/types/database';
import { Avatar, Badge, Empty, Modal, Status } from '@/components/ui/primitives';
import {
  addDays,
  clock,
  dateLabel,
  dayRange,
  localInput,
  monday,
  scheduledHours,
  today,
} from '@/utils/dates';
export function Calendar(props: ViewProps) {
  const [selected, setSelected] = useState<Row<'shifts'> | null>(null);
  const { data, date, params, link, edit } = props;
  const mode = params.mode ?? 'week';
  const admin = canManage(data.profile.role);
  const start = monday(date),
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const shifts = data.shifts.filter(
    (s) => mode !== 'mine' || s.worker_id === data.profile.worker_id,
  );
  const workers = data.workers.filter(
    (w) =>
      (!params.worker || w.id === params.worker) &&
      (mode !== 'mine' || w.id === data.profile.worker_id) &&
      (w.active || shifts.some((s) => s.worker_id === w.id)),
  );
  const shiftOn = (s: Row<'shifts'>, d: string) => localInput(s.starts_at).slice(0, 10) === d;
  function absence(w: string, d: string) {
    const r = dayRange(d);
    return data.absences.filter(
      (a) =>
        a.worker_id === w &&
        (a.all_day
          ? a.start_date! <= d && a.end_date! >= d
          : Date.parse(a.starts_at!) < Date.parse(r.end) &&
            Date.parse(a.ends_at!) > Date.parse(r.start)),
    );
  }
  function shift(s: Row<'shifts'>) {
    const type = data.shiftTypes.find((t) => t.id === s.type_id);
    return (
      <button
        type="button"
        className="shift"
        style={
          {
            '--shift-color': type?.color ?? '#00bfff',
            opacity: s.status === 'cancelled' ? 0.5 : 1,
          } as React.CSSProperties
        }
        key={s.id}
        onClick={() => setSelected(s)}
      >
        <span className="hours">
          {clock(s.starts_at)} – {clock(s.ends_at)}
          {localInput(s.starts_at).slice(0, 10) !== localInput(s.ends_at).slice(0, 10) && ' +1'}
        </span>
        <small>
          {type?.name} ·{' '}
          {{ scheduled: 'Programado', confirmed: 'Confirmado', cancelled: 'Cancelado' }[s.status] ??
            s.status}
        </small>
        {admin && (
          <small>
            {
              attendanceLabels[
                data.attendance?.find((a) => a.shift_id === s.id)?.status === 'present'
                  ? 'present'
                  : data.attendance?.find((a) => a.shift_id === s.id)?.status === 'absent'
                    ? 'absent'
                    : 'pending'
              ]
            }
          </small>
        )}
      </button>
    );
  }
  function agenda(day: string) {
    const r = dayRange(day),
      items = shifts.filter(
        (s) =>
          Date.parse(s.starts_at) < Date.parse(r.end) &&
          Date.parse(s.ends_at) > Date.parse(r.start),
      );
    return (
      <section className="panel" key={day}>
        <div className="panelhead">
          <h2>{dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          {day === today() && <Badge tone="blue">Hoy</Badge>}
        </div>
        {items.map((s) => {
          const w = data.workers.find((w) => w.id === s.worker_id);
          return (
            <div className="taskline" key={s.id}>
              <Avatar name={w?.full_name ?? 'SA'} color={w?.color} />
              <div style={{ flex: 1 }}>
                <div className="row spread" style={{ marginBottom: 8 }}>
                  <strong>{w?.full_name ?? 'Sin asignar'}</strong>
                  <span className="muted" style={{ fontSize: 10 }}>
                    {scheduledHours(s.starts_at, s.ends_at, s.break_minutes).toFixed(1)} h netas
                  </span>
                </div>
                {shift(s)}
                <small className="muted">
                  {s.location ?? 'Sin lugar especificado'}
                  {localInput(s.starts_at).slice(0, 10) < day
                    ? ' · Continúa desde el día anterior'
                    : ''}
                </small>
              </div>
            </div>
          );
        })}
        {data.absences
          .filter((a) =>
            a.all_day
              ? a.start_date! <= day && a.end_date! >= day
              : Date.parse(a.starts_at!) < Date.parse(r.end) &&
                Date.parse(a.ends_at!) > Date.parse(r.start),
          )
          .map((a) => (
            <div className="taskline" key={a.id}>
              <Sun size={18} />
              <div>
                <strong>{data.workers.find((w) => w.id === a.worker_id)?.full_name}</strong>
                <p className="muted">
                  {a.type} · {a.shared_note}
                </p>
                {admin && (
                  <button
                    className="link"
                    onClick={() =>
                      props.notify('Gestiona esta ausencia desde la lista al pie del calendario.')
                    }
                  >
                    Ver ausencia
                  </button>
                )}
              </div>
            </div>
          ))}
        {!items.length && <Empty title="Sin turnos este día" />}
      </section>
    );
  }
  const grid = (
    <div className="panel tablewrap">
      <table className="calendar">
        <thead>
          <tr>
            <th>
              Equipo <span className="muted">/ {workers.length}</span>
            </th>
            {days.map((d) => (
              <th key={d} className={d === today() ? 'today' : ''}>
                {dateLabel(d, { weekday: 'short' })}
                <span className="daynum">{d.slice(-2)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ...workers.map((w) => ({
              id: w.id,
              name: w.full_name,
              color: w.color,
              job: w.job_title,
            })),
            {
              id: 'unassigned',
              name: 'Sin asignar',
              color: '#c98b2b',
              job: 'Pendientes de cobertura',
            },
          ].map((w) => {
            const mine = shifts.filter((s) => (s.worker_id ?? 'unassigned') === w.id);
            return (
              <tr key={w.id}>
                <td>
                  <div className="workername">
                    <Avatar name={w.name} color={w.color} />
                    <div>
                      <strong>{w.name}</strong>
                      <div className="weekhours">
                        {mine
                          .filter(
                            (s) =>
                              s.status !== 'cancelled' &&
                              localInput(s.starts_at).slice(0, 10) >= start &&
                              localInput(s.starts_at).slice(0, 10) <= addDays(start, 6),
                          )
                          .reduce(
                            (n, s) => n + scheduledHours(s.starts_at, s.ends_at, s.break_minutes),
                            0,
                          )
                          .toLocaleString('es-CL', { maximumFractionDigits: 1 })}{' '}
                        h programadas
                      </div>
                    </div>
                  </div>
                </td>
                {days.map((d) => (
                  <td key={d} className={d === today() ? 'today' : ''}>
                    {mine.filter((s) => shiftOn(s, d)).map(shift)}
                    {absence(w.id, d).map((a) => (
                      <div className="absence" key={a.id}>
                        {a.type}
                        {a.shared_note && (
                          <small style={{ display: 'block' }}>{a.shared_note}</small>
                        )}
                      </div>
                    ))}
                    {!mine.some((s) => shiftOn(s, d)) && !absence(w.id, d).length && (
                      <span className="offday">{w.id === 'unassigned' ? '—' : 'Sin turno'}</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      {selected && (
        <Modal title="Detalle del turno" onClose={() => setSelected(null)}>
          <div className="dialogbody stack">
            <h2>
              {data.workers.find((w) => w.id === selected.worker_id)?.full_name ?? 'Sin asignar'}
            </h2>
            <div className="row">
              <Status value={selected.status} />
              <Badge tone="blue">
                {data.shiftTypes.find((t) => t.id === selected.type_id)?.name}
              </Badge>
            </div>
            <p className="hours">
              {dateLabel(selected.starts_at)} · {clock(selected.starts_at)} →{' '}
              {dateLabel(selected.ends_at)} · {clock(selected.ends_at)}
            </p>
            <p>
              {scheduledHours(selected.starts_at, selected.ends_at, selected.break_minutes).toFixed(
                2,
              )}{' '}
              h programadas · {selected.break_minutes} min de descanso
            </p>
            <p className="muted">Lugar: {selected.location || 'Sin especificar'}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {selected.notes || 'Sin observaciones operativas.'}
            </p>
            <small className="muted">
              Creado por{' '}
              {data.authors.find((a) => a.user_id === selected.created_by)?.name ?? 'Administrador'}{' '}
              · {dateLabel(selected.created_at)}. Actualizado {dateLabel(selected.updated_at)} ·{' '}
              {clock(selected.updated_at)}. Versión {selected.version}.
            </small>
            {admin && (
              <Attendance
                shift={selected}
                record={data.attendance?.find((a) => a.shift_id === selected.id)}
                demo={props.demo}
                notify={props.notify}
              />
            )}
          </div>
          <div className="dialogfoot" style={{ flexWrap: 'wrap' }}>
            {admin && (
              <DeleteShift
                key={selected.id}
                shift={selected}
                demo={props.demo}
                notify={props.notify}
                onDeleted={() => setSelected(null)}
              />
            )}
            <button className="btn" onClick={() => setSelected(null)}>
              Cerrar
            </button>
            {admin && (
              <button
                className="btn primary"
                onClick={() => {
                  const record = selected;
                  setSelected(null);
                  edit({ kind: 'shift', record });
                }}
              >
                Editar o cancelar turno
              </button>
            )}
          </div>
        </Modal>
      )}
      <div className="toolbar">
        <div className="row">
          <Link
            className="iconbtn"
            aria-label="Período anterior"
            href={link('turnos', {
              date: addDays(date, mode === 'day' ? -1 : mode === 'month' ? -28 : -7),
            })}
          >
            <ChevronLeft />
          </Link>
          <h2 style={{ fontSize: 14 }}>
            {mode === 'day'
              ? dateLabel(date)
              : mode === 'month'
                ? dateLabel(date, { month: 'long', year: 'numeric' })
                : `${dateLabel(start, { day: 'numeric', month: 'short' })} – ${dateLabel(addDays(start, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </h2>
          <Link
            className="iconbtn"
            aria-label="Período siguiente"
            href={link('turnos', {
              date: addDays(date, mode === 'day' ? 1 : mode === 'month' ? 28 : 7),
            })}
          >
            <ChevronRight />
          </Link>
          <Link className="btn" href={link('turnos', { date: today() })}>
            Hoy
          </Link>
        </div>
        <div className="segmented">
          {[
            ['week', 'Semana'],
            ['day', 'Día'],
            ['month', 'Mes'],
            ['mine', 'Mis turnos'],
            ['grid', 'Cuadrícula'],
          ]
            .filter(([m]) => m !== 'mine' || data.profile.worker_id)
            .map(([m, label]) => (
              <Link
                className={mode === m ? 'selected' : ''}
                href={link('turnos', { mode: m })}
                key={m}
              >
                {label}
              </Link>
            ))}
        </div>
      </div>
      <form className="filters" method="get">
        <input name="date" type="date" aria-label="Fecha del calendario" defaultValue={date} />
        <input type="hidden" name="mode" value={mode} />
        <select name="worker" aria-label="Filtrar trabajador" defaultValue={params.worker ?? ''}>
          <option value="">Todo el equipo</option>
          {data.workers.map((w) => (
            <option value={w.id} key={w.id}>
              {w.full_name}
            </option>
          ))}
        </select>
        <select name="type" aria-label="Filtrar tipo de turno" defaultValue={params.type ?? ''}>
          <option value="">Todos los tipos</option>
          {data.shiftTypes.map((t) => (
            <option value={t.id} key={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          name="shiftStatus"
          aria-label="Filtrar estado de turno"
          defaultValue={params.shiftStatus ?? ''}
        >
          <option value="">Todos los estados</option>
          <option value="scheduled">Programado</option>
          <option value="confirmed">Confirmado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <input
          name="location"
          aria-label="Filtrar lugar"
          placeholder="Lugar o zona"
          defaultValue={params.location}
        />
        <button className="btn">Aplicar</button>
        <Link
          className="btn ghost"
          href={link('turnos', { worker: '', type: '', shiftStatus: '', location: '' })}
        >
          Limpiar
        </Link>
      </form>
      {admin && (
        <div className="row wrap" style={{ marginBottom: 18 }}>
          <button className="btn" onClick={() => edit({ kind: 'copy' })}>
            <Copy />
            Copiar semana
          </button>
          <ExportAttendance date={date} demo={props.demo} notify={props.notify} />
          <button className="btn" onClick={() => edit({ kind: 'absence' })}>
            <Plus />
            Ausencia o día libre
          </button>
          <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>
            Las validaciones se aplican al guardar
          </span>
        </div>
      )}
      {mode === 'month' ? (
        <div className="panel monthgrid">
          {Array.from({ length: 42 }, (_, i) => addDays(monday(date.slice(0, 7) + '-01'), i)).map(
            (d) => (
              <div key={d} className="monthday">
                <span className={d === today() ? 'link' : 'muted'}>
                  {dateLabel(d, { day: '2-digit', month: 'short' })}
                </span>
                <Link href={link('turnos', { mode: 'day', date: d })}>
                  {shifts.filter((s) => shiftOn(s, d) && s.status !== 'cancelled').length} turnos
                </Link>
              </div>
            ),
          )}
        </div>
      ) : mode === 'day' ? (
        agenda(date)
      ) : mode === 'grid' ? (
        grid
      ) : (
        <>
          <div className="desktopcalendar">{grid}</div>
          <div className="mobileagenda stack">{days.map(agenda)}</div>
        </>
      )}
      <div className="row wrap muted" style={{ fontSize: 11, margin: '17px 0' }}>
        <CalendarDays size={14} /> Horas programadas menos descansos · no equivalen a asistencia.{' '}
        <span>+1 = termina al día siguiente.</span>
      </div>
      {!!data.absences.length && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panelhead">
            <h2>Ausencias del período</h2>
          </div>
          {data.absences.map((a) => (
            <div className="taskline" key={a.id}>
              <div style={{ flex: 1 }}>
                <strong>
                  {data.workers.find((w) => w.id === a.worker_id)?.full_name} · {a.type}
                </strong>
                <p className="muted" style={{ fontSize: 11 }}>
                  {a.all_day
                    ? `${dateLabel(a.start_date!)} – ${dateLabel(a.end_date!)}`
                    : `${dateLabel(a.starts_at!)} · ${clock(a.starts_at!)} – ${clock(a.ends_at!)}`}{' '}
                  · {a.shared_note}
                </p>
              </div>
              {admin && (
                <button
                  className="btn danger"
                  onClick={async () => {
                    if (props.demo) {
                      props.notify('Demostración de solo lectura.');
                      return;
                    }
                    const { safeMutate: mutate } =
                      await import('@/features/shared/client-mutation');
                    const r = await mutate('absence-delete', { id: a.id, version: a.version });
                    props.notify(r.message);
                  }}
                >
                  Eliminar ausencia
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
