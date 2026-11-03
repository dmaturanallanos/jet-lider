'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal, Badge, Empty } from '@/components/ui/primitives';
import type { ViewProps } from '@/features/shared/view-props';
import { safeMutate } from '@/features/shared/client-mutation';
import { addDays, dateLabel, monday, today } from '@/utils/dates';
import { DAY_NET, OVERTIME_NET, SII_SOURCE, paymentRows, type PaymentRow } from './calculations';
const money = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
export function Payments({ data, date, demo, notify, link }: ViewProps) {
  const start = monday(date),
    router = useRouter();
  const [issueDate, setIssueDate] = useState(today()),
    [selected, setSelected] = useState<PaymentRow | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const calculated = useMemo(() => {
    try {
      return { rows: data.payments ? paymentRows(data.payments, issueDate) : [], error: '' };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : 'Fecha no válida' };
    }
  }, [data.payments, issueDate]);
  const rows = calculated.rows.filter((r) => r.worker.active || r.included);
  async function download() {
    if (demo) {
      notify('Demostración. Los pagos reales se calculan solo con tus registros guardados.');
      return;
    }
    if (!navigator.onLine) {
      notify('Necesitas conexión para descargar pagos.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/reports/payments?week=${start}&issueDate=${issueDate}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          typeof error.error === 'string' ? error.error : 'No se pudo generar el Excel.',
        );
      }
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement('a');
      a.href = url;
      a.download = `jet-pagos-${start}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(
        'Excel generado desde los datos guardados. No se emitieron boletas ni se hicieron transferencias.',
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo descargar el Excel.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <div className="row wrap">
          <Link className="btn" href={link('pagos', { date: addDays(start, -7) })}>
            Semana anterior
          </Link>
          <strong>
            {dateLabel(start)} — {dateLabel(addDays(start, 6))}
          </strong>
          <Link className="btn" href={link('pagos', { date: addDays(start, 7) })}>
            Semana siguiente
          </Link>
        </div>
      </div>
      <section className="panel panelbody stack">
        <div className="row wrap">
          <label>
            Fecha de emisión de boletas
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy || !!calculated.error} onClick={download}>
            {busy ? 'Generando…' : 'Excel detallado de pagos'}
          </button>
        </div>
        <p>
          Boleta: <strong>{money(DAY_NET)} líquidos por día</strong> y{' '}
          <strong>{money(OVERTIME_NET)} líquidos por hora extra</strong>. Las horas extra se
          ingresan manualmente.
        </p>
        <p className="muted">
          Un día se cuenta una sola vez, aunque tenga varios turnos, y solo si existe asistencia
          «Asistió». Los contratos usan un líquido manual que ya debe incluir sus horas extra.
        </p>
        <p className="muted">
          Retención del receptor:{' '}
          {rows[0] ? `${(rows[0].rate / 100).toLocaleString('es-CL')} %` : 'según fecha de emisión'}
          . Bruto de boleta = líquido ÷ (1 − tasa).{' '}
          <a className="link" href={SII_SOURCE} target="_blank" rel="noreferrer">
            Ver tasa SII
          </a>
        </p>
        <p className="notice">
          Preparación de pagos: no emite boletas, no realiza transferencias y no calcula una
          liquidación laboral. El Excel usa datos guardados y bloquea pagos con turnos terminados
          sin registrar asistencia.
        </p>
        {calculated.error && <p role="alert">{calculated.error}</p>}
      </section>
      <div className="stack" style={{ marginTop: 20 }}>
        {rows.map((row) => (
          <section className="panel panelbody stack" key={row.worker.id}>
            <div className="row spread wrap">
              <h2>{row.worker.full_name}</h2>
              <Badge>
                {row.worker.employment_type === 'boleta'
                  ? 'Boleta'
                  : row.worker.employment_type === 'contrato'
                    ? 'Contrato'
                    : 'Sin modalidad'}
              </Badge>
            </div>
            <p>
              {row.days} días con asistencia · {row.overtimeMinutes / 60} h extra ingresadas ·{' '}
              {row.future} turnos en curso/futuros sin marca
            </p>
            <div className="row wrap">
              <span>
                {row.errors.length ? 'Líquido a revisar' : 'Líquido'}:{' '}
                <strong>{money(row.net)}</strong>
              </span>
              {row.gross !== null && row.net > 0 && (
                <>
                  <span>Retención: {money(row.withholding ?? 0)}</span>
                  <span>
                    {row.errors.length ? 'Bruto calculado (pendiente)' : 'Boleta por'}:{' '}
                    <strong>{money(row.gross)}</strong>
                  </span>
                </>
              )}
            </div>
            {!row.included && (
              <p className="muted">
                Sin turnos ni datos de pago en esta semana. No se incluye en el Excel hasta preparar
                un pago.
              </p>
            )}
            {!!row.errors.length && <p className="notice">Pendiente: {row.errors.join(' · ')}</p>}
            <div className="row wrap">
              <button
                className="btn"
                disabled={!row.worker.employment_type}
                onClick={() => {
                  setSelected(row);
                  setMessage('');
                }}
              >
                Preparar pago
              </button>
              <Link className="link" href={link('equipo', { detail: row.worker.id })}>
                Ficha y modalidad
              </Link>
            </div>
          </section>
        ))}
      </div>
      {!rows.length && !calculated.error && (
        <Empty title="No hay trabajadores para preparar pagos" />
      )}
      {selected && (
        <Modal title={`Pago de ${selected.worker.full_name}`} onClose={() => setSelected(null)}>
          <form
            className="dialogbody stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (demo) {
                notify('Demostración de solo lectura.');
                return;
              }
              const f = new FormData(e.currentTarget),
                contract = selected.worker.employment_type === 'contrato';
              setBusy(true);
              const result = await safeMutate('payment-save', {
                worker_id: selected.worker.id,
                week_start: start,
                overtime_minutes: contract
                  ? 0
                  : Number(f.get('hours') || 0) * 60 + Number(f.get('minutes') || 0),
                additions: Number(f.get('additions') || 0),
                deductions: Number(f.get('deductions') || 0),
                contract_net:
                  contract && String(f.get('contract_net') ?? '').trim() !== ''
                    ? Number(f.get('contract_net'))
                    : null,
                notes: String(f.get('notes') ?? ''),
                version: selected.entry?.version ?? 0,
              });
              setBusy(false);
              setMessage(result.message);
              notify(result.message);
              if (result.ok) {
                setSelected(null);
                router.refresh();
              }
            }}
          >
            <p>
              Días confirmados: {selected.days}. {selected.pending} turnos terminados pendientes de
              asistencia.
            </p>
            {selected.worker.employment_type === 'boleta' ? (
              <div className="row wrap">
                <label>
                  Horas extra completas
                  <input
                    type="number"
                    name="hours"
                    min={0}
                    max={168}
                    step={1}
                    defaultValue={Math.floor(selected.overtimeMinutes / 60)}
                  />
                </label>
                <label>
                  Minutos extra
                  <input
                    type="number"
                    name="minutes"
                    min={0}
                    max={59}
                    step={1}
                    defaultValue={selected.overtimeMinutes % 60}
                  />
                </label>
              </div>
            ) : (
              <label>
                Líquido de contrato informado (CLP, incluye sus HE)
                <input
                  type="number"
                  name="contract_net"
                  min={0}
                  max={1000000000}
                  step={1}
                  defaultValue={selected.entry?.contract_net ?? ''}
                />
              </label>
            )}
            <label>
              Otros honorarios / adicionales líquidos (CLP)
              <input
                type="number"
                name="additions"
                min={0}
                max={1000000000}
                step={1}
                defaultValue={selected.entry?.additions ?? 0}
              />
            </label>
            <label>
              Rebaja del monto pactado (CLP, no anticipos)
              <input
                type="number"
                name="deductions"
                min={0}
                max={1000000000}
                step={1}
                defaultValue={selected.entry?.deductions ?? 0}
              />
            </label>
            <label>
              Detalle de horas extra y ajustes
              <textarea name="notes" maxLength={2000} defaultValue={selected.entry?.notes ?? ''} />
            </label>
            <small className="muted">
              Los adicionales y rebajas de boleta modifican el honorario líquido pactado. No
              ingreses anticipos ni reembolsos en estos campos; no se compensan automáticamente en
              esta versión.
            </small>
            {message && <p role="status">{message}</p>}
            <button className="btn primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar preparación de pago'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
