import { z } from 'zod';
import { reportRowsSchema } from '@/features/shifts/report-data';
import { localInput } from '@/utils/dates';
export const DAY_NET = 28500,
  OVERTIME_NET = 3166;
export const SII_SOURCE = 'https://www.sii.cl/destacados/boletas_honorarios/index.html';
const entrySchema = z.object({
  worker_id: z.uuid(),
  overtime_minutes: z.number().int(),
  additions: z.number().int(),
  deductions: z.number().int(),
  contract_net: z.number().int().nullable(),
  notes: z.string(),
  version: z.number().int(),
});
export const paymentSourceSchema = z.object({
  workers: z.array(
    z.object({
      id: z.uuid(),
      full_name: z.string(),
      active: z.boolean(),
      employment_type: z.enum(['boleta', 'contrato']).nullable(),
    }),
  ),
  shifts: reportRowsSchema,
  entries: z.array(entrySchema),
  as_of: z.string(),
});
export type PaymentSource = z.infer<typeof paymentSourceSchema>;
export function retentionRate(issueDate: string) {
  if (!z.iso.date().safeParse(issueDate).success) throw new Error('Fecha de emisión inválida.');
  const rate = ({ 2025: 1450, 2026: 1525, 2027: 1600, 2028: 1700 } as Record<number, number>)[
    Number(issueDate.slice(0, 4))
  ];
  if (rate === undefined)
    throw new Error('La tasa SII de ese año debe verificarse antes de generar pagos.');
  return rate;
}
export function grossFromNet(net: number, rate: number) {
  if (
    !Number.isSafeInteger(net) ||
    net < 0 ||
    net > 10000000000 ||
    !Number.isInteger(rate) ||
    rate < 0 ||
    rate >= 10000
  )
    throw new Error('Monto o tasa fuera de rango.');
  const denominator = 10000n - BigInt(rate);
  const gross = (BigInt(net) * 10000n + denominator / 2n) / denominator;
  const withholding = (gross * BigInt(rate) + 5000n) / 10000n;
  if (gross - withholding !== BigInt(net)) throw new Error('Revisa el redondeo del líquido.');
  return { gross: Number(gross), withholding: Number(withholding), net };
}
export function paymentRows(source: PaymentSource, issueDate: string) {
  const rate = retentionRate(issueDate);
  return source.workers.map((worker) => {
    const shifts = source.shifts.filter((s) => s.worker_id === worker.id),
      entry = source.entries.find((e) => e.worker_id === worker.id);
    const attended = shifts.filter(
      (s) => s.shift_status !== 'cancelled' && s.attendance_status === 'present',
    );
    const days = new Set(attended.map((s) => localInput(s.starts_at).slice(0, 10))).size;
    const pending = shifts.filter(
      (s) =>
        s.shift_status !== 'cancelled' &&
        s.attendance_status === null &&
        Date.parse(s.ends_at) <= Date.parse(source.as_of),
    ).length;
    const future = shifts.filter(
      (s) =>
        s.shift_status !== 'cancelled' &&
        s.attendance_status === null &&
        Date.parse(s.ends_at) > Date.parse(source.as_of),
    ).length;
    const overtimeMinutes = entry?.overtime_minutes ?? 0;
    const extraNet =
      worker.employment_type === 'boleta' ? Math.round((overtimeMinutes * OVERTIME_NET) / 60) : 0;
    const base = worker.employment_type === 'boleta' ? days * DAY_NET : (entry?.contract_net ?? 0);
    const net = base + extraNet + (entry?.additions ?? 0) - (entry?.deductions ?? 0);
    const errors: string[] = [];
    const included = shifts.length > 0 || !!entry;
    if (included && !worker.employment_type) errors.push('Define Boleta o Contrato');
    if (included && pending) errors.push(`${pending} turnos terminados sin asistencia`);
    if (included && worker.employment_type === 'contrato' && entry?.contract_net == null)
      errors.push('Ingresa el líquido de contrato');
    if (net < 0) errors.push('Los descuentos superan el líquido');
    if (worker.employment_type === 'contrato' && overtimeMinutes)
      errors.push('Revisa HE: contrato usa un líquido manual');
    const receipt =
      worker.employment_type === 'boleta' && net >= 0 ? grossFromNet(net, rate) : null;
    return {
      worker,
      entry,
      included,
      days,
      pending,
      future,
      overtimeMinutes,
      extraNet,
      base,
      net,
      errors,
      gross: receipt?.gross ?? null,
      withholding: receipt?.withholding ?? null,
      rate,
    };
  });
}
export type PaymentRow = ReturnType<typeof paymentRows>[number];
export const paymentInputSchema = z.object({
  worker_id: z.uuid(),
  week_start: z.iso.date(),
  overtime_minutes: z.number().int().min(0).max(10080),
  additions: z.number().int().min(0).max(1000000000),
  deductions: z.number().int().min(0).max(1000000000),
  contract_net: z.number().int().min(0).max(1000000000).nullable(),
  notes: z.string().max(2000),
  version: z.number().int().min(0),
});
