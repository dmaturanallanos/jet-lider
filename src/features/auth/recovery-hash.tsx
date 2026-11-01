'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
function recoveryHash(hash: string) {
  const q = new URLSearchParams(hash.slice(1));
  return q.get('type') === 'recovery' && q.has('access_token') && q.has('refresh_token');
}
export function RecoveryHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    if (recoveryHash(hash)) router.replace(`/restablecer-contrasena${hash}`);
  }, [router]);
  return null;
}
export function AuthEntryRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    router.replace(recoveryHash(hash) ? `/restablecer-contrasena${hash}` : '/acceso');
  }, [router]);
  return (
    <main className="main" aria-busy="true">
      <p className="muted">Comprobando el acceso…</p>
      <noscript>Activa JavaScript para continuar al acceso de Jet Líder.</noscript>
    </main>
  );
}
