import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
export const CONTRACT_ADVANCE = 200000;
export const monthStart = (date: string) =>
  Temporal.PlainDate.from(date).with({ day: 1 }).toString();
export const moveMonth = (date: string, offset: number) =>
  Temporal.PlainDate.from(monthStart(date)).add({ months: offset }).toString();
export const monthlySourceSchema = z.object({
  workers: z.array(z.object({ id: z.uuid(), full_name: z.string(), active: z.boolean() })),
  entries: z.array(
    z.object({
      worker_id: z.uuid(),
      salary_net: z.number().int(),
      advance_net: z.number().int(),
      notes: z.string(),
      version: z.number().int(),
    }),
  ),
  as_of: z.string(),
});
export type MonthlySource = z.infer<typeof monthlySourceSchema>;
export function monthlyRows(source: MonthlySource) {
  return source.workers.map((worker) => {
    const entry = source.entries.find((e) => e.worker_id === worker.id),
      salary = entry?.salary_net ?? null,
      advance = entry?.advance_net ?? CONTRACT_ADVANCE;
    const errors: string[] = [];
    if (salary === null) errors.push('Ingresa el sueldo líquido del mes');
    if (salary !== null && salary < advance) errors.push('El anticipo supera el sueldo líquido');
    return {
      worker,
      entry,
      salary,
      advance,
      balance: salary === null ? null : salary - advance,
      errors,
    };
  });
}
export const monthlyInputSchema = z.object({
  worker_id: z.uuid(),
  month_start: z.iso.date(),
  salary_net: z.number().int().min(CONTRACT_ADVANCE).max(1000000000),
  notes: z.string().max(2000),
  version: z.number().int().min(0),
});
export function monthlyTotals(source: MonthlySource) {
  const rows = monthlyRows(source),
    ready = rows.filter((r) => !r.errors.length);
  return {
    salary: ready.reduce((n, r) => n + (r.salary ?? 0), 0),
    advance: ready.reduce((n, r) => n + r.advance, 0),
    balance: ready.reduce((n, r) => n + (r.balance ?? 0), 0),
    pending: rows.length - ready.length,
  };
}
