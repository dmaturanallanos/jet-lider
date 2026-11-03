'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeMutate } from '@/features/shared/client-mutation';
import type { Row } from '@/types/database';
import { localInput, today } from '@/utils/dates';
export const attendanceLabels = {
  present: 'Asistió',
  absent: 'No asistió',
  pending: 'Sin registrar',
};
export function Attendance({
  shift,
  record,
  demo,
  notify,
}: {
  shift: Row<'shifts'>;
  record?: Row<'shift_attendance'>;
  demo: boolean;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const router = useRouter();
  const unavailable =
    !shift.worker_id ||
    shift.status === 'cancelled' ||
    localInput(shift.starts_at).slice(0, 10) > today();
  return (
    <section className="stack" aria-label="Asistencia del turno">
      <h3>Asistencia del turno</h3>
      <p>
        <strong>
          {
            attendanceLabels[
              record?.status === 'present'
                ? 'present'
                : record?.status === 'absent'
                  ? 'absent'
                  : 'pending'
            ]
          }
        </strong>
      </p>
      <p className="muted">
        Registro manual por turno. No registra horas reales de entrada o salida ni calcula
        remuneraciones.
      </p>
      {unavailable ? (
        <p className="notice">
          Disponible para turnos asignados, no cancelados y del día actual o anteriores.
        </p>
      ) : (
        <form
          key={record?.version ?? 0}
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (demo) {
              notify('Demostración de solo lectura.');
              return;
            }
            const form = new FormData(e.currentTarget);
            setBusy(true);
            const result = await safeMutate('attendance', {
              shift_id: shift.id,
              status: form.get('status') || null,
              notes: form.get('notes'),
              version: record?.version ?? 0,
            });
            setBusy(false);
            setMessage(result.message);
            notify(result.message);
            if (result.ok) router.refresh();
          }}
        >
          <label>
            Resultado de asistencia
            <select name="status" defaultValue={record?.status ?? ''}>
              <option value="">Sin registrar</option>
              <option value="present">Asistió</option>
              <option value="absent">No asistió</option>
            </select>
          </label>
          <label>
            Nota de asistencia (opcional)
            <textarea name="notes" defaultValue={record?.notes ?? ''} maxLength={1000} />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar asistencia'}
          </button>
          <small className="muted">
            Para corregir o quitar una marca, elige el resultado correcto o «Sin registrar» y
            guarda.
          </small>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
