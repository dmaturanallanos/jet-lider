'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { safeMutate } from '@/features/shared/client-mutation';
import type { Row } from '@/types/database';

export function DeleteShift({
  shift,
  demo,
  notify,
  onDeleted,
}: {
  shift: Row<'shifts'>;
  demo: boolean;
  notify: (message: string) => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    setBusy(true);
    setError('');
    const result = await safeMutate('shift-delete', { id: shift.id, version: shift.version });
    setBusy(false);
    notify(result.message);
    if (result.ok) onDeleted();
    else setError(result.message);
  }
  if (confirming)
    return (
      <div className="stack" style={{ flexBasis: '100%' }}>
        <p>
          ¿Eliminar este turno del calendario? Esta acción afecta solo a esta ocurrencia y conserva
          el historial. Para mantenerlo visible, utiliza Cancelar en la edición.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="row wrap">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            Volver
          </button>
          <button type="button" className="btn danger" disabled={busy} onClick={remove}>
            {busy ? 'Eliminando…' : 'Confirmar eliminación'}
          </button>
        </div>
      </div>
    );
  return (
    <button
      type="button"
      className="btn danger"
      onClick={() => {
        if (demo) notify('Demostración de solo lectura.');
        else setConfirming(true);
      }}
    >
      <Trash2 size={16} /> Eliminar turno
    </button>
  );
}
