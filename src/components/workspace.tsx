'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  NotebookPen,
  Users,
  Settings2,
  MoreHorizontal,
  LogOut,
  Plus,
  Moon,
  Sun,
  UserRound,
  Download,
  ChevronRight,
} from 'lucide-react';
import { canManage } from '@/lib/permissions';
import type { WorkspaceData, View } from '@/features/shared/types';
import { Avatar } from '@/components/ui/primitives';
import { EditorModal, type Editor } from '@/features/shared/forms';
import { Detail } from '@/features/shared/detail';
import { Dashboard } from '@/features/dashboard/dashboard';
import { Calendar } from '@/features/shifts/calendar';
import { Tasks } from '@/features/tasks/tasks';
import { Logbook } from '@/features/logbook/logbook';
import { Workers } from '@/features/workers/workers';
import { Settings } from '@/features/settings/settings';
import { signOut } from '@/features/auth/actions';
import { PwaStatus, useOnline } from '@/components/pwa';
import { useLiveUpdates } from '@/hooks/use-live-updates';
import { dateLabel } from '@/utils/dates';
const navigation = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
  { id: 'turnos', label: 'Turnos', icon: CalendarDays },
  { id: 'tareas', label: 'Tareas', icon: ClipboardList },
  { id: 'bitacora', label: 'Bitácora', icon: NotebookPen },
  { id: 'equipo', label: 'Equipo', icon: Users },
  { id: 'configuracion', label: 'Configuración', icon: Settings2 },
] as const;
const titles: Record<View, [string, string]> = {
  inicio: ['Tu operación, al día', 'Turnos, pendientes y el contexto que necesita tu equipo.'],
  turnos: ['Calendario de turnos', 'Coordina la cobertura y planifica la semana de tu equipo.'],
  tareas: ['Tareas de la operación', 'Responsables claros. Pendientes bajo control.'],
  bitacora: ['Bitácora operativa', 'Lo que pasó y lo que necesita saber el siguiente turno.'],
  equipo: ['Tu equipo', 'Personas, perfiles laborales y acceso a la operación.'],
  perfil: ['Mi perfil', 'Tu información de acceso y preferencias.'],
  configuracion: ['Configuración', 'Personaliza tu espacio de trabajo.'],
  mas: ['Más opciones', 'Tu perfil y herramientas de la aplicación.'],
};
export function Workspace({
  data,
  view,
  date,
  params,
  demo = false,
}: {
  data: WorkspaceData;
  view: View;
  date: string;
  params: Record<string, string | undefined>;
  demo?: boolean;
}) {
  const router = useRouter();
  const online = useOnline();
  const { resolvedTheme, setTheme } = useTheme();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [message, setMessage] = useState('');
  const admin = canManage(data.profile.role);
  useLiveUpdates(!demo);
  function notify(s: string) {
    setMessage(s);
  }
  function edit(e: Editor) {
    if (demo) {
      notify('Demostración de solo lectura. Conecta Supabase para registrar cambios reales.');
      return;
    }
    if (!online) {
      notify('Sin conexión. Conecta internet para crear un registro.');
      return;
    }
    setEditor(e);
  }
  function link(target: View, changes: Record<string, string> = {}) {
    const q = new URLSearchParams(
      target === view
        ? Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string')
        : [],
    );
    if (!q.has('date')) q.set('date', date);
    Object.entries(changes).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    return `${demo ? '/demo' : ''}/${target === 'inicio' ? '' : target}?${q.toString()}`;
  }
  const props = { data, view, date, params, demo, link, edit, notify };
  const action =
    view === 'equipo' && admin
      ? { kind: 'worker' as const, label: 'Nuevo trabajador' }
      : view === 'turnos' && admin
        ? { kind: 'shift' as const, label: 'Nuevo turno' }
        : view === 'tareas' && admin
          ? { kind: 'task' as const, label: 'Nueva tarea' }
          : view === 'bitacora'
            ? { kind: 'entry' as const, label: 'Nueva observación' }
            : view === 'inicio' && admin
              ? { kind: 'shift' as const, label: 'Programar turno' }
              : null;
  return (
    <div className="app">
      <a className="skiplink" href="#contenido">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <Link className="brand" href={link('inicio')}>
          <span className="brandmark">jet</span>
          <div>
            <strong>Jet Líder</strong>
            <small>GESTIÓN OPERATIVA</small>
          </div>
        </Link>
        <nav className="nav" aria-label="Navegación principal">
          {navigation
            .filter((n) => admin || n.id !== 'equipo')
            .map((n) => (
              <Link className={view === n.id ? 'active' : ''} href={link(n.id)} key={n.id}>
                <n.icon />
                {n.label}
              </Link>
            ))}
        </nav>
        <div className="sidebarfoot">
          <p className="eyebrow">TU ESPACIO DE TRABAJO</p>
          <Link href={link('perfil')} className="userchip">
            <Avatar name={data.profile.display_name} />
            <div>
              <strong style={{ fontSize: 12 }}>{data.profile.display_name}</strong>
              <div className="muted" style={{ fontSize: 10 }}>
                {admin ? 'Administrador' : 'Trabajador'}
              </div>
            </div>
          </Link>
          <button
            className="btn ghost"
            onClick={() => {
              if (demo) {
                router.push('/acceso');
                return;
              }
              navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_USER_DATA' });
              sessionStorage.clear();
              void signOut();
            }}
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="eyebrow">JET / GESTIÓN LOGÍSTICA</span>
          <Link href={link('inicio')} className="brand">
            <span className="brandmark">jet</span>
            <div>
              <strong>Jet Líder</strong>
              <small>GESTIÓN OPERATIVA</small>
            </div>
          </Link>
          <div className="topbar-right">
            <span className="muted">
              {dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="muted" style={{ fontSize: 10 }}>
              <span className="statusdot" style={!online ? { background: '#c98b2b' } : undefined} />
              {demo ? 'Demo' : online ? 'En línea' : 'Sin conexión'}
            </span>
            <button
              className="iconbtn"
              aria-label="Cambiar tema claro u oscuro"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="hidden dark:block" />
              <Moon className="block dark:hidden" />
            </button>
          </div>
        </header>
        <PwaStatus />
        {demo && (
          <div className="banner">
            <span>
              <strong>Demostración · solo lectura.</strong> Todos los nombres y registros son
              ficticios. No hay conexión a datos de producción.
            </span>
            <Link className="link" href="/acceso">
              Ir al acceso →
            </Link>
          </div>
        )}
        <main className="main" id="contenido">
          <div className="pagehead">
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                ESPACIO OPERATIVO{view === 'turnos' ? ' / PLANIFICACIÓN' : ''}
              </div>
              <h1>{titles[view][0]}</h1>
              <p>{titles[view][1]}</p>
            </div>
            {action && (
              <button className="btn primary" onClick={() => edit({ kind: action.kind })}>
                <Plus />
                {action.label}
              </button>
            )}
          </div>
          {view === 'inicio' && <Dashboard {...props} />}{' '}
          {view === 'turnos' && <Calendar {...props} />} {view === 'tareas' && <Tasks {...props} />}{' '}
          {view === 'bitacora' && <Logbook {...props} />}{' '}
          {view === 'equipo' && admin && <Workers {...props} />}{' '}
          {['perfil', 'configuracion'].includes(view) && <Settings {...props} />}{' '}
          {view === 'mas' && (
            <div className="panel">
              {[
                { id: 'equipo' as View, label: 'Equipo', icon: Users, show: admin },
                { id: 'perfil' as View, label: 'Mi perfil', icon: UserRound, show: true },
                {
                  id: 'configuracion' as View,
                  label: 'Configuración',
                  icon: Settings2,
                  show: true,
                },
                {
                  id: 'configuracion' as View,
                  label: 'Instalar aplicación',
                  icon: Download,
                  show: true,
                },
              ]
                .filter((n) => n.show)
                .map((n) => (
                  <Link className="taskline" href={link(n.id)} key={n.label}>
                    <n.icon size={18} />
                    <span style={{ flex: 1 }}>{n.label}</span>
                    <ChevronRight size={16} />
                  </Link>
                ))}
              <button
                className="btn ghost"
                style={{ width: '100%' }}
                onClick={() => {
                  if (demo) {
                    router.push('/acceso');
                    return;
                  }
                  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_USER_DATA' });
                  sessionStorage.clear();
                  void signOut();
                }}
              >
                <LogOut />
                Cerrar sesión
              </button>
            </div>
          )}
          {['tareas', 'bitacora', 'equipo'].includes(view) && (
            <div className="row spread" style={{ marginTop: 22, fontSize: 11 }}>
              <p className="muted">
                {view === 'equipo'
                  ? `${data.workers.length} perfiles laborales`
                  : `Página ${Number(params.page ?? 0) + 1} · resultados según tus permisos`}
              </p>
              <div className="row">
                {Number(params.page ?? 0) > 0 && (
                  <Link
                    className="btn"
                    href={link(view, { page: String(Number(params.page) - 1) })}
                  >
                    Anterior
                  </Link>
                )}
                {data.hasMore && (
                  <Link
                    className="btn"
                    href={link(view, { page: String(Number(params.page ?? 0) + 1) })}
                  >
                    Siguiente
                  </Link>
                )}
              </div>
            </div>
          )}
          {view === 'inicio' && admin && (
            <section className="panel" style={{ marginTop: 24 }}>
              <div className="panelhead">
                <h2>Actividad reciente</h2>
                <span className="muted" style={{ fontSize: 11 }}>
                  Historial generado en el servidor
                </span>
              </div>
              {data.activity.length ? (
                data.activity.slice(0, 8).map((a) => (
                  <div className="activityitem" key={a.id}>
                    <strong>
                      {{ INSERT: 'Creación', UPDATE: 'Actualización', DELETE: 'Eliminación' }[
                        a.action
                      ] ?? a.action}
                    </strong>{' '}
                    ·{' '}
                    {{
                      workers: 'Trabajador',
                      shifts: 'Turno',
                      tasks: 'Tarea',
                      logbook_entries: 'Bitácora',
                      worker_absences: 'Ausencia',
                    }[a.entity] ?? 'Registro operativo'}
                    <span style={{ float: 'right' }}>
                      {dateLabel(a.created_at, { day: 'numeric', month: 'short' })} ·{' '}
                      {dateLabel(a.created_at, {
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted panelbody">
                  La actividad aparecerá cuando se registren operaciones reales.
                </p>
              )}
            </section>
          )}
        </main>
        <nav className="mobile-nav" aria-label="Navegación móvil">
          {[
            ...navigation.slice(0, 4),
            { id: 'mas' as const, label: 'Más', icon: MoreHorizontal },
          ].map((n) => (
            <Link
              href={link(n.id)}
              key={n.id}
              className={
                view === n.id ||
                (n.id === 'mas' && ['perfil', 'configuracion', 'equipo'].includes(view))
                  ? 'active'
                  : ''
              }
            >
              <n.icon />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </div>
      {editor && (
        <EditorModal
          editor={editor}
          data={data}
          date={date}
          onClose={() => setEditor(null)}
          notify={notify}
        />
      )}{' '}
      {params.detail && (
        <Detail
          {...props}
          onClose={() => router.push(link(view, { detail: '' }), { scroll: false })}
        />
      )}{' '}
      {message && (
        <div className="toast row" role="status">
          <span>{message}</span>
          <button className="btn ghost" onClick={() => setMessage('')} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
