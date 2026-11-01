export default function Loading() {
  return (
    <main className="main" aria-busy="true" aria-label="Cargando información">
      <p className="muted" style={{ marginBottom: 20 }}>
        Cargando tu operación…
      </p>
      <div className="metrics">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton" />
        ))}
      </div>
      <div className="skeleton" style={{ height: 400 }} />
    </main>
  );
}
