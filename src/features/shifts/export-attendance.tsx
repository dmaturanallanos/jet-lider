'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { monday } from '@/utils/dates';
export function ExportAttendance({
  date,
  demo,
  notify,
}: {
  date: string;
  demo: boolean;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      disabled={busy}
      onClick={async () => {
        if (demo) {
          notify(
            'Demostración de solo lectura. El Excel se descarga con los datos reales de tu espacio.',
          );
          return;
        }
        if (!navigator.onLine) {
          notify('Necesitas conexión para descargar los datos guardados.');
          return;
        }
        setBusy(true);
        try {
          const start = monday(date),
            response = await fetch(`/api/reports/attendance?week=${start}`, { cache: 'no-store' });
          if (!response.ok) {
            const result = await response.json();
            throw new Error(
              typeof result.error === 'string' ? result.error : 'No se pudo descargar el informe.',
            );
          }
          const blob = await response.blob(),
            url = URL.createObjectURL(blob),
            a = document.createElement('a');
          a.href = url;
          a.download = `jet-asistencia-${start}.xlsx`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          notify(
            'Excel semanal descargado. Incluye toda la semana de tu espacio, sin aplicar los filtros de pantalla.',
          );
        } catch (e) {
          notify(e instanceof Error ? e.message : 'No se pudo descargar el informe.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download size={16} />
      {busy ? 'Generando Excel…' : 'Excel semanal de asistencia'}
    </button>
  );
}
