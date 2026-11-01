'use server';
import { requireAdmin } from '@/features/auth/session';
import { z } from 'zod';
export async function workerImpact(target: string) {
  const { db } = await requireAdmin();
  const { data, error } = await db.rpc('worker_impact', { target: z.uuid().parse(target) });
  if (error) throw new Error('No se pudieron consultar los pendientes del trabajador.');
  return z.object({ shifts: z.number(), tasks: z.number() }).parse(data);
}
