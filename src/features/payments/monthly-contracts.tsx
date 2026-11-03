'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ViewProps } from '@/features/shared/view-props';
import { Modal, Empty, Badge } from '@/components/ui/primitives';
import { safeMutate } from '@/features/shared/client-mutation';
import { dateLabel } from '@/utils/dates';
import {
  CONTRACT_ADVANCE,
  monthStart,
  moveMonth,
  monthlyRows,
  monthlyTotals,
} from './monthly-calculations';
const money = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
export function MonthlyContracts({ data, date, link, demo, notify }: ViewProps) {
  const month = monthStart(date),
    router = useRouter(),
    source = data.contractPayments;
  const rows = source ? monthlyRows(source) : [],
    totals = source ? monthlyTotals(source) : { salary: 0, advance: 0, balance: 0, pending: 0 };
  const [selected, setSelected] = useState<(typeof rows)[number] | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function download() {
    if (demo) {
      notify('Demostración de solo lectura. El Excel real usa tus sueldos mensuales guardados.');
      return;
    }
    if (!navigator.onLine) {
      notify('Necesitas conexión para descargar los contratos.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/reports/contracts?month=${month}`, { cache: 'no-store' });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(typeof e.error === 'string' ? e.error : 'No se pudo descargar');
      }
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement('a');
      a.href = url;
      a.download = `jet-contratos-${month.slice(0, 7)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Excel mensual generado. El anticipo forma parte del sueldo, no se sumó dos veces.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo descargar');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <div className="row wrap">
          <Link
            className="btn"
            href={link('pagos', { payPeriod: 'monthly', date: moveMonth(month, -1) })}
          >
            Mes anterior
          </Link>
          <strong>{dateLabel(month, { month: 'long', year: 'numeric' })}</strong>
          <Link
            className="btn"
            href={link('pagos', { payPeriod: 'monthly', date: moveMonth(month, 1) })}
          >
            Mes siguiente
          </Link>
        </div>
      </div>
      <section className="panel panelbody stack">
        <h2>Contratos · sueldo mensual y anticipo</h2>
        <div className="row wrap">
          <Badge>
            {totals.pending ? 'Subtotal de sueldos revisados' : 'Sueldos líquidos del mes'}:{' '}
            {money(totals.salary)}
          </Badge>
          <Badge>Anticipos incluidos: {money(totals.advance)}</Badge>
          <Badge>Saldo por pagar: {money(totals.balance)}</Badge>
        </div>
        <p>
          Anticipo fijo: <strong>{money(CONTRACT_ADVANCE)} líquidos por persona</strong>, una sola
          vez por mes. Saldo = sueldo líquido − anticipo.
        </p>
        <p className="notice">
          El anticipo ya es parte del sueldo mensual. Estos son montos planificados, no
          transferencias realizadas. El total muestra líquidos informados e incluye las HE que
          incorpores manualmente al sueldo; no calcula cotizaciones ni costo laboral completo.
        </p>
        {!!totals.pending && (
          <p role="status">
            Subtotal revisado: {totals.pending} personas aún sin sueldo mensual completo. El Excel
            se habilita al completar sus datos.
          </p>
        )}
        <button className="btn primary" disabled={busy || totals.pending > 0} onClick={download}>
          {busy ? 'Generando…' : 'Excel mensual de contratos'}
        </button>
      </section>
      <div className="stack" style={{ marginTop: 20 }}>
        {rows.map((row) => (
          <section className="panel panelbody stack" key={row.worker.id}>
            <h2>{row.worker.full_name}</h2>
            <div className="row wrap">
              <span>
                Sueldo: <strong>{row.salary === null ? 'Pendiente' : money(row.salary)}</strong>
              </span>
              <span>Anticipo fijo: {money(row.advance)}</span>
              <span>
                Saldo: <strong>{row.balance === null ? 'Pendiente' : money(row.balance)}</strong>
              </span>
            </div>
            {row.errors.length > 0 && <p className="notice">{row.errors.join(' · ')}</p>}
            <button
              className="btn"
              onClick={() => {
                setSelected(row);
                setMessage('');
              }}
            >
              Ingresar sueldo mensual
            </button>
          </section>
        ))}
      </div>
      {!rows.length && (
        <Empty title="No hay trabajadores con contrato en este mes">
          Selecciona Contrato en la ficha del trabajador para preparar su sueldo mensual.
        </Empty>
      )}
      {selected && (
        <Modal
          title={`Sueldo mensual de ${selected.worker.full_name}`}
          onClose={() => setSelected(null)}
        >
          <form
            className="dialogbody stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (demo) {
                notify('Demostración de solo lectura.');
                return;
              }
              const f = new FormData(e.currentTarget);
              setBusy(true);
              const result = await safeMutate('contract-month-save', {
                worker_id: selected.worker.id,
                month_start: month,
                salary_net: Number(f.get('salary_net')),
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
              {dateLabel(month, { month: 'long', year: 'numeric' })} · Anticipo fijo de{' '}
              {money(CONTRACT_ADVANCE)} incluido en el sueldo.
            </p>
            <label>
              Sueldo líquido total del mes (CLP, incluye HE)
              <input
                name="salary_net"
                type="number"
                min={CONTRACT_ADVANCE}
                max={1000000000}
                step={1}
                required
                defaultValue={selected.salary ?? ''}
              />
            </label>
            <label>
              Detalle del sueldo y ajustes
              <textarea name="notes" defaultValue={selected.entry?.notes ?? ''} maxLength={2000} />
            </label>
            <small className="muted">
              Ingresa el sueldo completo, sin restar el anticipo: la aplicación lo descontará una
              sola vez. Si el sueldo es menor que el anticipo fijo, hay que revisar esa situación
              antes de preparar el pago.
            </small>
            {message && <p role="status">{message}</p>}
            <button className="btn primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar sueldo mensual'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
