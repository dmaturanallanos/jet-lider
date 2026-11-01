'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/browser';
import { authMessage } from './errors';
import { newPasswordSchema } from './password-validation';
export function ResetPassword() {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('Verificando el enlace de recuperación…');
  const router = useRouter();
  useEffect(() => {
    let disposed = false;
    async function initialize() {
      try {
        const q = new URLSearchParams(window.location.search),
          hash = new URLSearchParams(window.location.hash.slice(1));
        const token = hash.get('access_token'),
          refresh = hash.get('refresh_token'),
          code = q.get('code');
        const linkError = hash.get('error_code') ?? q.get('error_code');
        window.history.replaceState(null, '', '/restablecer-contrasena');
        if (linkError) throw new Error(authMessage({ code: linkError }));
        const db = browserDb();
        if (token && refresh) {
          const { error } = await db.auth.setSession({
            access_token: token,
            refresh_token: refresh,
          });
          if (error) throw new Error(authMessage(error));
        } else if (code) {
          const { error } = await db.auth.exchangeCodeForSession(code);
          if (error) throw new Error(authMessage(error));
        }
        const {
          data: { user },
          error,
        } = await db.auth.getUser();
        if (error || !user)
          throw new Error(
            'Abre el enlace de recuperación que recibiste por correo. Si venció, solicita uno nuevo desde el acceso.',
          );
        if (!disposed) {
          setReady(true);
          setMessage('Elige una contraseña nueva para tu cuenta.');
        }
      } catch (e) {
        if (!disposed)
          setMessage(e instanceof Error ? e.message : 'No se pudo verificar el enlace.');
      }
    }
    void initialize();
    return () => {
      disposed = true;
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    const f = new FormData(e.currentTarget);
    const result = newPasswordSchema.safeParse({
      password: f.get('password'),
      confirmation: f.get('confirmation'),
    });
    if (!result.success) {
      setMessage(result.error.issues[0].message);
      return;
    }
    if (!navigator.onLine) {
      setMessage('Necesitas conexión para guardar tu contraseña.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await browserDb().auth.updateUser({ password: result.data.password });
      if (error) {
        setMessage(authMessage(error));
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setMessage('No se pudo confirmar el cambio. Revisa la conexión y vuelve a intentar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="authform" style={{ minHeight: '100dvh' }}>
      <section className="authinner">
        <Link className="brand" href="/acceso">
          <span className="brandmark">jet</span>
          <strong>Jet Líder</strong>
        </Link>
        <h1>Restablecer contraseña</h1>
        <p className="notice" role="status">
          {message || 'Usa una contraseña que no utilices en otras cuentas.'}
        </p>
        {ready && (
          <form onSubmit={submit}>
            <label>
              Nueva contraseña
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              Repetir nueva contraseña
              <input name="confirmation" type="password" autoComplete="new-password" required />
            </label>
            <small className="muted">
              Al menos 12 caracteres. Tu contraseña se envía directamente a Supabase.
            </small>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
        <Link className="link" href="/acceso">
          Volver al acceso
        </Link>
      </section>
    </main>
  );
}
