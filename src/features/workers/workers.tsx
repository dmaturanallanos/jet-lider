'use client';
import { useState } from 'react';
import Link from 'next/link';
import { UserPlus, Mail, Search, ArrowUpRight } from 'lucide-react';
import type { ViewProps } from '@/features/shared/view-props';
import { Avatar, Badge, Empty, Status } from '@/components/ui/primitives';
import { safeMutate as mutate } from '@/features/shared/client-mutation';
export function Workers({ data, params, link, edit, demo, notify }: ViewProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const q = (params.q ?? '').toLowerCase();
  const workers = data.workers.filter(
    (w) =>
      `${w.full_name} ${w.nickname ?? ''} ${w.job_title ?? ''}`.toLowerCase().includes(q) &&
      (!params.active || (params.active === 'true') === w.active),
  );
  return (
    <>
      <form className="filters">
        <Search size={18} className="muted" style={{ alignSelf: 'center' }} />
        <input
          name="q"
          aria-label="Buscar trabajador"
          placeholder="Nombre, apodo o función…"
          defaultValue={params.q}
        />
        <select name="active" aria-label="Estado del trabajador" defaultValue={params.active ?? ''}>
          <option value="">Todos los trabajadores</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <button className="btn">Buscar</button>
      </form>
      <div className="teamgrid">
        {workers.map((w) => {
          const p = data.privateDetails.find((p) => p.id === w.id),
            invite = data.invitations.find((i) => i.worker_id === w.id);
          return (
            <section className="panel teamcard" key={w.id}>
              <div className="row spread">
                <Avatar name={w.full_name} color={w.color} />
                <Badge tone={w.active ? 'green' : ''}>{w.active ? 'Activo' : 'Inactivo'}</Badge>
              </div>
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
            </section>
          );
        })}
      </div>
      {!workers.length && (
        <section className="panel">
          <Empty title="No hay trabajadores en esta consulta">
            Puedes registrar a una persona solo con su nombre. La cuenta de acceso se habilita
            después.
          </Empty>
        </section>
      )}
    </>
  );
}
