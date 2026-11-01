import Link from 'next/link';
import { ArrowRight, ShieldCheck, CalendarDays, ClipboardList } from 'lucide-react';
import { signIn } from '@/features/auth/actions';
import { configured } from '@/lib/supabase/server';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  return (
    <main className="authpage">
      <section className="authstory">
        <div className="brand">
          <span className="brandmark">jet</span>
          <div>
            <strong>Jet Líder</strong>
            <small>GESTIÓN OPERATIVA</small>
          </div>
        </div>
        <div>
          <span className="eyebrow" style={{ color: '#39cefa' }}>
            EL EQUIPO EN MOVIMIENTO
          </span>
          <h1>
            Todo tu turno.
            <br />
            Un solo lugar.
          </h1>
          <p>
            Organiza a tu equipo, coordina el día y entrega al siguiente turno la información que
            necesita.
          </p>
          <div className="row wrap" style={{ marginTop: 30, color: '#8fbacf', fontSize: 12 }}>
            <CalendarDays size={17} /> Turnos claros <span>·</span>
            <ClipboardList size={17} /> Operación conectada
          </div>
        </div>
        <p style={{ fontSize: 11 }}>Jet · Plataforma interna de coordinación logística</p>
      </section>
      <section className="authform">
        <div className="authinner">
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              BIENVENIDO A TU OPERACIÓN
            </div>
            <h1>Iniciar sesión</h1>
            <p className="muted" style={{ marginTop: 8 }}>
              Ingresa con el correo que habilitó tu administrador.
            </p>
          </div>
          {!configured() && (
            <div className="notice">
              Configuración pendiente: agrega las credenciales de Supabase en{' '}
              <code>.env.local</code>. Puedes revisar la interfaz con datos ficticios en la
              demostración.
            </div>
          )}
          {q.error && (
            <div role="alert" className="notice errornotice">
              {q.error}
            </div>
          )}
          {q.sent && (
            <div role="status" className="notice">
              Si tu cuenta está habilitada, recibirás un enlace de acceso. Revisa también correo no
              deseado.
            </div>
          )}
          {q.recovery && (
            <div role="status" className="notice">
              Si tu cuenta está habilitada, recibirás un enlace para elegir una contraseña nueva.
              Revisa también correo no deseado.
            </div>
          )}
          <form action={signIn}>
            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu.correo@empresa.cl"
              />
            </label>
            <button className="btn primary" name="method" value="email">
              Recibir enlace de acceso <ArrowRight size={16} />
            </button>
            <details>
              <summary className="link" style={{ cursor: 'pointer' }}>
                Usar contraseña de mi cuenta
              </summary>
              <label style={{ marginTop: 12 }}>
                Contraseña
                <input name="password" type="password" autoComplete="current-password" />
              </label>
              <button
                className="btn"
                name="method"
                value="password"
                style={{ marginTop: 12, width: '100%' }}
              >
                Ingresar con contraseña
              </button>
            </details>
            <button className="btn ghost" name="method" value="recovery">
              Olvidé mi contraseña
            </button>
          </form>
          <div className="row muted" style={{ fontSize: 11 }}>
            <ShieldCheck size={18} /> Acceso privado por invitación. Sin registro público.
          </div>
          <Link href="/demo" className="link">
            Explorar demostración de solo lectura →
          </Link>
        </div>
      </section>
    </main>
  );
}
