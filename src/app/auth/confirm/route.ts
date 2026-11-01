import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { serverDb } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const db = await serverDb();
  const q = request.nextUrl.searchParams;
  let ok = false;
  if (q.get('code')) {
    const { error } = await db.auth.exchangeCodeForSession(q.get('code')!);
    ok = !error;
  } else if (
    q.get('token_hash') &&
    ['invite', 'magiclink', 'recovery', 'email'].includes(q.get('type') ?? '')
  ) {
    const { error } = await db.auth.verifyOtp({
      token_hash: q.get('token_hash')!,
      type: q.get('type') as EmailOtpType,
    });
    ok = !error;
  }
  const recovery = q.get('type') === 'recovery' || q.get('next') === '/restablecer-contrasena';
  return NextResponse.redirect(
    new URL(
      ok
        ? recovery
          ? '/restablecer-contrasena'
          : '/'
        : '/acceso?error=Enlace%20inválido%20o%20vencido.%20Solicita%20uno%20nuevo.',
      request.url,
    ),
  );
}
