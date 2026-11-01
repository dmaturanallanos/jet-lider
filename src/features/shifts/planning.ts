import { Temporal } from '@js-temporal/polyfill';
import { addDays, copyLocalInstant, localToInstant, offsetDays, overlaps } from '@/utils/dates';
import type { Row } from '@/types/database';
import type { z } from 'zod';
import type { shiftSchema } from '@/features/shared/validation';
export type ShiftInput = z.infer<typeof shiftSchema>;
export function repeatShifts(
  template: ShiftInput,
  workers: (string | null)[],
  until: string,
  weekdays: number[],
): ShiftInput[] {
  const source = template.starts_at;
  const start = Temporal.Instant.from(source)
    .toZonedDateTimeISO('America/Santiago')
    .toPlainDate()
    .toString();
  const days = offsetDays(start, until);
  if (days < 0 || days > 90) throw new Error('La repetición admite hasta 90 días desde el inicio.');
  const result: ShiftInput[] = [];
  for (let d = 0; d <= days; d++)
    if (weekdays.includes(Temporal.PlainDate.from(addDays(start, d)).dayOfWeek))
      for (const worker_id of workers)
        result.push({
          ...template,
          worker_id,
          starts_at: copyLocalInstant(source, d),
          ends_at: copyLocalInstant(template.ends_at, d),
        });
  if (result.length > 500) throw new Error('Máximo 500 turnos por operación.');
  if (!result.length) throw new Error('Selecciona al menos un día de repetición.');
  return result;
}
export function copyWeek(shifts: Row<'shifts'>[], source: string, target: string): ShiftInput[] {
  const delta = offsetDays(source, target);
  return shifts
    .filter((s) => s.status !== 'cancelled')
    .map((s) => ({
      worker_id: s.worker_id,
      type_id: s.type_id,
      starts_at: copyLocalInstant(s.starts_at, delta),
      ends_at: copyLocalInstant(s.ends_at, delta),
      break_minutes: s.break_minutes,
      location: s.location ?? '',
      notes: s.notes ?? '',
      status: 'scheduled',
    }));
}
export function validateBatch(items: ShiftInput[], existing: Row<'shifts'>[]) {
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (!a.worker_id || a.status === 'cancelled') continue;
    if (
      [
        ...items.slice(0, i),
        ...existing.filter((s) => s.id !== a.id && !items.some((x) => x.id === s.id)),
      ].some((b) => b.worker_id === a.worker_id && b.status !== 'cancelled' && overlaps(a, b))
    )
      throw new Error('Hay turnos superpuestos para una misma persona. Revisa la vista previa.');
  }
}
export function templateFromLocal(start: string, end: string, rest: number) {
  const starts_at = localToInstant(start),
    ends_at = localToInstant(end);
  if (Date.parse(ends_at) <= Date.parse(starts_at))
    throw new Error(
      'El término debe ser posterior al inicio. En turnos nocturnos selecciona el día siguiente.',
    );
  if (rest < 0 || rest > (Date.parse(ends_at) - Date.parse(starts_at)) / 60000)
    throw new Error('Revisa los minutos de descanso.');
  return { starts_at, ends_at, break_minutes: rest };
}
