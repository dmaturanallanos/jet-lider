'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { WifiOff, Download, RefreshCw } from 'lucide-react';
export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
export function PwaStatus() {
  const online = useOnline();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let disposed = false;
    const handle = (reg: ServiceWorkerRegistration) => {
      if (!disposed && reg.waiting) setWaiting(reg.waiting);
    };
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        handle(reg);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) handle(reg);
          });
        });
        return reg.update();
      })
      .catch(() => {
        /* App continues with online navigation if registration is unsupported. */
      });
    return () => {
      disposed = true;
    };
  }, []);
  return (
    <>
      {!online && (
        <div className="banner" role="status">
          <span className="row">
            <WifiOff size={15} />
            Sin conexión. Necesitas internet para consultar y guardar cambios. Los formularios
            abiertos se conservan en memoria.
          </span>
        </div>
      )}
      {waiting && (
        <div className="banner" role="status">
          <span>Hay una actualización disponible. Guarda tus formularios antes de recargar.</span>
          <button
            className="btn"
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => location.reload(),
                { once: true },
              );
              waiting.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
        </div>
      )}
    </>
  );
}
export function InstallApplication() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  return (
    <section className="panel">
      <div className="panelhead">
        <h2>Instalar aplicación</h2>
        <Download size={18} />
      </div>
      <div className="panelbody stack">
        <p className="muted">
          Accede a Jet Líder desde la pantalla de inicio. Se requiere conexión para trabajar con
          datos operativos.
        </p>
        {installed ? (
          <p className="notice">Aplicación instalada.</p>
        ) : prompt ? (
          <button
            className="btn primary"
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
            }}
          >
            Instalar Jet Líder
          </button>
        ) : (
          <p className="notice">
            En Android o computador, abre el menú del navegador y busca «Instalar aplicación». Esta
            opción requiere HTTPS o localhost y un navegador compatible.
          </p>
        )}
        <div>
          <h3>En iPhone o iPad</h3>
          <p className="muted" style={{ marginTop: 8 }}>
            Abre esta dirección en Safari → Compartir → Agregar a inicio → Agregar.
          </p>
        </div>
      </div>
    </section>
  );
}
