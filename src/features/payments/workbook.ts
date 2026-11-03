import ExcelJS from 'exceljs';
import { paymentRows, type PaymentSource, DAY_NET, OVERTIME_NET, SII_SOURCE } from './calculations';
import { addDays, clock, dateLabel } from '@/utils/dates';
export function paymentWorkbook(start: string, issueDate: string, source: PaymentSource) {
  const rows = paymentRows(source, issueDate).filter((r) => r.included);
  const invalid = rows.filter((r) => r.errors.length);
  if (invalid.length)
    throw new Error(
      `Revisa ${invalid[0].worker.full_name}: ${invalid[0].errors.join(' · ')}. No se generó una planilla incompleta.`,
    );
  const book = new ExcelJS.Workbook();
  book.creator = 'Jet Líder';
  book.created = new Date(source.as_of);
  const summary = book.addWorksheet('Pagos'),
    detail = book.addWorksheet('Asistencia base');
  const date = (value: string) =>
    dateLabel(value, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const period = `Semana ${date(start)} al ${date(addDays(start, 6))} · Emisión ${date(issueDate)} · America/Santiago`;
  function setup(sheet: ExcelJS.Worksheet, title: string, headers: string[], widths: number[]) {
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.getCell('A1').value = title;
    sheet.getRow(1).height = 32;
    sheet.getRow(1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF00BFFF' } };
    sheet.mergeCells(2, 1, 2, headers.length);
    sheet.getCell('A2').value = period;
    sheet.getRow(4).values = headers;
    sheet.getRow(4).height = 36;
    sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
    sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } };
    sheet.getRow(4).alignment = { wrapText: true, vertical: 'middle' };
    widths.forEach((width, i) => (sheet.getColumn(i + 1).width = width));
    sheet.views = [{ state: 'frozen', ySplit: 4, xSplit: 2 }];
    sheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:4',
    };
  }
  setup(
    summary,
    'Jet · Preparación semanal de pagos',
    [
      'Ref.',
      'Trabajador',
      'Modalidad',
      'Días confirmados',
      'Día líquido CLP',
      'HE ingresadas (h)',
      'Hora extra líquida CLP',
      'Base líquida CLP',
      'HE líquidas CLP',
      'Adicionales CLP',
      'Rebaja pactada CLP',
      'Líquido a recibir CLP',
      'Tasa retención',
      'Retención CLP',
      'Bruto de boleta CLP',
      'Detalle / ajustes',
    ],
    [8, 29, 15, 15, 17, 15, 20, 17, 17, 18, 18, 22, 17, 19, 23, 45],
  );
  setup(
    detail,
    'Jet · Respaldo de asistencia',
    [
      'Ref.',
      'Trabajador',
      'Fecha inicio Chile',
      'Entrada programada',
      'Salida programada',
      'Estado turno',
      'Asistencia',
      'Nota de asistencia',
    ],
    [8, 29, 22, 22, 22, 20, 20, 45],
  );
  rows.forEach((r, i) => {
    summary.addRow([
      i + 1,
      r.worker.full_name,
      r.worker.employment_type === 'boleta' ? 'Boleta' : 'Contrato',
      r.days,
      r.worker.employment_type === 'boleta' ? DAY_NET : null,
      r.overtimeMinutes / 60,
      r.worker.employment_type === 'boleta' ? OVERTIME_NET : null,
      r.base,
      r.extraNet,
      r.entry?.additions ?? 0,
      r.entry?.deductions ?? 0,
      r.net,
      r.worker.employment_type === 'boleta' ? r.rate / 10000 : null,
      r.withholding,
      r.net > 0 ? r.gross : null,
      r.entry?.notes ?? '',
    ]);
    for (const shift of source.shifts.filter((s) => s.worker_id === r.worker.id))
      detail.addRow([
        i + 1,
        r.worker.full_name,
        date(shift.starts_at),
        clock(shift.starts_at),
        `${date(shift.ends_at)} ${clock(shift.ends_at)}`,
        shift.shift_status === 'cancelled'
          ? 'Cancelado'
          : shift.shift_status === 'confirmed'
            ? 'Confirmado'
            : 'Programado',
        shift.shift_status === 'cancelled'
          ? 'No aplica'
          : shift.attendance_status === 'present'
            ? 'Asistió'
            : shift.attendance_status === 'absent'
              ? 'No asistió'
              : 'Sin registrar',
        shift.attendance_notes,
      ]);
  });
  if (!rows.length) {
    summary.addRow(['', 'Sin actividad ni pagos preparados']);
    detail.addRow(['', 'Sin registros incluidos']);
  }
  for (const col of [5, 7, 8, 9, 10, 11, 12, 14, 15]) summary.getColumn(col).numFmt = '#,##0';
  summary.getColumn(6).numFmt = '0.00';
  summary.getColumn(13).numFmt = '0.00%';
  for (const sheet of [summary, detail]) {
    const last = sheet.rowCount;
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: last, column: sheet.columnCount },
    };
    for (let n = 5; n <= last; n++) {
      sheet.getRow(n).height = 36;
      sheet.getRow(n).font = { name: 'Calibri', size: 10 };
      sheet.getRow(n).alignment = { wrapText: true, vertical: 'middle' };
      if (n % 2)
        sheet.getRow(n).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FC' } };
    }
    if (sheet === summary && rows.length) {
      const total = summary.addRow(['', 'TOTAL SEMANAL']);
      const amounts: Record<number, number> = {
        8: rows.reduce((n, r) => n + r.base, 0),
        9: rows.reduce((n, r) => n + r.extraNet, 0),
        10: rows.reduce((n, r) => n + (r.entry?.additions ?? 0), 0),
        11: rows.reduce((n, r) => n + (r.entry?.deductions ?? 0), 0),
        12: rows.reduce((n, r) => n + r.net, 0),
        14: rows.reduce((n, r) => n + (r.withholding ?? 0), 0),
        15: rows.reduce((n, r) => n + (r.gross ?? 0), 0),
      };
      for (const [column, value] of Object.entries(amounts))
        total.getCell(Number(column)).value = value;
      total.height = 28;
      total.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
      total.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } };
    }
    for (const text of [
      `Corte de datos: ${date(source.as_of)} ${clock(source.as_of)}. Días = fechas distintas con asistencia confirmada. HE ingresadas manualmente.`,
      'Contratos: líquido manual informado; no es liquidación laboral. Boletas: receptor retiene. Bruto = líquido / (1 − tasa), redondeado a pesos.',
      'El bruto y la retención total corresponden solo a boletas. Un líquido cero no requiere emitir boleta en esta preparación.',
      `Fuente tasa SII: ${SII_SOURCE}`,
      'Instantánea para revisión. No emite boletas ni ejecuta pagos. Los turnos futuros o en curso sin marca no generan días pagados.',
    ]) {
      const note = sheet.addRow(['', text]);
      sheet.mergeCells(note.number, 2, note.number, sheet.columnCount);
      note.height = 30;
      note.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
      note.alignment = { wrapText: true };
    }
  }
  return book;
}
