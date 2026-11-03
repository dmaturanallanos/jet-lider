'use client';
import { useState } from 'react';
import { safeMutate } from './client-mutation';
export function DeleteRecord({
  kind,
  id,
  version,
  label,
  description,
  demo,
  notify,
  onDeleted,
}: {
  kind: 'task' | 'entry' | 'comment' | 'worker';
  id: string;
  version: number;
  label: string;
  description: string;
  demo: boolean;
  notify: (message: string) => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="stack">
      {confirming ? (
        <>
          <p>{description} La eliminación conserva un registro en el historial.</p>
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
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                const result = await safeMutate('delete-record', { kind, id, version });
                setBusy(false);
                notify(result.message);
                if (result.ok) onDeleted();
                else setError(result.message);
              }}
            >
              {busy ? 'Eliminando…' : 'Confirmar eliminación'}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="btn danger"
          onClick={() => (demo ? notify('Demostración de solo lectura.') : setConfirming(true))}
        >
          {label}
        </button>
      )}
    </div>
  );
}
