'use client';
import Link from 'next/link';
import type { ViewProps } from '@/features/shared/view-props';
import { WeeklyPayments } from './payments';
import { MonthlyContracts } from './monthly-contracts';
export function Payments(props: ViewProps) {
  const monthly = props.params.payPeriod === 'monthly';
  return (
    <>
      <div className="segmented" style={{ marginBottom: 20 }}>
        <Link
          className={!monthly ? 'selected' : ''}
          href={props.link('pagos', { payPeriod: 'weekly' })}
        >
          Boletas · semanal
        </Link>
        <Link
          className={monthly ? 'selected' : ''}
          href={props.link('pagos', { payPeriod: 'monthly' })}
        >
          Contratos · mensual
        </Link>
      </div>
      {props.data.payments?.entries.some((e) => e.contract_net !== null) && (
        <p className="notice">
          Existen preparaciones semanales antiguas de contrato. Se conservan para revisión, pero no
          se suman al sueldo mensual ni se copian automáticamente. Registra el monto mensual
          correcto en Contratos.
        </p>
      )}
      {monthly ? <MonthlyContracts {...props} /> : <WeeklyPayments {...props} />}
    </>
  );
}
