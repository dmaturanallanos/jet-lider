'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Row } from '@/types/database';
import { safeMutate } from '@/features/shared/client-mutation';
import { workerImpact } from './actions';

export function WorkerState({
  worker,
  demo,
  notify,
}: {
  worker: Row<'workers'>;
  demo: boolean;
  notify: (message: string) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [impact, setImpact] = useState<{ shifts: number; tasks: number } | null>(null);
  const [error, setError] = useState('');
  return (
    <div className="stack">
      {!confirming ? (
        <button
          className="btn"
          onClick={async () => {
            if (demo) {
              notify('Demostración de solo lectura.');
              return;
            }
            setConfirming(true);
            setError('');
            if (worker.active) {
              setBusy(true);
              try {
                setImpact(await workerImpact(worker.id));
              } catch {
                setError('No se pudieron consultar los pendientes. Vuelve a intentar.');
              } finally {
                setBusy(false);
              }
            }
          }}
        >
          {worker.active ? 'Desactivar trabajador' : 'Reactivar trabajador'}
        </button>
      ) : (
        <>
          <p>
            {worker.active
              ? 'Pasará a Inactivos. Se bloquearán su acceso y nuevas asignaciones; conservará su historial. Sus turnos y tareas no se cancelarán.'
              : 'Volverá a Activos y podrá recibir asignaciones y acceder con su cuenta vinculada.'}
          </p>
          {busy && <p role="status">Consultando pendientes…</p>}
          {worker.active && impact && (
            <p>
              {impact.shifts} turnos futuros · {impact.tasks} tareas abiertas. Revisa estos
              pendientes en Turnos y Tareas.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="row wrap">
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setImpact(null);
              }}
            >
              Volver
            </button>
            <button
              className="btn"
              disabled={busy || (worker.active && !impact)}
              onClick={async () => {
                setBusy(true);
                const result = await safeMutate('worker-state', {
                  id: worker.id,
                  version: worker.version,
                  active: !worker.active,
                  acknowledge: true,
                });
                setBusy(false);
                notify(result.message);
                if (result.ok) {
                  setConfirming(false);
                  router.refresh();
                } else setError(result.message);
              }}
            >
              {worker.active ? 'Confirmar desactivación' : 'Confirmar reactivación'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
