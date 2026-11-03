import { describe, it, expect } from 'vitest';
import {
  localToInstant,
  localInput,
  copyLocalInstant,
  scheduledHours,
  monday,
  overlaps,
  dayRange,
} from '@/utils/dates';
import {
  copyWeek,
  repeatShifts,
  templateFromLocal,
  validateBatch,
  type ShiftInput,
} from '@/features/shifts/planning';
import { shiftSchema } from '@/features/shared/validation';
const template: ShiftInput = {
  worker_id: '00000000-0000-4000-8000-000000000001',
  type_id: '00000000-0000-4000-8000-000000000002',
  ...templateFromLocal('2026-08-31T07:00', '2026-08-31T15:00', 30),
  location: 'Jet',
  notes: '',
  status: 'scheduled',
};
describe('Fechas y programación chilena', () => {
  it('usa lunes como comienzo de semana', () => expect(monday('2026-11-01')).toBe('2026-10-26'));
  it('convierte y muestra horas locales sin depender de la zona del servidor', () =>
    expect(localInput(localToInstant('2026-11-01T07:00'))).toBe('2026-11-01T07:00'));
  it('rechaza una hora inexistente al adelantar el reloj', () =>
    expect(() => localToInstant('2026-09-06T00:30')).toThrow(/inexistente o ambigua/));
  it('rechaza una hora ambigua al atrasar el reloj', () =>
    expect(() => localToInstant('2026-04-04T23:30')).toThrow(/inexistente o ambigua/));
  it('conserva 07:00 al repetir a través de un cambio de horario', () => {
    const copied = copyLocalInstant(template.starts_at, 7);
    expect(localInput(copied)).toBe('2026-09-07T07:00');
    expect((Date.parse(copied) - Date.parse(template.starts_at)) / 3600000).toBe(167);
  });
  it('calcula horas reales de una noche con adelanto de reloj menos descanso', () =>
    expect(
      scheduledHours(localToInstant('2026-09-05T22:00'), localToInstant('2026-09-06T06:00'), 30),
    ).toBe(6.5));
  it('un día de cambio horario no siempre tiene 24 horas', () => {
    const r = dayRange('2026-09-06');
    expect((Date.parse(r.end) - Date.parse(r.start)) / 3600000).toBe(23);
  });
  it('permite turnos consecutivos y detecta solapamientos', () => {
    expect(
      overlaps(
        { starts_at: '2026-11-01T10:00Z', ends_at: '2026-11-01T12:00Z' },
        { starts_at: '2026-11-01T12:00Z', ends_at: '2026-11-01T13:00Z' },
      ),
    ).toBe(false);
    expect(() => validateBatch([template, { ...template }], [])).toThrow(/superpuestos/);
  });
  it('rechaza fin igual al inicio y descansos excesivos', () => {
    expect(shiftSchema.safeParse({ ...template, ends_at: template.starts_at }).success).toBe(false);
    expect(shiftSchema.safeParse({ ...template, break_minutes: 481 }).success).toBe(false);
  });
  it('crea repeticiones por día local, varios trabajadores y un máximo acotado', () => {
    const repeated = repeatShifts(template, [template.worker_id, null], '2026-09-07', [1]);
    expect(repeated).toHaveLength(4);
    expect(localInput(repeated[2].starts_at)).toBe('2026-09-07T07:00');
    expect(() => repeatShifts(template, [null], '2027-01-01', [1])).toThrow(/90/);
  });
  it('la copia conserva horas locales y descarta cancelados', () => {
    const rows = [
      {
        ...template,
        id: 'one',
        created_at: '',
        updated_at: '',
        created_by: '',
        workspace_id: 'test-space',
        version: 1,
        series_id: null,
      },
      {
        ...template,
        id: 'two',
        created_at: '',
        updated_at: '',
        created_by: '',
        workspace_id: 'test-space',
        version: 1,
        series_id: null,
        status: 'cancelled',
      },
    ];
    const copied = copyWeek(rows, '2026-08-31', '2026-09-07');
    expect(copied).toHaveLength(1);
    expect(localInput(copied[0].starts_at)).toBe('2026-09-07T07:00');
    expect(copied[0].id).toBeUndefined();
  });
});
