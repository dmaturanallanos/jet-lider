import { it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  grossFromNet,
  retentionRate,
  paymentRows,
  type PaymentSource,
} from '@/features/payments/calculations';
import { paymentWorkbook } from '@/features/payments/workbook';
const id = '50000000-0000-4000-8000-000000000001';
function fixture(): PaymentSource {
  return {
    workers: [{ id, full_name: 'Operador', active: true, employment_type: 'boleta' }],
    shifts: [
      {
        id: '60000000-0000-4000-8000-000000000001',
        worker_id: id,
        worker_name: 'Operador',
        starts_at: '2026-11-02T10:00:00Z',
        ends_at: '2026-11-02T18:00:00Z',
        break_minutes: 30,
        shift_status: 'confirmed',
        shift_type: 'Mañana',
        location: 'Zona A',
        attendance_status: 'present',
        attendance_notes: '',
        marked_at: '2026-11-02T18:01Z',
        marked_by: 'Administrador',
      },
    ],
    entries: [],
    as_of: '2026-11-03T12:00:00Z',
  };
}
it('convierte un día líquido y la hora extra a bruto con redondeo a pesos', () => {
  expect(grossFromNet(28500, 1525)).toEqual({ net: 28500, gross: 33628, withholding: 5128 });
  expect(grossFromNet(3166, 1525)).toEqual({ net: 3166, gross: 3736, withholding: 570 });
  expect(grossFromNet(148832, 1525)).toEqual({ net: 148832, gross: 175613, withholding: 26781 });
});
it('reproduce el ejemplo publicado del SII y conserva el líquido en distintos redondeos', () => {
  expect(grossFromNet(211875, 1525)).toEqual({ gross: 250000, withholding: 38125, net: 211875 });
  for (const rate of [1450, 1525, 1600, 1700])
    for (let net = 0; net < 10000; net += 37) {
      const result = grossFromNet(net, rate);
      expect(result.gross - result.withholding).toBe(net);
    }
  expect(() => grossFromNet(-1, 1525)).toThrow();
  expect(() => grossFromNet(10, 10000)).toThrow();
});
it('elige la tasa por emisión y rechaza años no verificados', () => {
  expect(retentionRate('2026-12-31')).toBe(1525);
  expect(retentionRate('2027-01-01')).toBe(1600);
  expect(retentionRate('2028-01-01')).toBe(1700);
  expect(() => retentionRate('2030-01-01')).toThrow(/verificarse/);
  expect(() => retentionRate('error')).toThrow();
});
it('cuenta fechas locales con asistencia una sola vez e integra solo HE manuales', () => {
  const source = fixture();
  source.shifts.push({
    ...source.shifts[0],
    id: '60000000-0000-4000-8000-000000000002',
    starts_at: '2026-11-03T01:00:00Z',
    ends_at: '2026-11-03T09:00:00Z',
  });
  source.entries = [
    {
      worker_id: id,
      overtime_minutes: 90,
      additions: 1000,
      deductions: 500,
      contract_net: null,
      notes: 'HE manuales y ajuste',
      version: 1,
    },
  ];
  const row = paymentRows(source, '2026-11-03')[0];
  expect(row.days).toBe(1);
  expect(row.base).toBe(28500);
  expect(row.extraNet).toBe(4749);
  expect(row.net).toBe(33749);
  expect(row.errors).toEqual([]);
});
it('no transforma pendientes, ausentes ni cancelados en días pagados', () => {
  const source = fixture();
  source.shifts[0].attendance_status = 'absent';
  expect(paymentRows(source, '2026-11-03')[0].days).toBe(0);
  source.shifts[0].attendance_status = null;
  expect(paymentRows(source, '2026-11-03')[0].pending).toBe(1);
  expect(() => paymentWorkbook('2026-11-02', '2026-11-03', source)).toThrow(/sin asistencia/);
  source.shifts[0].shift_status = 'cancelled';
  expect(paymentRows(source, '2026-11-03')[0].pending).toBe(0);
  expect(paymentRows(source, '2026-11-03')[0].net).toBe(0);
});
it('los futuros no generan días ni bloquean el corte actual', () => {
  const source = fixture();
  source.shifts[0] = {
    ...source.shifts[0],
    starts_at: '2026-11-06T10:00:00Z',
    ends_at: '2026-11-06T18:00:00Z',
    attendance_status: null,
  };
  const row = paymentRows(source, '2026-11-03')[0];
  expect(row.future).toBe(1);
  expect(row.days).toBe(0);
  expect(row.pending).toBe(0);
});
it('contrato usa el líquido manual y no la tarifa de boleta ni su retención', () => {
  const source = fixture();
  source.workers[0].employment_type = 'contrato';
  expect(paymentRows(source, '2026-11-03')[0].errors).toContain('Ingresa el líquido de contrato');
  source.entries = [
    {
      worker_id: id,
      overtime_minutes: 0,
      additions: 1000,
      deductions: 500,
      contract_net: 200000,
      notes: 'Ajuste',
      version: 1,
    },
  ];
  const row = paymentRows(source, '2026-11-03')[0];
  expect(row.base).toBe(200000);
  expect(row.net).toBe(200500);
  expect(row.gross).toBeNull();
  expect(row.withholding).toBeNull();
});
it('no exporta modalidades sin definir o pagos negativos', () => {
  const source = fixture();
  source.workers[0].employment_type = null;
  expect(() => paymentWorkbook('2026-11-02', '2026-11-03', source)).toThrow(/Boleta o Contrato/);
  source.workers[0].employment_type = 'boleta';
  source.entries = [
    {
      worker_id: id,
      overtime_minutes: 0,
      additions: 0,
      deductions: 999999,
      contract_net: null,
      notes: 'Revisar',
      version: 1,
    },
  ];
  expect(() => paymentWorkbook('2026-11-02', '2026-11-03', source)).toThrow(/descuentos/);
});
it('el Excel conserva importes, tasa, fecha de emisión y textos sin convertirlos en fórmulas', async () => {
  const source = fixture();
  source.workers[0].full_name = '=HYPERLINK("https://example.invalid")';
  const book = paymentWorkbook('2026-11-02', '2026-11-03', source),
    loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await book.xlsx.writeBuffer());
  expect(loaded.worksheets.map((s) => s.name)).toEqual(['Pagos', 'Asistencia base']);
  const sheet = loaded.getWorksheet('Pagos')!;
  expect(sheet.getCell('L5').value).toBe(28500);
  expect(sheet.getCell('N5').value).toBe(5128);
  expect(sheet.getCell('O5').value).toBe(33628);
  expect(sheet.getCell('M5').value).toBe(0.1525);
  expect(sheet.getCell('B5').type).toBe(ExcelJS.ValueType.String);
  expect(String(sheet.getCell('A2').value)).toContain('2026');
});
