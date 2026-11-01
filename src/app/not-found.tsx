import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="main stack">
      <h1>Página no encontrada</h1>
      <Link href="/" className="link">
        Volver al inicio
      </Link>
    </main>
  );
}
