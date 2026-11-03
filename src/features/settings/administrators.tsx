'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeMutate } from '@/features/shared/client-mutation';
import type { ViewProps } from '@/features/shared/view-props';

export function Administrators({
  data,
  demo,
  notify,
}: Pick<ViewProps, 'data' | 'demo' | 'notify'>) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  return (
    <section className="panel">
      <div className="panelhead">
        <h2>Espacios independientes</h2>
      </div>
      <div className="panelbody stack">
        {(data.administrators ?? [data.profile]).map((p) => (
          <p key={p.id}>
            {p.display_name}
            {p.id === data.profile.id ? ' · Tú' : ''}
          </p>
        ))}
        <p className="muted">
          Este es tu espacio privado. Cada administrador tiene su propio equipo, turnos, tareas y
          bitácora. Los datos no se comparten entre administradores.
        </p>
        <p className="muted">
          Para habilitar otro espacio, crea una cuenta con correo confirmado en Supabase Auth. Debe
          ser una cuenta independiente: las invitaciones de Equipo corresponden a trabajadores de tu
          propio espacio.
        </p>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (demo) {
              notify('Demostración de solo lectura.');
              return;
            }
            const form = e.currentTarget;
            const values = new FormData(form);
            setBusy(true);
            const result = await safeMutate('administrator-add', {
              email: values.get('email'),
              name: values.get('name'),
              confirmed: values.get('confirmed') === 'on',
            });
            setBusy(false);
            setMessage(result.message);
            notify(result.message);
            if (result.ok) {
              form.reset();
              router.refresh();
            }
          }}
        >
          <label>
            Nombre del nuevo administrador
            <input name="name" required minLength={2} maxLength={120} autoComplete="name" />
          </label>
          <label>
            Correo de su cuenta
            <input name="email" type="email" required maxLength={320} autoComplete="email" />
          </label>
          <label className="checklabel">
            <input name="confirmed" type="checkbox" required />
            Confirmo que esta persona tendrá un espacio independiente, sin acceso a mis datos.
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Otorgando acceso…' : 'Agregar administrador'}
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      </div>
    </section>
  );
}
