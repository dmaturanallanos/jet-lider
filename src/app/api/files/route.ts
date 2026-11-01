import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { serverDb } from '@/lib/supabase/server';
import { safeImage } from '@/features/shared/images';
import { limitedForm } from '@/lib/request';
const kindSchema = z.enum(['task', 'entry', 'avatar']);
const bucketFor = { task: 'task-evidence', entry: 'logbook-evidence', avatar: 'avatars' };
async function session() {
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: active } = await db.rpc('is_active');
  if (!user || !active) throw new Error('Sin acceso');
  return { db, user };
}
function sameOrigin(r: NextRequest) {
  if (r.headers.get('origin') !== new URL(process.env.NEXT_PUBLIC_APP_URL!).origin)
    throw new Error('Origen no permitido');
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const { db, user } = await session();
    if (Number(req.headers.get('content-length') ?? 0) > 6 * 1024 * 1024)
      throw new Error('Archivo demasiado grande.');
    const f = await limitedForm(req);
    const kind = kindSchema.parse(f.get('kind'));
    const parent = z.uuid().parse(f.get('parent'));
    const file = f.get('file');
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || !file.size)
      throw new Error('El límite por imagen es 5 MB.');
    const bytes = await safeImage(file);
    const path = `${parent}/${user.id}/${crypto.randomUUID()}.jpg`;
    const bucket = bucketFor[kind];
    const { error } = await db.storage
      .from(bucket)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error('No se pudo subir la imagen. Revisa tu permiso y conexión.');
    let metadataError: { message: string } | null = null;
    if (kind === 'task') {
      const r = await db
        .from('task_attachments')
        .insert({ task_id: parent, path, created_by: user.id });
      metadataError = r.error;
    }
    if (kind === 'entry') {
      const r = await db
        .from('logbook_attachments')
        .insert({ entry_id: parent, path, created_by: user.id });
      metadataError = r.error;
    }
    if (kind === 'avatar') {
      const r = await db.rpc('set_avatar', { target_worker: parent, object_path: path });
      metadataError = r.error;
    }
    if (metadataError) {
      await db.storage.from(bucket).remove([path]);
      throw new Error('No se pudo vincular la imagen. No se guardó el cambio.');
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error de carga' },
      { status: 400 },
    );
  }
}
export async function GET(req: NextRequest) {
  try {
    const { db } = await session();
    const kind = kindSchema.parse(req.nextUrl.searchParams.get('kind'));
    const id = z.uuid().parse(req.nextUrl.searchParams.get('id'));
    let path: string | null = null;
    if (kind === 'avatar') {
      const r = await db.from('workers').select('avatar_path').eq('id', id).single();
      path = r.data?.avatar_path ?? null;
    } else {
      const table = kind === 'task' ? 'task_attachments' : 'logbook_attachments';
      const r = await db.from(table).select('path').eq('id', id).single();
      path = r.data?.path ?? null;
    }
    if (!path) throw new Error('Archivo no disponible.');
    const r = await db.storage.from(bucketFor[kind]).createSignedUrl(path, 60);
    if (r.error) throw r.error;
    return NextResponse.json(
      { url: r.data.signedUrl },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible o sin permiso.' }, { status: 403 });
  }
}
export async function DELETE(req: NextRequest) {
  try {
    sameOrigin(req);
    const { db, user } = await session();
    const v = z.object({ kind: z.enum(['task', 'entry']), id: z.uuid() }).parse(await req.json());
    const table = v.kind === 'task' ? 'task_attachments' : 'logbook_attachments';
    const { data, error } = await db.from(table).select('*').eq('id', v.id).single();
    if (error || !data) throw new Error('Archivo no disponible.');
    const { data: admin } = await db.rpc('is_admin');
    if (data.created_by !== user.id && !admin) throw new Error('Sin permiso de eliminación.');
    const removed = await db.storage.from(bucketFor[v.kind]).remove([data.path]);
    if (removed.error) throw removed.error;
    const deleted = await db.from(table).delete().eq('id', v.id).select('id');
    if (deleted.error || !deleted.data?.length)
      throw new Error('No se pudo eliminar el registro del archivo.');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo eliminar.' },
      { status: 400 },
    );
  }
}
