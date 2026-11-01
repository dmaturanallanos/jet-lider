'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Inbox, X } from 'lucide-react';
export function Empty({
  title = 'Sin resultados',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox aria-hidden />
      <strong>{title}</strong>
      <p>{children ?? 'Prueba con otro período o ajusta los filtros.'}</p>
    </div>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Avatar({ name, color }: { name: string; color?: string }) {
  return (
    <span className="avatar" style={color ? { color, background: `${color}12` } : undefined}>
      {name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-label={title}>
      <div className="dialoghead">
        <h2>{title}</h2>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Cerrar">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelado',
  scheduled: 'Programado',
  confirmed: 'Confirmado',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
  sent: 'Enviada',
  linked: 'Vinculada',
  failed: 'Fallida',
};
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        ['completed', 'confirmed', 'linked'].includes(value)
          ? 'green'
          : ['urgent', 'cancelled', 'failed'].includes(value)
            ? 'red'
            : ['in_progress', 'high'].includes(value)
              ? 'amber'
              : 'blue'
      }
    >
      {statusLabels[value] ?? value}
    </Badge>
  );
}
