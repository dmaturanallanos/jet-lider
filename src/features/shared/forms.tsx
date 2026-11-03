'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { safeMutate as mutate } from './client-mutation';
import { canManage } from '@/lib/permissions';
import type { WorkspaceData } from './types';
import type { Row } from '@/types/database';
import { Modal, Status } from '@/components/ui/primitives';
import {
  addDays,
  clock,
  copyLocalInstant,
  dateLabel,
  localInput,
  localToInstant,
  monday,
  offsetDays,
  scheduledHours,
} from '@/utils/dates';
import {
  copyWeek,
  repeatShifts,
  templateFromLocal,
  validateBatch,
  type ShiftInput,
} from '@/features/shifts/planning';
import { fetchCopySource, fetchFutureSeries } from '@/features/shifts/actions';
import { workerImpact } from '@/features/workers/actions';
export type Editor =
  | { kind: 'worker'; record?: Row<'workers'> }
  | { kind: 'shift'; record?: Row<'shifts'> }
  | { kind: 'task'; record?: Row<'tasks'> }
  | { kind: 'entry'; record?: Row<'logbook_entries'> }
  | { kind: 'absence' }
  | { kind: 'copy' };
type Props = {
  editor: Editor;
  data: WorkspaceData;
  date: string;
  onClose: () => void;
  notify: (s: string) => void;
};
const text = (f: FormData, key: string) => String(f.get(key) ?? '');
const names = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export function EditorModal({ editor, data, date, onClose, notify }: Props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ShiftInput[] | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [repeat, setRepeat] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [impact, setImpact] = useState<{ shifts: number; tasks: number } | null>(null);
  const [impactBusy, setImpactBusy] = useState(false);
  const [inactive, setInactive] = useState(
    editor.kind === 'worker' && editor.record ? !editor.record.active : false,
  );
  const admin = canManage(data.profile.role);
  const w = editor.kind === 'worker' ? editor.record : undefined;
  const s = editor.kind === 'shift' ? editor.record : undefined;
  const t = editor.kind === 'task' ? editor.record : undefined;
  const entry = editor.kind === 'entry' ? editor.record : undefined;
  const workers = data.workers.filter(
    (w) =>
      w.active ||
      w.id === s?.worker_id ||
      data.assignees.some((a) => a.task_id === t?.id && a.worker_id === w.id),
  );
  const privateData = data.privateDetails.find((d) => d.id === w?.id);
  const title = {
    worker: w ? 'Editar trabajador' : 'Nuevo trabajador',
    shift: s ? 'Editar turno' : 'Programar turnos',
    task: t ? 'Editar tarea' : 'Nueva tarea',
    entry: entry ? 'Editar registro' : 'Nueva observación',
    absence: 'Registrar ausencia',
    copy: 'Copiar semana',
  }[editor.kind];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(event.currentTarget);
    try {
      let action: string = editor.kind;
      let input: unknown;
      if (editor.kind === 'worker') {
        input = {
          request_id: requestId,
          id: w?.id,
          version: w?.version,
          full_name: text(f, 'full_name'),
          nickname: text(f, 'nickname'),
          job_title: text(f, 'job_title'),
          color: text(f, 'color'),
          joined_on: text(f, 'joined_on'),
          active: !inactive,
          acknowledge: f.has('acknowledge'),
          email: text(f, 'email'),
          phone: text(f, 'phone'),
          notes: text(f, 'notes'),
          employment_type: text(f, 'employment_type') || null,
        };
      }
      if (editor.kind === 'task') {
        const due = text(f, 'due_at');
        input = {
          id: t?.id,
          version: t?.version,
          title: text(f, 'title'),
          description: text(f, 'description'),
          priority: text(f, 'priority'),
          status: text(f, 'status'),
          due_at: due ? localToInstant(due) : '',
          location: text(f, 'location'),
          assignees: f.getAll('assignees'),
        };
      }
      if (editor.kind === 'entry') {
        input = {
          id: entry?.id,
          version: entry?.version,
          title: text(f, 'title'),
          description: text(f, 'description'),
          type: text(f, 'type'),
          period: text(f, 'period'),
          entry_date: text(f, 'entry_date'),
          visibility: admin ? text(f, 'visibility') : 'team',
          pinned: admin && f.has('pinned'),
          worker_id: text(f, 'related_worker') || null,
          shift_id: text(f, 'related_shift') || null,
          task_id: text(f, 'related_task') || null,
        };
      }
      if (editor.kind === 'absence') {
        input = {
          worker_id: text(f, 'worker_id'),
          type: text(f, 'type'),
          all_day: allDay,
          start_date: allDay ? text(f, 'start_date') : '',
          end_date: allDay ? text(f, 'end_date') : '',
          starts_at: allDay ? '' : localToInstant(text(f, 'starts_at')),
          ends_at: allDay ? '' : localToInstant(text(f, 'ends_at')),
          shared_note: text(f, 'shared_note'),
          private_note: text(f, 'private_note'),
        };
      }
      if (editor.kind === 'shift' || editor.kind === 'copy') {
        action = 'shifts';
        let items = preview;
        if (!items) {
          if (editor.kind === 'copy') {
            const source = monday(date);
            const target = monday(text(f, 'target'));
            if (target === source) throw new Error('Selecciona una semana diferente.');
            items = copyWeek(await fetchCopySource(source), source, target);
          } else {
            const template: ShiftInput = {
              ...templateFromLocal(
                text(f, 'starts_at'),
                text(f, 'ends_at'),
                Number(text(f, 'break_minutes')),
              ),
              worker_id: text(f, 'worker_id') || null,
              type_id: text(f, 'type_id'),
              location: text(f, 'location'),
              notes: text(f, 'notes'),
              status: text(f, 'status') as ShiftInput['status'],
            };
            if (s) {
              if (f.has('future') && s.series_id) {
                const future = await fetchFutureSeries(s.series_id, s.starts_at, s.worker_id);
                if (Date.parse(template.starts_at) > Date.parse(s.starts_at)) future.reverse();

                const startDate = localInput(s.starts_at).slice(0, 10);
                items = future.map((old) => {
                  const delta = offsetDays(startDate, localInput(old.starts_at).slice(0, 10));
                  return {
                    ...template,
                    id: old.id,
                    version: old.version,
                    starts_at: copyLocalInstant(template.starts_at, delta),
                    ends_at: copyLocalInstant(template.ends_at, delta),
                  };
                });
              } else items = [{ ...template, id: s.id, version: s.version }];
            } else {
              const selected = f.getAll('workers').map(String);
              const assigned = selected.length ? selected : [null];
              items = repeat
                ? repeatShifts(
                    template,
                    assigned,
                    text(f, 'until'),
                    f.getAll('weekdays').map(Number),
                  )
                : assigned.map((worker_id) => ({ ...template, worker_id }));
            }
          }
          if (!items.length) throw new Error('No hay turnos para copiar.');
          validateBatch(items, data.shifts);
          setPreview(items);
          setBusy(false);
          return;
        }
        input = {
          request_id: requestId,
          items,
          series_description: repeat
            ? 'Serie de turnos programada'
            : editor.kind === 'copy'
              ? 'Copia de semana'
              : undefined,
        };
      }
      const result = await mutate(action, input);
      if (!result.ok) throw new Error(result.message);
      notify(result.message);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialogbody">
          {error && (
            <div className="notice errornotice" role="alert">
              {error}{' '}
              <button type="button" className="link" onClick={() => router.refresh()}>
                Recargar datos
              </button>
              <small style={{ display: 'block' }}>
                El formulario conserva tu contenido. Si hay conflicto de edición, cierra y vuelve a
                abrir con la versión actualizada.
              </small>
            </div>
          )}
          <div hidden={!!preview} className="formgrid">
            {editor.kind === 'worker' && (
              <>
                <label className="full">
                  Nombre completo
                  <input
                    name="full_name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={w?.full_name}
                  />
                </label>
                <label>
                  Nombre corto
                  <input name="nickname" defaultValue={w?.nickname ?? ''} />
                </label>
                <label>
                  Cargo o función
                  <input name="job_title" defaultValue={w?.job_title ?? ''} />
                </label>
                <label>
                  Modalidad de pago (privada)
                  <select name="employment_type" defaultValue={privateData?.employment_type ?? ''}>
                    <option value="">Sin definir</option>
                    <option value="boleta">Boleta de honorarios</option>
                    <option value="contrato">Contrato</option>
                  </select>
                </label>
                <label>
                  Correo privado
                  <input name="email" type="email" defaultValue={privateData?.email ?? ''} />
                </label>
                <label>
                  Teléfono privado
                  <input name="phone" type="tel" defaultValue={privateData?.phone ?? ''} />
                </label>
                <label>
                  Color del calendario
                  <input name="color" type="color" defaultValue={w?.color ?? '#00bfff'} />
                </label>
                <label>
                  Fecha de ingreso
                  <input name="joined_on" type="date" defaultValue={w?.joined_on ?? ''} />
                </label>
                <label className="full">
                  Notas privadas
                  <textarea name="notes" defaultValue={privateData?.notes ?? ''} />
                </label>
                {w && (
                  <>
                    <label className="checklabel full">
                      <input
                        type="checkbox"
                        checked={inactive}
                        onChange={async (e) => {
                          const value = e.target.checked;
                          setInactive(value);
                          if (value && w) {
                            setImpactBusy(true);
                            try {
                              setImpact(await workerImpact(w.id));
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : 'No se pudieron consultar los pendientes.',
                              );
                            } finally {
                              setImpactBusy(false);
                            }
                          }
                        }}
                      />
                      Desactivar trabajador
                    </label>
                    {inactive && (
                      <div className="notice full">
                        {impactBusy ? (
                          <p>Consultando turnos futuros y tareas abiertas…</p>
                        ) : (
                          impact && (
                            <p>
                              <strong>
                                {impact.shifts} turnos futuros · {impact.tasks} tareas abiertas
                              </strong>
                            </p>
                          )
                        )}
                        Se bloqueará su acceso operativo y las nuevas asignaciones. Conserva su
                        historial. Revisa sus turnos futuros y tareas abiertas desde los filtros de
                        Turnos y Tareas antes de continuar.
                        <label className="checklabel" style={{ marginTop: 10 }}>
                          <input type="checkbox" name="acknowledge" required />
                          Entiendo que debo gestionar sus pendientes
                        </label>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {(editor.kind === 'shift' || editor.kind === 'absence') && (
              <>
                <label className="full">
                  {editor.kind === 'shift' && !s
                    ? 'Responsables · sin selección = sin asignar'
                    : 'Trabajador'}
                  {editor.kind === 'shift' && !s ? (
                    <div className="row wrap" style={{ padding: '10px 0' }}>
                      {workers.map((w) => (
                        <label className="checklabel" key={w.id}>
                          <input name="workers" type="checkbox" value={w.id} />
                          {w.nickname || w.full_name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <select
                      name="worker_id"
                      defaultValue={s?.worker_id ?? ''}
                      required={editor.kind === 'absence'}
                    >
                      <option value="">Sin asignar</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              </>
            )}
            {editor.kind === 'shift' && (
              <>
                <label>
                  Tipo de turno
                  <select name="type_id" defaultValue={s?.type_id ?? data.shiftTypes[0]?.id}>
                    {data.shiftTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Estado
                  <select name="status" defaultValue={s?.status ?? 'scheduled'}>
                    <option value="scheduled">Programado</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
                <label>
                  Inicio · hora de Chile
                  <input
                    name="starts_at"
                    type="datetime-local"
                    required
                    defaultValue={s ? localInput(s.starts_at) : `${date}T07:00`}
                  />
                </label>
                <label>
                  Término · hora de Chile
                  <input
                    name="ends_at"
                    type="datetime-local"
                    required
                    defaultValue={s ? localInput(s.ends_at) : `${date}T15:00`}
                  />
                  <small>Si termina de noche, selecciona la fecha del día siguiente.</small>
                </label>
                <label>
                  Descanso (minutos)
                  <input
                    name="break_minutes"
                    type="number"
                    min={0}
                    required
                    defaultValue={s?.break_minutes ?? 30}
                  />
                </label>
                <label>
                  Lugar o zona
                  <input name="location" defaultValue={s?.location ?? ''} />
                </label>
                <label className="full">
                  Observaciones operativas
                  <textarea name="notes" defaultValue={s?.notes ?? ''} />
                </label>
                {s?.series_id ? (
                  <label className="checklabel full">
                    <input name="future" type="checkbox" />
                    Aplicar a esta ocurrencia y las futuras de la serie
                  </label>
                ) : (
                  !s && (
                    <>
                      <label className="checklabel full">
                        <input
                          type="checkbox"
                          checked={repeat}
                          onChange={(e) => setRepeat(e.target.checked)}
                        />
                        Repetir en días seleccionados
                      </label>
                      {repeat && (
                        <>
                          <label>
                            Repetir hasta
                            <input
                              name="until"
                              type="date"
                              required
                              defaultValue={addDays(date, 14)}
                            />
                          </label>
                          <div className="full row wrap">
                            {names.map((name, i) => (
                              <label key={name} className="checklabel">
                                <input
                                  name="weekdays"
                                  type="checkbox"
                                  value={i + 1}
                                  defaultChecked={i < 5}
                                />
                                {name}
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )
                )}
                <div className="notice full">
                  La confirmación es administrativa. Las horas son programadas, descontando
                  descansos; no registran asistencia ni remuneraciones. Las horas ambiguas o
                  inexistentes por cambio de horario se rechazan.
                </div>
              </>
            )}
            {editor.kind === 'copy' && (
              <>
                <div className="notice full">
                  Origen: semana del {dateLabel(monday(date))}. Se consultarán todos los turnos
                  activos de esa semana y se conservarán sus horas locales. Revisa los conflictos
                  antes de guardar.
                </div>
                <label className="full">
                  Semana de destino
                  <input
                    name="target"
                    type="date"
                    defaultValue={addDays(monday(date), 7)}
                    required
                  />
                </label>
              </>
            )}
            {editor.kind === 'absence' && (
              <>
                <label>
                  Tipo
                  <input name="type" list="absence-types" defaultValue="Día libre" required />
                  <datalist id="absence-types">
                    {['Día libre', 'Vacaciones', 'Permiso', 'Ausencia', 'Otro'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </datalist>
                </label>
                <label className="checklabel">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                  />
                  Días completos
                </label>
                <label>
                  Desde
                  <input
                    name={allDay ? 'start_date' : 'starts_at'}
                    type={allDay ? 'date' : 'datetime-local'}
                    defaultValue={allDay ? date : `${date}T07:00`}
                    required
                  />
                </label>
                <label>
                  Hasta (inclusive en días completos)
                  <input
                    name={allDay ? 'end_date' : 'ends_at'}
                    type={allDay ? 'date' : 'datetime-local'}
                    defaultValue={allDay ? date : `${date}T15:00`}
                    required
                  />
                </label>
                <label className="full">
                  Observación compartida
                  <textarea name="shared_note" />
                </label>
                <label className="full">
                  Nota privada
                  <textarea name="private_note" />
                </label>
              </>
            )}
            {editor.kind === 'task' && (
              <>
                <label className="full">
                  Título
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={180}
                    defaultValue={t?.title}
                  />
                </label>
                <label className="full">
                  Descripción
                  <textarea name="description" defaultValue={t?.description ?? ''} />
                </label>
                <label>
                  Prioridad
                  <select name="priority" defaultValue={t?.priority ?? 'medium'}>
                    {['low', 'medium', 'high', 'urgent'].map((p) => (
                      <option key={p} value={p}>
                        {{ low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Estado
                  <select name="status" defaultValue={t?.status ?? 'pending'}>
                    {['pending', 'in_progress', 'completed', 'cancelled'].map((p) => (
                      <option key={p} value={p}>
                        {
                          {
                            pending: 'Pendiente',
                            in_progress: 'En progreso',
                            completed: 'Completada',
                            cancelled: 'Cancelada',
                          }[p]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha límite · hora de Chile
                  <input
                    name="due_at"
                    type="datetime-local"
                    defaultValue={t?.due_at ? localInput(t.due_at) : ''}
                  />
                </label>
                <label>
                  Lugar o zona
                  <input name="location" defaultValue={t?.location ?? ''} />
                </label>
                <fieldset className="full">
                  <legend className="eyebrow" style={{ marginBottom: 12 }}>
                    Responsables · estado compartido
                  </legend>
                  <div className="row wrap">
                    {workers.map((w) => (
                      <label key={w.id} className="checklabel">
                        <input
                          name="assignees"
                          type="checkbox"
                          value={w.id}
                          defaultChecked={data.assignees.some(
                            (a) => a.task_id === t?.id && a.worker_id === w.id,
                          )}
                        />
                        {w.full_name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            {editor.kind === 'entry' && (
              <>
                <label className="full">
                  Título
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={180}
                    defaultValue={entry?.title}
                  />
                </label>
                <label className="full">
                  Descripción
                  <textarea name="description" required defaultValue={entry?.description} />
                </label>
                <label>
                  Tipo
                  <input
                    name="type"
                    list="entry-types"
                    defaultValue={entry?.type ?? 'Observación'}
                    required
                  />
                  <datalist id="entry-types">
                    {['Observación', 'Incidencia', 'Pendiente', 'Entrega de turno', 'Resumen'].map(
                      (x) => (
                        <option key={x}>{x}</option>
                      ),
                    )}
                  </datalist>
                </label>
                <label>
                  Período
                  <select name="period" defaultValue={entry?.period ?? 'day'}>
                    <option value="day">Día</option>
                    <option value="week">Semana</option>
                  </select>
                </label>
                <label>
                  Fecha correspondiente
                  <input
                    name="entry_date"
                    type="date"
                    defaultValue={entry?.entry_date ?? date}
                    required
                  />
                </label>
                {admin && (
                  <>
                    <label>
                      Visibilidad
                      <select name="visibility" defaultValue={entry?.visibility ?? 'team'}>
                        <option value="team">Equipo</option>
                        <option value="admin">Solo administrador</option>
                      </select>
                    </label>
                    <label className="checklabel full">
                      <input name="pinned" type="checkbox" defaultChecked={entry?.pinned} />
                      Fijar registro destacado
                    </label>
                  </>
                )}
                <label>
                  Trabajador relacionado
                  <select name="related_worker" defaultValue={entry?.worker_id ?? ''}>
                    <option value="">Ninguno</option>
                    {data.workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tarea relacionada
                  <select name="related_task" defaultValue={entry?.task_id ?? ''}>
                    <option value="">Ninguna</option>
                    {data.tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Turno relacionado
                  <select name="related_shift" defaultValue={entry?.shift_id ?? ''}>
                    <option value="">Ninguno</option>
                    {data.shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {dateLabel(s.starts_at)} · {clock(s.starts_at)} ·{' '}
                        {data.workers.find((w) => w.id === s.worker_id)?.full_name ?? 'Sin asignar'}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          {preview && (
            <div className="stack">
              <div className="notice">
                Vista previa: {preview.length} turnos. El servidor volverá a comprobar ausencias,
                superposiciones y versiones, y guardará todo en una sola transacción.
              </div>
              <div className="tablewrap" style={{ maxHeight: 350 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Responsable</th>
                      <th>Fecha y horario</th>
                      <th>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((s, i) => (
                      <tr key={i}>
                        <td>
                          {data.workers.find((w) => w.id === s.worker_id)?.full_name ??
                            'Sin asignar'}
                        </td>
                        <td>
                          {dateLabel(s.starts_at)}
                          <br />
                          {clock(s.starts_at)} – {clock(s.ends_at)}
                          {localInput(s.starts_at).slice(0, 10) !==
                            localInput(s.ends_at).slice(0, 10) && ' (+1 día)'}
                          <br />
                          <Status value={s.status} />
                        </td>
                        <td>
                          {scheduledHours(s.starts_at, s.ends_at, s.break_minutes).toFixed(2)} h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <small className="muted">
                Duraciones calculadas entre instantes reales. En cambios de horario de Chile pueden
                diferir de las horas indicadas por el reloj.
              </small>
            </div>
          )}
        </div>
        <div className="dialogfoot">
          {preview ? (
            <button type="button" className="btn" onClick={() => setPreview(null)}>
              Volver a editar
            </button>
          ) : (
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
          )}
          <button className="btn primary" disabled={busy || impactBusy}>
            {busy && <LoaderCircle size={16} />}{' '}
            {['shift', 'copy'].includes(editor.kind) && !preview
              ? 'Revisar turnos'
              : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
