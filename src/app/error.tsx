'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="main">
      <div className="panel panelbody stack" role="alert">
        <h1>No pudimos cargar la operación</h1>
        <p className="muted">
          Comprueba tu conexión y la configuración de Supabase. Tu información no se ha modificado.
        </p>
        <button className="btn primary" onClick={reset}>
          Volver a intentar
        </button>
        <Link className="link" href="/acceso">
          Volver al acceso
        </Link>
      </div>
    </main>
  );
}
