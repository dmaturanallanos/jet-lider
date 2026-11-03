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
        <h2>Administradores</h2>
      </div>
      <div className="panelbody stack">
        {(data.administrators ?? [data.profile]).map((p) => (
          <p key={p.id}>
            {p.display_name}
            {p.id === data.profile.id ? ' · Tú' : ''}
          </p>
        ))}
        <p className="muted">
          Los administradores pueden gestionar todo el equipo, los turnos, las tareas y los datos
          privados. Otorga acceso solo a personas de confianza.
        </p>
        <p className="muted">
          La cuenta debe existir y tener el correo confirmado. Si aún no tiene acceso, regístrala e
          invítala desde Equipo; después podrás promoverla aquí.
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
            Confirmo que esta persona tendrá acceso completo de administrador.
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
