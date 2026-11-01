'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { configured, serverDb } from '@/lib/supabase/server';
import { appUrl, authMessage } from './errors';
function fail(message: string): never {
  redirect(`/acceso?error=${encodeURIComponent(message)}`);
}
function report(error: { code?: string; status?: number }) {
  console.warn('auth_request_failed', { code: error.code ?? 'unknown', status: error.status });
}
export async function signIn(form: FormData) {
  if (!configured()) redirect('/acceso?error=Configura%20Supabase%20en%20.env.local');
  const email = z.email().safeParse(String(form.get('email') ?? '').trim());
  if (!email.success) redirect('/acceso?error=Correo%20inválido');
  const db = await serverDb();
  if (form.get('method') === 'recovery') {
    const { error } = await db.auth.resetPasswordForEmail(email.data, {
      redirectTo: appUrl('/restablecer-contrasena'),
    });
    if (error) {
      report(error);
      fail(authMessage(error));
    }
    redirect('/acceso?recovery=1');
  }
  if (form.get('method') === 'password') {
    const password = form.get('password');
    if (typeof password !== 'string' || !password) fail('Escribe tu contraseña para ingresar.');
    const { error } = await db.auth.signInWithPassword({
      email: email.data,
      password,
    });
    if (error) {
      report(error);
      fail(authMessage(error));
    }
    redirect('/');
  }
  const { error } = await db.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: appUrl('/auth/confirm'),
    },
  });
  if (error) {
    report(error);
    if (error.code !== 'otp_disabled' && error.code !== 'user_not_found') fail(authMessage(error));
  }
  redirect('/acceso?sent=1');
}
export async function signOut() {
  const db = await serverDb();
  await db.auth.signOut();
  redirect('/acceso?logout=1');
}
