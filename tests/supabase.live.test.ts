import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'node:crypto';
// Opt-in test, restricted to the local Supabase stack. Never runs against hosted data.
const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === '1';
describe.skipIf(!enabled)('Supabase local real: Auth, REST/RLS y carreras entre conexiones', () => {
  it('crea un entorno nuevo de prueba, prueba solicitudes directas y concurrencia real', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    expect(['localhost', '127.0.0.1']).toContain(new URL(url).hostname);
    const privileged = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const existing = await privileged.from('profiles').select('id').eq('role', 'admin');
    expect(existing.error).toBeNull();
    expect(existing.data).toHaveLength(0);
    const password = randomBytes(32).toString('hex');
    async function account(label: string) {
      const email = `jet-${label}-${randomUUID()}@example.test`;
      const { data, error } = await privileged.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      expect(data.user).toBeTruthy();
      const client = createClient(url, anon, { auth: { persistSession: false } });
      expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
      return { client, user: data.user! };
    }
    const admin = await account('admin');
    expect(
      (
        await privileged
          .from('profiles')
          .insert({ id: admin.user.id, role: 'admin', display_name: '[TEST] Admin' })
      ).error,
    ).toBeNull();
    const w1 = await admin.client.rpc('save_worker', {
      payload: { full_name: '[TEST] Sin cuenta' },
      private_data: { email: 'test-private@example.test', notes: 'No visible' },
    });
    expect(w1.error).toBeNull();
    const worker = await account('worker');
    expect(
      (
        await privileged.from('profiles').insert({
          id: worker.user.id,
          role: 'worker',
          worker_id: w1.data,
          display_name: '[TEST] Trabajador',
        })
      ).error,
    ).toBeNull();
    expect((await worker.client.from('worker_private_details').select('*')).data).toEqual([]);
    const types = await admin.client.from('shift_types').select('id').limit(1);
    const item = {
      worker_id: w1.data,
      type_id: types.data![0].id,
      starts_at: '2030-11-04T10:00:00Z',
      ends_at: '2030-11-04T18:00:00Z',
      break_minutes: 30,
    };
    const race = await Promise.all([
      admin.client.rpc('save_shift_batch', { request_id: randomUUID(), items: [item] }),
      admin.client.rpc('save_shift_batch', { request_id: randomUUID(), items: [item] }),
    ]);
    expect(race.filter((r) => !r.error)).toHaveLength(1);
    expect(race.filter((r) => r.error)).toHaveLength(1);
    expect((await worker.client.from('shifts').insert(item)).error).toBeTruthy();
    const task = await admin.client.rpc('save_task', {
      payload: { title: '[TEST] Tarea', priority: 'high', status: 'pending' },
      assignees: [w1.data],
    });
    expect(task.error).toBeNull();
    const changes = await Promise.all([
      admin.client
        .from('tasks')
        .update({ title: '[TEST] Edición uno' })
        .eq('id', task.data)
        .eq('version', 1)
        .select('id'),
      admin.client
        .from('tasks')
        .update({ title: '[TEST] Edición dos' })
        .eq('id', task.data)
        .eq('version', 1)
        .select('id'),
    ]);
    expect(changes.filter((r) => r.data?.length === 1)).toHaveLength(1);
    const taskId = task.data as string;
    const path = `${taskId}/${worker.user.id}/${randomUUID()}.jpg`;
    const upload = await worker.client.storage
      .from('task-evidence')
      .upload(path, new Uint8Array([255, 216, 255, 217]), { contentType: 'image/jpeg' });
    expect(upload.error).toBeNull();
    expect(
      (await worker.client.storage.from('task-evidence').createSignedUrl(path, 60)).error,
    ).toBeNull();
    expect(
      (await admin.client.from('workers').update({ active: false }).eq('id', w1.data)).error,
    ).toBeNull();
    expect((await worker.client.from('shifts').select('*')).data).toEqual([]);
    expect(
      (await worker.client.storage.from('task-evidence').createSignedUrl(path, 60)).error,
    ).toBeTruthy();
    // Test fixtures deliberately remain local for inspection. No reset or deletion is performed.
  }, 60000);
});
