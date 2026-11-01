import { notFound, redirect } from 'next/navigation';
import { Workspace } from '@/components/workspace';
import { getWorkspace } from '@/features/shared/queries';
import { demoData } from '@/features/shared/demo';
import { filterDemo } from '@/features/shared/demo-filters';
import type { View } from '@/features/shared/types';
import { today } from '@/utils/dates';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const path = (await params).path ?? [];
  const demo = path[0] === 'demo';
  const parts = demo ? path.slice(1) : path;
  if (parts.length > 1) notFound();
  const view = (parts[0] ?? 'inicio') as View;
  if (
    ![
      'inicio',
      'turnos',
      'tareas',
      'bitacora',
      'equipo',
      'perfil',
      'configuracion',
      'mas',
    ].includes(view)
  )
    notFound();
  const raw = await searchParams;
  const q: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? v : undefined]),
  );
  const parsed = z.iso.date().safeParse(q.date);
  const date = view === 'inicio' ? today() : parsed.success ? parsed.data : today();
  if (q.detail && !z.uuid().safeParse(q.detail).success) notFound();
  for (const key of ['worker', 'type', 'taskWorker', 'author'])
    if (q[key] && !z.uuid().safeParse(q[key]).success) delete q[key];
  for (const key of ['dueFrom', 'dueTo'])
    if (q[key] && !z.iso.date().safeParse(q[key]).success) delete q[key];
  const data = demo ? filterDemo(demoData(date), q) : await getWorkspace(view, date, q);
  if (view === 'equipo' && data.profile.role !== 'admin') redirect('/');
  return (
    <Workspace key={`${demo}-${view}`} data={data} view={view} date={date} params={q} demo={demo} />
  );
}
