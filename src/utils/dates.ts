import { Temporal } from '@js-temporal/polyfill';
export const TIME_ZONE = 'America/Santiago';
export function localToInstant(value: string): string {
  try {
    return Temporal.PlainDateTime.from(value)
      .toZonedDateTime(TIME_ZONE, { disambiguation: 'reject' })
      .toInstant()
      .toString();
  } catch {
    throw new Error(
      'Hora local inexistente o ambigua por cambio de horario en Chile. Elige otra hora.',
    );
  }
}
export function localInput(value: string) {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(TIME_ZONE)
    .toPlainDateTime()
    .toString()
    .slice(0, 16);
}
export function today() {
  return Temporal.Now.plainDateISO(TIME_ZONE).toString();
}
export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function monday(date: string) {
  const d = Temporal.PlainDate.from(date);
  return d.subtract({ days: d.dayOfWeek - 1 }).toString();
}
export function dayRange(date: string, days = 1) {
  return {
    start: Temporal.PlainDate.from(date).toZonedDateTime(TIME_ZONE).toInstant().toString(),
    end: Temporal.PlainDate.from(date)
      .add({ days })
      .toZonedDateTime(TIME_ZONE)
      .toInstant()
      .toString(),
  };
}
export function clock(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}
export function dateLabel(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
) {
  return new Intl.DateTimeFormat('es-CL', { ...options, timeZone: TIME_ZONE }).format(
    new Date(value.length === 10 ? `${value}T12:00:00Z` : value),
  );
}
export function scheduledHours(start: string, end: string, rest: number) {
  return (
    (Temporal.Instant.from(end).epochMilliseconds -
      Temporal.Instant.from(start).epochMilliseconds) /
      3600000 -
    rest / 60
  );
}
export function copyLocalInstant(value: string, days: number) {
  const local = Temporal.Instant.from(value)
    .toZonedDateTimeISO(TIME_ZONE)
    .toPlainDateTime()
    .add({ days });
  return localToInstant(local.toString());
}
export function overlaps(
  a: { starts_at: string; ends_at: string },
  b: { starts_at: string; ends_at: string },
) {
  return (
    Date.parse(a.starts_at) < Date.parse(b.ends_at) &&
    Date.parse(b.starts_at) < Date.parse(a.ends_at)
  );
}
export function offsetDays(from: string, to: string) {
  return Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(to)).days;
}
