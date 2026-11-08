'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Mail, Search, ArrowUpRight } from 'lucide-react';
import type { ViewProps } from '@/features/shared/view-props';
import { Avatar, Badge, Empty, Status } from '@/components/ui/primitives';
import { safeMutate as mutate } from '@/features/shared/client-mutation';
import { DeleteRecord } from '@/features/shared/delete-record';
import { WorkerState } from './worker-state';
export function Workers({ data, params, link, edit, demo, notify }: ViewProps) {
  const router = useRouter();
  const active = params.active !== 'false';
  const [busy, setBusy] = useState<string | null>(null);
  const q = (params.q ?? '').toLowerCase();
  const workers = data.workers.filter(
    (w) =>
      `${w.full_name} ${w.nickname ?? ''} ${w.job_title ?? ''}`.toLowerCase().includes(q) &&
      active === w.active,
  );
  return (
    <>
      <nav className="segmented" aria-label="Estado del equipo" style={{ marginBottom: 20 }}>
        <Link
          className={active ? 'selected' : ''}
          aria-current={active ? 'page' : undefined}
          href={link('equipo', { active: 'true', page: '', detail: '' })}
        >
          Activos
        </Link>
        <Link
          className={!active ? 'selected' : ''}
          aria-current={!active ? 'page' : undefined}
          href={link('equipo', { active: 'false', page: '', detail: '' })}
        >
          Inactivos
        </Link>
      </nav>
      <p className="muted" style={{ marginBottom: 16 }}>
        {active
          ? 'Equipo disponible para nuevas asignaciones. Las personas desactivadas están en Inactivos.'
          : 'Trabajadores desactivados. Conservan su historial y puedes reactivarlos cuando regresen.'}
      </p>
      <form className="filters">
        <input type="hidden" name="active" value={String(active)} />
        <Search size={18} className="muted" style={{ alignSelf: 'center' }} />
        <input
          name="q"
          aria-label="Buscar trabajador"
          placeholder="Nombre, apodo o función…"
          defaultValue={params.q}
        />
        <button className="btn">Buscar</button>
      </form>
      <div className="teamgrid">
        {workers.map((w) => {
          const p = data.privateDetails.find((p) => p.id === w.id),
            invite = data.invitations.find((i) => i.worker_id === w.id);
          return (
            <section className="panel teamcard" key={w.id} aria-label={w.full_name}>
              <div className="row spread">
                <Avatar name={w.full_name} color={w.color} />
                <Badge tone={w.active ? 'green' : ''}>{w.active ? 'Activo' : 'Inactivo'}</Badge>
              </div>
              <Badge>
                {p?.employment_type === 'boleta'
                  ? 'Boleta de honorarios'
                  : p?.employment_type === 'contrato'
                    ? 'Contrato'
                    : 'Modalidad sin definir'}
              </Badge>
              <div>
                <h2>{w.full_name}</h2>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {w.job_title || 'Función sin definir'}
                </p>
              </div>
              <div className="row muted" style={{ fontSize: 11 }}>
                <Mail size={14} />
                {p?.email || 'Sin correo · perfil sin cuenta'}
              </div>
              <div className="row spread">
                <span className="muted" style={{ fontSize: 11 }}>
                  Acceso
                </span>
                {invite ? <Status value={invite.status} /> : <Badge>Sin invitación</Badge>}
              </div>
              <div className="row">
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => edit({ kind: 'worker', record: w })}
                >
                  Editar ficha
                </button>
                <Link
                  className="iconbtn"
                  href={link('equipo', { detail: w.id })}
                  aria-label={`Historial de ${w.full_name}`}
                >
                  <ArrowUpRight />
                </Link>
                <button
                  className="iconbtn"
                  disabled={busy === w.id || !w.active}
                  aria-label={`Invitar o reenviar acceso a ${w.full_name}`}
                  onClick={async () => {
                    if (demo) {
                      notify('Demostración de solo lectura.');
                      return;
                    }
                    setBusy(w.id);
                    const r = await mutate('invite', { worker_id: w.id });
                    notify(r.message);
                    setBusy(null);
                  }}
                >
                  <UserPlus size={16} />
                </button>
              </div>
              <WorkerState worker={w} demo={demo} notify={notify} />
              <DeleteRecord
                kind="worker"
                id={w.id}
                version={w.version}
                label="Eliminar trabajador"
                description={`Se eliminará la ficha de ${w.full_name} y sus datos privados. Si tiene cuenta vinculada, turnos, tareas, ausencias o pagos asociados, utiliza Desactivar para conservar su historial.`}
                demo={demo}
                notify={notify}
                onDeleted={() => router.refresh()}
              />
            </section>
          );
        })}
      </div>
      {!workers.length && (
        <section className="panel">
          <Empty
            title={
              active
                ? 'No hay trabajadores activos en esta consulta'
                : 'No hay trabajadores inactivos en esta consulta'
            }
          >
            {active
              ? 'Puedes registrar a una persona solo con su nombre o reactivarla desde Inactivos.'
              : 'Las personas que desactives aparecerán aquí, separadas del equipo activo.'}
          </Empty>
        </section>
      )}
    </>
  );
}
