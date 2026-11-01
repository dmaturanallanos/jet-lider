import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { canManage } from '@/lib/permissions';
import { configured, serverDb } from '@/lib/supabase/server';
export const requireSession = cache(async function requireSession() {
  if (!configured()) redirect('/acceso');
  const db = await serverDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect('/acceso');
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  const { data: active } = await db.rpc('is_active');
  if (!profile || !active)
    redirect('/acceso?error=Acceso%20no%20habilitado.%20Contacta%20al%20administrador.');
  return { db, user, profile };
});
export async function requireAdmin() {
  const session = await requireSession();
  if (!canManage(session.profile.role)) throw new Error('FORBIDDEN: requiere administrador');
  return session;
}
