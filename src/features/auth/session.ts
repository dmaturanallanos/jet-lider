import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { canManage } from '@/lib/permissions';
import { configured, serverDb } from '@/lib/supabase/server';
export const optionalAuth = cache(async function optionalAuth() {
  if (!configured()) return null;
  const db = await serverDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  return { db, user };
});
export const requireSession = cache(async function requireSession() {
  const auth = await optionalAuth();
  if (!auth) redirect('/acceso');
  const { db, user } = auth;
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  const { data: active } = await db.rpc('is_active');
  if (!profile || !active)
    redirect('/acceso?error=Acceso%20no%20habilitado.%20Contacta%20al%20administrador.');
  if (!profile.workspace_id)
    redirect('/acceso?error=Falta%20actualizar%20los%20espacios%20privados%20en%20Supabase.');
  return { db, user, profile };
});
export async function requireAdmin() {
  const session = await requireSession();
  if (!canManage(session.profile.role)) throw new Error('FORBIDDEN: requiere administrador');
  return session;
}
