'use server';
import { requireAdmin } from '@/features/auth/session';
import { dayRange } from '@/utils/dates';
import { z } from 'zod';
export async function fetchCopySource(date: string) {
  const d = z.iso.date().parse(date);
  const { db } = await requireAdmin();
  const range = dayRange(d, 7);
  const { data, error } = await db
    .from('shifts')
    .select('*')
    .gte('starts_at', range.start)
    .lt('starts_at', range.end)
    .neq('status', 'cancelled')
    .limit(501);
  if (error) throw new Error('No se pudo consultar la semana de origen.');
  if ((data?.length ?? 0) > 500)
    throw new Error('La semana supera 500 turnos; copia en grupos menores.');
  return data ?? [];
}
export async function fetchFutureSeries(series: string, from: string, worker: string | null) {
  const { db } = await requireAdmin();
  let query = db
    .from('shifts')
    .select('*')
    .eq('series_id', z.uuid().parse(series))
    .gte('starts_at', from)
    .neq('status', 'cancelled')
    .order('starts_at')
    .limit(501);
  query = worker ? query.eq('worker_id', z.uuid().parse(worker)) : query.is('worker_id', null);
  const { data, error } = await query;
  if (error || !data || data.length > 500) throw new Error('No se pudo consultar la serie.');
  return data;
}
