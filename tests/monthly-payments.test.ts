import { it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  monthlyRows,
  monthlyTotals,
  monthStart,
  moveMonth,
  type MonthlySource,
} from '@/features/payments/monthly-calculations';
import { monthlyWorkbook } from '@/features/payments/monthly-workbook';
import { parseOvertime } from '@/features/payments/overtime-input';
import { weeklyTotals, onlyBoletas } from '@/features/payments/calculations';
import { demoData } from '@/features/shared/demo';
function source(): MonthlySource {
  return {
    workers: [
      { id: '10000000-0000-4000-8000-000000000001', full_name: 'Persona uno', active: true },
      { id: '10000000-0000-4000-8000-000000000002', full_name: 'Persona dos', active: true },
    ],
    entries: [
      {
        worker_id: '10000000-0000-4000-8000-000000000001',
        salary_net: 800000,
        advance_net: 200000,
        notes: 'Sueldo manual',
        version: 1,
      },
      {
        worker_id: '10000000-0000-4000-8000-000000000002',
        salary_net: 1000000,
        advance_net: 200000,
        notes: 'Sueldo manual',
        version: 1,
      },
    ],
    as_of: '2026-11-03T15:00:00Z',
  };
}
it('el anticipo forma parte del sueldo mensual y nunca aumenta el gasto', () => {
  const rows = monthlyRows(source());
  expect(rows[0].balance).toBe(600000);
  expect(rows[1].balance).toBe(800000);
  const totals = monthlyTotals(source());
  expect(totals).toEqual({ salary: 1800000, advance: 400000, balance: 1400000, pending: 0 });
  expect(totals.advance + totals.balance).toBe(totals.salary);
});
it('no exporta sueldos incompletos ni saldos negativos', () => {
  const data = source();
  data.entries.pop();
  expect(monthlyTotals(data).pending).toBe(1);
  expect(() => monthlyWorkbook('2026-11-01', data)).toThrow(/Persona dos/);
  data.entries[0].salary_net = 190000;
  expect(monthlyRows(data)[0].errors.join(' ')).toContain('supera');
});
it('el Excel mensual contiene sueldo, anticipo, saldo y total correctos', async () => {
  const workbook = monthlyWorkbook('2026-11-01', source()),
    loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = loaded.getWorksheet('Contratos mensuales')!;
  expect(sheet.getCell('D5').value).toBe(800000);
  expect(sheet.getCell('E5').value).toBe(200000);
  expect(sheet.getCell('F5').value).toBe(600000);
  expect(sheet.getCell('D7').value).toBe(1800000);
  expect(sheet.getCell('E7').value).toBe(400000);
  expect(sheet.getCell('F7').value).toBe(1400000);
});
it('las horas extra aceptan coma, punto y horas:minutos y rechazan formatos erróneos', () => {
  expect(parseOvertime('1,5')).toBe(90);
  expect(parseOvertime('1.5')).toBe(90);
  expect(parseOvertime('1:30')).toBe(90);
  expect(parseOvertime('0,25')).toBe(15);
  expect(parseOvertime('168:00')).toBe(10080);
  for (const invalid of ['-1', '1:99', '169', 'hola', ''])
    expect(() => parseOvertime(invalid)).toThrow();
});
it('el gasto semanal excluye salarios y anticipos de contrato', () => {
  const data = demoData('2026-11-02').payments!;
  const just = onlyBoletas(data);
  expect(just.workers.every((w) => w.employment_type === 'boleta')).toBe(true);
  expect(just.entries.every((e) => e.contract_net === null)).toBe(true);
  const totals = weeklyTotals(data, '2026-11-03');
  expect(totals.gross).toBe(totals.net + totals.withholding);
  const changed = {
    ...data,
    entries: data.entries.map((e) =>
      e.contract_net === null ? e : { ...e, contract_net: 900000000 },
    ),
  };
  expect(weeklyTotals(changed, '2026-11-03')).toEqual(totals);
});
it('navega meses sin convertirlos a semanas ni perder el cambio de año', () => {
  expect(monthStart('2026-11-23')).toBe('2026-11-01');
  expect(moveMonth('2026-12-31', 1)).toBe('2027-01-01');
  expect(moveMonth('2028-03-01', -1)).toBe('2028-02-01');
});
