'use client';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import type { ViewProps } from '@/features/shared/view-props';
import { InstallApplication } from '@/components/pwa';
import { safeMutate as mutate } from '@/features/shared/client-mutation';
import { UploadImage, PrivateImage } from '@/features/shared/files';
import { Administrators } from './administrators';
export function Settings({ data, view, demo, notify }: ViewProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  return (
    <div className="detailgrid">
      <div className="stack">
        {view === 'perfil' && (
          <section className="panel">
            <div className="panelhead">
              <h2>Mi perfil</h2>
            </div>
            <form
              className="panelbody stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (demo) {
                  notify('Demostración de solo lectura.');
                  return;
                }
                const result = await mutate('profile', {
                  display_name: new FormData(e.currentTarget).get('display_name'),
                });
                notify(result.message);
                router.refresh();
              }}
            >
              <label>
                Nombre para mostrar
                <input
                  name="display_name"
                  defaultValue={data.profile.display_name}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
              <p className="muted">
                {data.profile.role === 'admin' ? 'Administrador' : 'Trabajador'} · Correo:{' '}
                {data.contact?.email ?? 'Administrado en tu cuenta de acceso'}
              </p>
              {data.contact?.phone && <p className="muted">Teléfono: {data.contact.phone}</p>}
              <p className="muted" style={{ fontSize: 12 }}>
                Para corregir tus datos laborales o de contacto, solicita el cambio al
                administrador.
              </p>
              <button className="btn primary">Guardar perfil</button>
            </form>
            {data.profile.worker_id && (
              <div className="panelbody stack">
                {data.workers.find((w) => w.id === data.profile.worker_id)?.avatar_path && (
                  <PrivateImage
                    kind="avatar"
                    id={data.profile.worker_id}
                    demo={demo}
                    notify={notify}
                  />
                )}
                <UploadImage
                  kind="avatar"
                  parent={data.profile.worker_id}
                  demo={demo}
                  notify={notify}
                />
              </div>
            )}
          </section>
        )}
        <section className="panel">
          <div className="panelhead">
            <h2>Apariencia</h2>
          </div>
          <div className="panelbody stack">
            <label>
              Tema visual
              <select
                value={theme ?? 'system'}
                suppressHydrationWarning
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="system">Seguir el sistema</option>
                <option value="dark">Oscuro</option>
                <option value="light">Claro</option>
              </select>
            </label>
            <p className="muted" style={{ fontSize: 12 }}>
              La preferencia se conserva en este dispositivo.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panelhead">
            <h2>Configuración operativa</h2>
          </div>
          <div className="panelbody stack">
            <p>
              Zona horaria: <strong>America/Santiago</strong>
            </p>
            <p>Semana: lunes a domingo · formato de 24 horas</p>
            <p className="muted" style={{ fontSize: 12 }}>
              Las duraciones se calculan entre instantes reales y descuentan el descanso. No
              representan asistencia ni remuneraciones.
            </p>
          </div>
        </section>
      </div>
      <div className="stack">
        <InstallApplication />
        {data.profile.role === 'admin' && view === 'configuracion' && (
          <Administrators data={data} demo={demo} notify={notify} />
        )}
        {data.profile.role === 'admin' && view === 'configuracion' && (
          <section className="panel">
            <div className="panelhead">
              <h2>Tipos de turno</h2>
            </div>
            <div className="panelbody stack">
              {data.shiftTypes.map((t) => (
                <p key={t.id}>
                  <span style={{ color: t.color }}>●</span> {t.name}
                </p>
              ))}
              <form
                className="stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (demo) {
                    notify('Demostración de solo lectura.');
                    return;
                  }
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  const r = await mutate('shift-type', {
                    name: f.get('name'),
                    color: f.get('color'),
                  });
                  notify(r.message);
                  if (r.ok) {
                    form.reset();
                    router.refresh();
                  }
                }}
              >
                <label>
                  Nuevo tipo
                  <input name="name" required minLength={2} maxLength={60} />
                </label>
                <label>
                  Color
                  <input name="color" type="color" defaultValue="#00bfff" />
                </label>
                <button className="btn">Agregar tipo</button>
              </form>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
