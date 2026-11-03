import ExcelJS from 'exceljs';
import { addDays, clock, dateLabel, localInput, scheduledHours } from '@/utils/dates';

export { reportRowsSchema, type ReportRow } from './report-data';
import type { ReportRow } from './report-data';
const reportDate = (value: string) =>
  dateLabel(value, { day: '2-digit', month: '2-digit', year: 'numeric' });
export function reportStatus(row: ReportRow) {
  if (row.shift_status === 'cancelled') return 'Cancelado';
  if (!row.worker_id) return 'Sin asignar';
  return row.attendance_status === 'present'
    ? 'Asistió'
    : row.attendance_status === 'absent'
      ? 'No asistió'
      : 'Sin registrar';
}
function configure(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  headers: string[],
  widths: number[],
) {
  sheet.properties.defaultRowHeight = 22;
  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell(1, 1).value = title;
  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell(2, 1).value = subtitle;
  sheet.getRow(1).height = 32;
  sheet.getRow(1).font = { name: 'Calibri', size: 19, bold: true, color: { argb: 'FF00BFFF' } };
  sheet.getRow(2).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
  sheet.getRow(4).values = headers;
  sheet.getRow(4).height = 32;
  sheet.getRow(4).font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } };
  sheet.getRow(4).alignment = { vertical: 'middle', wrapText: true };
  widths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
  sheet.views = [{ state: 'frozen', ySplit: 4, xSplit: 2 }];
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:4',
  };
  sheet.headerFooter.oddFooter = 'Jet Líder · America/Santiago | Página &P de &N';
}
export async function attendanceWorkbook(
  start: string,
  rows: ReportRow[],
  generatedAt = new Date(),
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Jet Líder';
  workbook.created = generatedAt;
  const summary = workbook.addWorksheet('Resumen semanal'),
    detail = workbook.addWorksheet('Detalle de turnos');
  const period = `${reportDate(start)} al ${reportDate(addDays(start, 6))} · America/Santiago`;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  configure(
    summary,
    'Jet · Asistencia semanal',
    period,
    [
      'Ref.',
      'Trabajador',
      ...days.map((d) => dateLabel(d, { weekday: 'short', day: '2-digit', month: '2-digit' })),
      'Turnos activos',
      'Asistió',
      'No asistió',
      'Sin registrar',
      'Cancelados',
      'Sin asignar',
      'Horas programadas',
    ],
    [8, 30, 20, 20, 20, 20, 20, 20, 20, 13, 12, 12, 13, 12, 12, 17],
  );
  configure(
    detail,
    'Jet · Detalle de turnos',
    `${period} · Generado ${reportDate(generatedAt.toISOString())} ${clock(generatedAt.toISOString())}`,
    [
      'Ref.',
      'Trabajador',
      'Fecha inicio',
      'Entrada programada',
      'Fecha término',
      'Salida programada',
      'Tipo',
      'Lugar',
      'Estado turno',
      'Asistencia',
      'Descanso (min)',
      'Horas programadas',
      'Nota asistencia',
      'Registrado por',
      'Último registro',
    ],
    [8, 30, 15, 16, 15, 16, 15, 23, 16, 17, 15, 19, 40, 24, 23],
  );
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = row.worker_id ?? 'unassigned';
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    a[1][0].worker_name.localeCompare(b[1][0].worker_name, 'es'),
  );
  let ref = 0;
  for (const [, items] of ordered) {
    ref++;
    const count = (status: string) => items.filter((r) => reportStatus(r) === status).length;
    summary.addRow([
      ref,
      items[0].worker_name,
      ...days.map((day) => {
        const list = items.filter((r) => localInput(r.starts_at).slice(0, 10) === day);
        if (!list.length) return 'Sin turno';
        return ['Asistió', 'No asistió', 'Sin registrar', 'Cancelado', 'Sin asignar']
          .map((label) => {
            const n = list.filter((r) => reportStatus(r) === label).length;
            return n ? `${n} ${label.toLowerCase()}` : '';
          })
          .filter(Boolean)
          .join(' / ');
      }),
      items.filter((r) => r.shift_status !== 'cancelled').length,
      count('Asistió'),
      count('No asistió'),
      count('Sin registrar'),
      count('Cancelado'),
      count('Sin asignar'),
      items
        .filter((r) => r.shift_status !== 'cancelled')
        .reduce((n, r) => n + scheduledHours(r.starts_at, r.ends_at, r.break_minutes), 0),
    ]);
    for (const r of items)
      detail.addRow([
        ref,
        r.worker_name,
        reportDate(r.starts_at),
        clock(r.starts_at),
        reportDate(r.ends_at),
        clock(r.ends_at),
        r.shift_type,
        r.location,
        r.shift_status === 'cancelled'
          ? 'Cancelado'
          : r.shift_status === 'confirmed'
            ? 'Confirmado'
            : 'Programado',
        reportStatus(r),
        r.break_minutes,
        scheduledHours(r.starts_at, r.ends_at, r.break_minutes),
        r.attendance_notes,
        r.marked_by,
        r.marked_at ? `${reportDate(r.marked_at)} ${clock(r.marked_at)}` : '',
      ]);
  }
  if (!rows.length) {
    summary.addRow(['', 'Sin turnos en esta semana']);
    detail.addRow(['', 'Sin turnos en esta semana']);
  }
  summary.getColumn(16).numFmt = '0.00';
  detail.getColumn(12).numFmt = '0.00';
  for (const sheet of [summary, detail]) {
    const last = sheet.rowCount;
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: last, column: sheet.columnCount },
    };
    for (let i = 5; i <= last; i++) {
      sheet.getRow(i).height = 36;
      sheet.getRow(i).font = { name: 'Calibri', size: 10, color: { argb: 'FF16324F' } };
      sheet.getRow(i).alignment = { vertical: 'middle', wrapText: true };
      if (i % 2 === 1)
        sheet.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FC' } };
    }
    const note = sheet.addRow([
      '',
      'Instantánea de los datos guardados. Sin registrar no significa inasistencia. Las horas son programadas menos descansos, no horas efectivamente trabajadas ni remuneración.',
    ]);
    sheet.mergeCells(note.number, 2, note.number, sheet.columnCount);
    note.height = 32;
    note.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    note.alignment = { wrapText: true };
  }
  return workbook;
}
