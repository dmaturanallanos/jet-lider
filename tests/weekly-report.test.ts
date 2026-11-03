import { it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { attendanceWorkbook, reportStatus, type ReportRow } from '@/features/shifts/weekly-report';
const base: ReportRow = {
  id: '10000000-0000-4000-8000-000000000001',
  worker_id: '20000000-0000-4000-8000-000000000001',
  worker_name: 'Trabajador uno',
  starts_at: '2020-11-02T10:00:00Z',
  ends_at: '2020-11-02T18:00:00Z',
  break_minutes: 30,
  shift_status: 'confirmed',
  shift_type: 'Mañana',
  location: 'Zona A',
  attendance_status: null,
  attendance_notes: '',
  marked_at: null,
  marked_by: '',
};
it('el Excel distingue ausencias, pendientes, cancelados y turnos sin asignar sin inventar horas reales', async () => {
  const rows: ReportRow[] = [
    { ...base, attendance_status: 'present' },
    { ...base, id: '10000000-0000-4000-8000-000000000002', attendance_status: 'absent' },
    { ...base, id: '10000000-0000-4000-8000-000000000003' },
    { ...base, id: '10000000-0000-4000-8000-000000000004', shift_status: 'cancelled' },
    {
      ...base,
      id: '10000000-0000-4000-8000-000000000005',
      worker_id: null,
      worker_name: 'Sin asignar',
    },
  ];
  const generated = await attendanceWorkbook('2020-11-02', rows, new Date('2020-11-03T12:00Z'));
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await generated.xlsx.writeBuffer());
  const sheet = loaded.getWorksheet('Resumen semanal')!;
  const row = [5, 6].find((i) => sheet.getCell(i, 2).value === 'Trabajador uno')!;
  expect(sheet.getCell(row, 10).value).toBe(3);
  expect(sheet.getCell(row, 11).value).toBe(1);
  expect(sheet.getCell(row, 12).value).toBe(1);
  expect(sheet.getCell(row, 13).value).toBe(1);
  expect(sheet.getCell(row, 14).value).toBe(1);
  expect(sheet.getCell(row, 16).value).toBe(22.5);
  expect(String(sheet.getCell(row, 3).value)).toContain('1 no asistió');
  expect(loaded.getWorksheet('Detalle de turnos')!.rowCount).toBe(10);
  expect(sheet.getCell(2, 1).value).toContain('2020');
  expect(sheet.views[0].state).toBe('frozen');
});
it('los nocturnos conservan fecha de inicio local y las cadenas de usuario nunca son fórmulas', async () => {
  const workbook = await attendanceWorkbook('2020-11-02', [
    {
      ...base,
      worker_name: '=HYPERLINK("https://example.invalid")',
      starts_at: '2020-11-03T01:00:00Z',
      ends_at: '2020-11-03T09:00:00Z',
      attendance_status: 'present',
    },
  ]);
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  const detail = loaded.getWorksheet('Detalle de turnos')!;
  expect(detail.getCell('B5').type).toBe(ExcelJS.ValueType.String);
  expect(detail.getCell('D5').value).toBe('22:00');
  expect(detail.getCell('F5').value).toBe('06:00');
  expect(detail.getCell('L5').value).toBe(7.5);
  expect(detail.getCell('C5').value).not.toBe(detail.getCell('E5').value);
});
it('una semana vacía sigue produciendo un archivo válido y un cancelado no cuenta como ausencia', async () => {
  const workbook = await attendanceWorkbook('2020-11-02', []);
  expect(workbook.worksheets).toHaveLength(2);
  expect(workbook.worksheets[0].getCell('B5').value).toBe('Sin turnos en esta semana');
  expect(reportStatus({ ...base, shift_status: 'cancelled', attendance_status: 'absent' })).toBe(
    'Cancelado',
  );
  expect(reportStatus(base)).toBe('Sin registrar');
});
