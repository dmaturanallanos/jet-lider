'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { configured, serverDb } from '@/lib/supabase/server';
export async function signIn(form: FormData) {
  if (!configured()) redirect('/acceso?error=Configura%20Supabase%20en%20.env.local');
  const email = z.email().safeParse(form.get('email'));
  if (!email.success) redirect('/acceso?error=Correo%20inválido');
  const db = await serverDb();
  if (form.get('method') === 'password') {
    const { error } = await db.auth.signInWithPassword({
      email: email.data,
      password: String(form.get('password')),
    });
    if (error) redirect('/acceso?error=No%20se%20pudo%20iniciar%20sesión');
    redirect('/');
  }
  await db.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    },
  });
  redirect('/acceso?sent=1');
}
export async function signOut() {
  const db = await serverDb();
  await db.auth.signOut();
  redirect('/acceso?logout=1');
}
