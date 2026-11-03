import ExcelJS from 'exceljs';
import { monthlyRows, type MonthlySource } from './monthly-calculations';
import { dateLabel, clock } from '@/utils/dates';
export function monthlyWorkbook(month: string, source: MonthlySource) {
  const rows = monthlyRows(source);
  const missing = rows.find((r) => r.errors.length);
  if (missing)
    throw new Error(
      `Revisa ${missing.worker.full_name}: ${missing.errors.join(' · ')}. No se exportan sueldos incompletos.`,
    );
  const book = new ExcelJS.Workbook();
  book.creator = 'Jet Líder';
  book.created = new Date(source.as_of);
  const sheet = book.addWorksheet('Contratos mensuales');
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = 'Jet · Sueldos mensuales de contrato';
  sheet.getRow(1).height = 32;
  sheet.getRow(1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF00BFFF' } };
  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value = dateLabel(month, { month: 'long', year: 'numeric' });
  sheet.getRow(4).values = [
    'Ref.',
    'Trabajador',
    'Mes',
    'Sueldo líquido CLP',
    'Anticipo incluido CLP',
    'Saldo por pagar CLP',
    'Detalle',
  ];
  sheet.getRow(4).height = 34;
  sheet.getRow(4).font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } };
  sheet.getRow(4).alignment = { wrapText: true };
  [8, 30, 23, 24, 24, 24, 45].forEach((width, i) => (sheet.getColumn(i + 1).width = width));
  sheet.views = [{ state: 'frozen', ySplit: 4, xSplit: 2 }];
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:4',
  };
  rows.forEach((r, i) => {
    const row = sheet.addRow([
      i + 1,
      r.worker.full_name,
      dateLabel(month, { month: 'long', year: 'numeric' }),
      r.salary,
      r.advance,
      r.balance,
      r.entry?.notes ?? '',
    ]);
    row.height = 34;
    row.alignment = { wrapText: true, vertical: 'middle' };
    row.font = { name: 'Calibri', size: 11 };
    if (i % 2 === 0)
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FC' } };
  });
  if (!rows.length) sheet.addRow(['', 'Sin trabajadores con contrato en este mes']);
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: sheet.rowCount, column: 7 } };
  const totals = sheet.addRow([
    '',
    'TOTAL DEL MES',
    '',
    rows.reduce((n, r) => n + (r.salary ?? 0), 0),
    rows.reduce((n, r) => n + r.advance, 0),
    rows.reduce((n, r) => n + (r.balance ?? 0), 0),
    '',
  ]);
  totals.height = 28;
  totals.font = { bold: true, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
  totals.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } };
  for (const c of [4, 5, 6]) sheet.getColumn(c).numFmt = '#,##0';
  for (const note of [
    'Anticipo fijo de $200.000 por trabajador, incluido en el sueldo mensual. Sueldo = anticipo + saldo. No se suma dos veces.',
    'Montos planificados: no certifican transferencias, anticipos pagados ni saldo efectivamente abonado.',
    'Sueldos líquidos ingresados manualmente, incluyendo sus HE y descuentos. No calcula cotizaciones ni costo laboral completo.',
    `Corte: ${dateLabel(source.as_of, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${clock(source.as_of)} · America/Santiago`,
  ]) {
    const row = sheet.addRow(['', note]);
    sheet.mergeCells(row.number, 2, row.number, 7);
    row.height = 32;
    row.alignment = { wrapText: true };
    row.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  }
  return book;
}
