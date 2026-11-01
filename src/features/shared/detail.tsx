'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { canManage } from '@/lib/permissions';
import type { ViewProps } from './view-props';
import { Modal, Status, Badge } from '@/components/ui/primitives';
import { clock, dateLabel } from '@/utils/dates';
import { safeMutate as mutate } from './client-mutation';
import { PrivateImage, UploadImage } from './files';
export function Detail(props: ViewProps & { onClose: () => void }) {
  const { data, params, view, demo, notify, edit, onClose } = props;
  const admin = canManage(data.profile.role);
  const task = view === 'tareas' ? data.tasks.find((t) => t.id === params.detail) : undefined;
  const entry = view === 'bitacora' ? data.entries.find((e) => e.id === params.detail) : undefined;
  const worker = view === 'equipo' ? data.workers.find((w) => w.id === params.detail) : undefined;
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const privateData = data.privateDetails.find((p) => p.id === worker?.id);
  async function run(action: string, input: unknown) {
    if (demo) {
      notify('Demostración de solo lectura.');
      return false;
    }
    if (!navigator.onLine) {
      notify('Sin conexión. No se guardaron cambios.');
      return false;
    }
    setBusy(true);
    const r = await mutate(action, input);
    notify(r.message);
    router.refresh();
    setBusy(false);
    return r.ok;
  }
  return (
    <Modal
      title={task?.title ?? entry?.title ?? worker?.full_name ?? 'Detalle no disponible'}
      onClose={onClose}
    >
      <div className="dialogbody stack">
        {!task && !entry && !worker && (
          <p className="muted">
            El registro no está en esta página o no tienes permiso. Ajusta los filtros y vuelve a
            consultarlo.
          </p>
        )}
        {task && (
          <>
            <div className="row wrap">
              <Status value={task.status} />
              <Status value={task.priority} />
              {task.due_at && (
                <Badge>
                  Vence {dateLabel(task.due_at)} · {clock(task.due_at)}
                </Badge>
              )}
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{task.description || 'Sin descripción'}</p>
            <p className="muted">
              Responsables:{' '}
              {data.assignees
                .filter((a) => a.task_id === task.id)
                .map((a) => data.workers.find((w) => w.id === a.worker_id)?.full_name)
                .join(', ') || 'Sin asignar'}
            </p>
            {task.location && <p className="muted">Lugar: {task.location}</p>}
            {task.completed_at && (
              <p className="muted">
                Completada el {dateLabel(task.completed_at)} · {clock(task.completed_at)} · Usuario{' '}
                {task.completed_by}
              </p>
            )}
            <div className="row wrap">
              {admin ? (
                <button
                  className="btn"
                  onClick={() => {
                    onClose();
                    edit({ kind: 'task', record: task });
                  }}
                >
                  Editar tarea
                </button>
              ) : (
                !['completed', 'cancelled'].includes(task.status) && (
                  <>
                    {task.status === 'pending' && (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void run('task-status', {
                            id: task.id,
                            version: task.version,
                            status: 'in_progress',
                          })
                        }
                      >
                        Comenzar tarea
                      </button>
                    )}
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={() =>
                        void run('task-status', {
                          id: task.id,
                          version: task.version,
                          status: 'completed',
                        })
                      }
                    >
                      Marcar completada
                    </button>
                  </>
                )
              )}
            </div>
            <hr style={{ borderColor: 'var(--line)' }} />
            <h2>Comentarios</h2>
            {data.comments.map((c) => (
              <div className="notice" key={c.id}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{c.body}</p>
                <small className="muted">
                  {data.authors.find((a) => a.user_id === c.created_by)?.name ?? 'Responsable'} ·{' '}
                  {dateLabel(c.created_at)} · {clock(c.created_at)}
                </small>
              </div>
            ))}
            {!data.comments.length && <p className="muted">Todavía no hay comentarios.</p>}
            <div className="row">
              <a
                className="link"
                href={props.link(view, {
                  commentsPage: String(Math.max(0, Number(params.commentsPage ?? 0) - 1)),
                })}
              >
                Comentarios anteriores
              </a>
              {data.comments.length === 50 && (
                <a
                  className="link"
                  href={props.link(view, {
                    commentsPage: String(Number(params.commentsPage ?? 0) + 1),
                  })}
                >
                  Comentarios siguientes
                </a>
              )}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const body = String(new FormData(form).get('body'));
                const saved = await run('comment', { task_id: task.id, body });
                if (saved) form.reset();
              }}
              className="stack"
            >
              <label>
                Agregar comentario
                <textarea name="body" required maxLength={5000} />
              </label>
              <button className="btn" disabled={busy}>
                Publicar comentario
              </button>
            </form>
            <h2>Evidencias</h2>
            <UploadImage kind="task" parent={task.id} demo={demo} notify={notify} />
            <div className="photogrid">
              {data.taskFiles.map((f) => (
                <PrivateImage
                  key={f.id}
                  kind="task"
                  id={f.id}
                  canDelete={admin || f.created_by === data.profile.id}
                  demo={demo}
                  notify={notify}
                />
              ))}
            </div>
          </>
        )}
        {entry && (
          <>
            <div className="row wrap">
              <Badge tone="blue">{entry.type}</Badge>
              <Badge>
                {entry.period === 'week' ? 'Semana' : 'Día'} del {dateLabel(entry.entry_date)}
              </Badge>
              <Badge tone={entry.visibility === 'admin' ? 'red' : 'green'}>
                {entry.visibility === 'admin' ? 'Solo administrador' : 'Equipo'}
              </Badge>
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{entry.description}</p>
            <p className="muted">
              Autor:{' '}
              {data.authors.find((a) => a.user_id === entry.created_by)?.name ??
                'Integrante del equipo'}{' '}
              · {dateLabel(entry.created_at)} · {clock(entry.created_at)}
            </p>
            {entry.worker_id && (
              <p>Trabajador: {data.workers.find((w) => w.id === entry.worker_id)?.full_name}</p>
            )}
            {entry.task_id && (
              <p>
                Tarea:{' '}
                {data.tasks.find((t) => t.id === entry.task_id)?.title ?? 'Referencia sin acceso'}
              </p>
            )}
            {entry.shift_id && (
              <p>
                Turno:{' '}
                {data.shifts.find((s) => s.id === entry.shift_id)?.starts_at
                  ? dateLabel(data.shifts.find((s) => s.id === entry.shift_id)!.starts_at)
                  : 'Fuera del período visible'}
              </p>
            )}
            {(admin || entry.created_by === data.profile.id) && (
              <button
                className="btn"
                onClick={() => {
                  onClose();
                  edit({ kind: 'entry', record: entry });
                }}
              >
                Editar registro
              </button>
            )}
            <h2>Fotografías</h2>
            <UploadImage kind="entry" parent={entry.id} demo={demo} notify={notify} />
            <div className="photogrid">
              {data.entryFiles.map((f) => (
                <PrivateImage
                  key={f.id}
                  kind="entry"
                  id={f.id}
                  canDelete={admin || f.created_by === data.profile.id}
                  demo={demo}
                  notify={notify}
                />
              ))}
            </div>
          </>
        )}
        {worker && (
          <>
            <Badge tone={worker.active ? 'green' : ''}>
              {worker.active ? 'Activo' : 'Inactivo'}
            </Badge>
            <p>{worker.job_title || 'Sin cargo definido'}</p>
            <p>Correo: {privateData?.email || 'Sin registrar'}</p>
            <p>Teléfono: {privateData?.phone || 'Sin registrar'}</p>
            <div className="notice">Notas privadas: {privateData?.notes || 'Sin notas'}</div>
            {worker.avatar_path && (
              <PrivateImage kind="avatar" id={worker.id} demo={demo} notify={notify} />
            )}
            <UploadImage kind="avatar" parent={worker.id} demo={demo} notify={notify} />
            <button
              className="btn"
              onClick={() => {
                onClose();
                edit({ kind: 'worker', record: worker });
              }}
            >
              Editar trabajador
            </button>
            <a className="link" href={props.link('turnos', { worker: worker.id })}>
              Consultar turnos →
            </a>
            <a className="link" href={props.link('tareas', { taskWorker: worker.id })}>
              Consultar tareas →
            </a>
          </>
        )}
        {admin && (
          <>
            <h2>Historial de cambios</h2>
            {data.detailHistory.map((a) => (
              <div className="notice" key={a.id}>
                <strong>
                  {a.action === 'INSERT'
                    ? 'Creación'
                    : a.action === 'UPDATE'
                      ? 'Actualización'
                      : 'Eliminación'}{' '}
                  · {dateLabel(a.created_at)} · {clock(a.created_at)}
                </strong>
                <p className="muted">Actor: {a.actor_id ?? 'Proceso del servidor'}</p>
                <details>
                  <summary className="link">Ver valores registrados</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
                    Antes: {JSON.stringify(a.before_data, null, 2)}
                    {'\n'}Después: {JSON.stringify(a.after_data, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
            {!data.detailHistory.length && (
              <p className="muted">Sin cambios en esta página del historial.</p>
            )}
            <div className="row">
              <a
                className="link"
                href={props.link(view, { page: String(Math.max(0, Number(params.page ?? 0) - 1)) })}
              >
                Anterior
              </a>
              <a
                className="link"
                href={props.link(view, { page: String(Number(params.page ?? 0) + 1) })}
              >
                Siguiente página de historial
              </a>
            </div>
          </>
        )}
      </div>
      <div className="dialogfoot">
        <button className="btn" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
