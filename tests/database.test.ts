import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
// @ts-expect-error JavaScript harness initializes the unmodified SQL migrations.
import { createTestDatabase } from '../scripts/local-db.mjs';
let db: PGlite;
const admin = '00000000-0000-4000-8000-000000000100',
  u1 = '00000000-0000-4000-8000-000000000101',
  u2 = '00000000-0000-4000-8000-000000000102';
const w1 = '00000000-0000-4000-8000-000000000001',
  w2 = '00000000-0000-4000-8000-000000000002',
  w3 = '00000000-0000-4000-8000-000000000003',
  t1 = '00000000-0000-4000-8000-000000000201',
  t2 = '00000000-0000-4000-8000-000000000202',
  entry = '00000000-0000-4000-8000-000000000301';
let type: string;
async function asUser(uid: string | null, role = 'authenticated') {
  await db.exec('reset role');
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
    [uid ?? '', role],
  );
  if (role !== 'service_role')
    await db.exec(`set role ${role === 'anon' ? 'anon' : 'authenticated'}`);
}
async function denied(sql: string, args: unknown[] = [], message?: RegExp) {
  await db.exec('savepoint rejected');
  let rejected = false;
  try {
    await db.query(sql, args);
  } catch (e) {
    rejected = true;
    if (message) expect(String(e)).toMatch(message);
  }
  await db.exec('rollback to savepoint rejected; release savepoint rejected');
  expect(rejected).toBe(true);
}
async function shift(
  worker: string | null,
  start = '2026-11-02T10:00Z',
  end = '2026-11-02T18:00Z',
  status = 'scheduled',
  rest = 30,
) {
  return db.query(
    'insert into public.shifts(worker_id,type_id,starts_at,ends_at,status,break_minutes) values($1,$2,$3,$4,$5,$6) returning id',
    [worker, type, start, end, status, rest],
  );
}
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)', [
    admin,
    'admin@example.test',
    u1,
    'one@example.test',
    u2,
    'two@example.test',
  ]);
  await db.query("insert into profiles(id,role,display_name) values($1,'admin','Admin')", [admin]);
  await asUser(admin);
  await db.query(
    "insert into workers(id,full_name) values($1,'Trabajador uno'),($2,'Trabajador dos'),($3,'Sin cuenta')",
    [w1, w2, w3],
  );
  await asUser(null, 'service_role');
  await db.query(
    "insert into profiles(id,role,display_name,worker_id) values($1,'worker','Uno',$2),($3,'worker','Dos',$4)",
    [u1, w1, u2, w2],
  );
  await asUser(admin);
  await db.query(
    "insert into worker_private_details(id,email,phone,notes) values($1,'one@example.test','privado','nota privada')",
    [w1],
  );
  await asUser(admin);
  type = (await db.query<{ id: string }>('select id from shift_types limit 1')).rows[0].id;
  await db.query("insert into tasks(id,title) values($1,'Tarea uno'),($2,'Tarea dos')", [t1, t2]);
  await db.query('insert into task_assignees(task_id,worker_id) values($1,$2),($3,$4)', [
    t1,
    w1,
    t2,
    w2,
  ]);
  await db.query(
    "insert into logbook_entries(id,title,description,entry_date,visibility) values($1,'Privado','Información privada','2026-11-02','admin')",
    [entry],
  );
});
beforeEach(async () => {
  await db.exec('begin');
  await asUser(admin);
});
afterEach(async () => {
  await db.exec('rollback');
});
afterAll(async () => {
  await db?.close();
});
describe('Integración SQL real en PostgreSQL embebido (sin servicios Supabase)', () => {
  it('solo el administrador elimina turnos y la auditoría conserva los datos anteriores', async () => {
    const result = await shift(w1);
    const target = (result.rows[0] as { id: string }).id;
    await asUser(u1);
    expect(
      (await db.query('delete from shifts where id=$1 returning id', [target])).rows,
    ).toHaveLength(0);
    await asUser(admin);
    expect(
      (await db.query('delete from shifts where id=$1 and version=1 returning id', [target])).rows,
    ).toHaveLength(1);
    const audit = await db.query<{
      actor_id: string;
      before_data: { worker_id: string };
      after_data: unknown;
    }>(
      "select actor_id,before_data,after_data from activity_logs where entity_id=$1 and action='DELETE'",
      [target],
    );
    expect(audit.rows[0].actor_id).toBe(admin);
    expect(audit.rows[0].before_data.worker_id).toBe(w1);
    expect(audit.rows[0].after_data).toBeNull();
  });
  it('una versión desactualizada no elimina el turno y los vínculos de bitácora se conservan', async () => {
    const result = await shift(w1);
    const target = (result.rows[0] as { id: string }).id;
    await db.query("update shifts set notes='Edición simultánea' where id=$1", [target]);
    expect(
      (await db.query('delete from shifts where id=$1 and version=1 returning id', [target])).rows,
    ).toHaveLength(0);
    await db.query('update logbook_entries set shift_id=$1 where id=$2', [target, entry]);
    await denied('delete from shifts where id=$1 and version=2', [target], /foreign key/);
    expect((await db.query('select id from shifts where id=$1', [target])).rows).toHaveLength(1);
  });
  it('elimina una ausencia y su nota privada de manera atómica conservando auditoría', async () => {
    const r = await db.query<{ id: string }>('select save_absence($1,$2) as id', [
      JSON.stringify({
        worker_id: w1,
        type: 'Libre',
        all_day: true,
        start_date: '2026-11-10',
        end_date: '2026-11-10',
      }),
      'Nota privada',
    ]);
    const target = r.rows[0].id;
    expect(
      (await db.query('select * from absence_private_notes where id=$1', [target])).rows,
    ).toHaveLength(1);
    await db.query('delete from worker_absences where id=$1 and version=1', [target]);
    expect(
      (await db.query('select * from absence_private_notes where id=$1', [target])).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select id from activity_logs where entity_id=$1 and action='DELETE'", [
          target,
        ])
      ).rows.length,
    ).toBeGreaterThan(0);
  });
  it('los períodos incompletos de ausencia se rechazan aunque sus columnas sean anulables', async () => {
    await denied(
      "insert into worker_absences(worker_id,type,start_date) values($1,'Libre','2026-11-02')",
      [w1],
      /check constraint/,
    );
    await denied(
      "insert into worker_absences(worker_id,type,all_day,starts_at) values($1,'Permiso',false,'2026-11-02T10:00Z')",
      [w1],
      /check constraint/,
    );
  });
  it('crear el mismo trabajador dos veces con la misma solicitud no duplica su perfil', async () => {
    const key = '00000000-0000-4000-8000-000000000888';
    const payload = JSON.stringify({ request_id: key, full_name: 'Sin cuenta repetido' });
    await db.query('select save_worker($1,$2,null)', [payload, '{}']);
    await db.query('select save_worker($1,$2,null)', [payload, '{}']);
    expect((await db.query('select * from workers where id=$1', [key])).rows).toHaveLength(1);
  });
  it('no duplica vacantes al volver a copiar una semana con otra solicitud', async () => {
    await shift(null);
    await denied(
      'insert into shifts(type_id,starts_at,ends_at,break_minutes) values($1,$2,$3,30)',
      [type, '2026-11-02T10:00Z', '2026-11-02T18:00Z'],
      /unique_active_shift_occurrence/,
    );
  });
  it('la ausencia horaria usa intervalos semiabiertos y respeta un turno consecutivo', async () => {
    await db.query(
      "insert into worker_absences(worker_id,type,all_day,starts_at,ends_at) values($1,'Permiso',false,'2026-11-02T08:00Z','2026-11-02T10:00Z')",
      [w1],
    );
    await shift(w1);
  });
  it('editar una tarea permite conservar responsables inactivos sin crear asignaciones nuevas', async () => {
    await db.query('update workers set active=false where id=$1', [w1]);
    const payload = {
      id: t1,
      title: 'Tarea corregida',
      description: '',
      status: 'pending',
      priority: 'high',
    };
    const result = await db.query('select save_task($1,$2,1)', [JSON.stringify(payload), [w1]]);
    expect(result.rows).toHaveLength(1);
  });
  it('los cambios de bitácora conservan autor y las versiones moderadas en el historial', async () => {
    await asUser(u1);
    const r = await db.query<{ id: string }>(
      "insert into logbook_entries(title,description,entry_date) values('Original','Texto original','2026-11-02') returning id",
    );
    const target = r.rows[0].id;
    await denied('update logbook_entries set created_by=$1 where id=$2', [u2, target], /FORBIDDEN/);
    await denied('update logbook_entries set pinned=true where id=$1', [target], /FORBIDDEN/);
    await asUser(admin);
    await db.query("update logbook_entries set description='Moderado',pinned=true where id=$1", [
      target,
    ]);
    const history = await db.query<{
      before_data: { description: string };
      after_data: { description: string };
    }>("select before_data,after_data from activity_logs where entity_id=$1 and action='UPDATE'", [
      target,
    ]);
    expect(history.rows[0].before_data.description).toBe('Texto original');
    expect(history.rows[0].after_data.description).toBe('Moderado');
  });
  it('ver una observación compartida no permite adjuntar fotos a una observación ajena', async () => {
    await asUser(u1);
    const r = await db.query<{ id: string }>(
      "insert into logbook_entries(title,description,entry_date) values('Entrega','Detalle','2026-11-02') returning id",
    );
    await asUser(u2);
    expect(
      (await db.query('select id from logbook_entries where id=$1', [r.rows[0].id])).rows,
    ).toHaveLength(1);
    await denied(
      "insert into storage.objects(bucket_id,name) values('logbook-evidence',$1)",
      [`${r.rows[0].id}/${u2}/foto.jpg`],
      /row-level security/,
    );
  });
  it('los adjuntos de tareas solo se consultan por sus responsables', async () => {
    await db.query('insert into task_attachments(task_id,path) values($1,$2)', [
      t1,
      `${t1}/${admin}/foto.jpg`,
    ]);
    await asUser(u2);
    expect((await db.query('select * from task_attachments')).rows).toHaveLength(0);
    await asUser(u1);
    expect((await db.query('select * from task_attachments')).rows).toHaveLength(1);
  });
  it('habilita RLS en todas las tablas públicas', async () => {
    const result = await db.query(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    );
    expect(result.rows).toHaveLength(0);
  });
  it('anónimo no puede leer datos internos', async () => {
    await asUser(null, 'anon');
    await denied('select * from workers', [], /permission denied/);
  });
  it('trabajador no lee datos privados ni notas privadas del propio perfil', async () => {
    await asUser(u1);
    expect((await db.query('select * from worker_private_details')).rows).toHaveLength(0);
    expect((await db.query('select * from my_contact()')).rows).toEqual([
      { email: 'one@example.test', phone: 'privado' },
    ]);
  });
  it('trabajador no modifica turnos ni roles ni vinculaciones', async () => {
    await asUser(u1);
    await denied("update profiles set role='admin' where id=$1", [u1], /permission denied/);
    await denied(
      "insert into shifts(type_id,starts_at,ends_at) values($1,'2026-11-02T10:00Z','2026-11-02T12:00Z')",
      [type],
      /row-level security/,
    );
    await denied('select invitee_account($1)', [w1], /permission denied/);
  });
  it('no mueve a un trabajador existente a otro espacio al otorgar un rol', async () => {
    await denied(
      "select grant_administrator('two@example.test','Segundo admin')",
      [],
      /ya pertenece/,
    );
    expect(
      (await db.query<{ role: string }>('select role from profiles where id=$1', [u2])).rows[0]
        .role,
    ).toBe('worker');
  });
  it('puede dar permisos a una cuenta confirmada sin perfil ni crear un trabajador ficticio', async () => {
    const user = '00000000-0000-4000-8000-000000000777';
    await asUser(null, 'service_role');
    await db.query("insert into auth.users(id,email) values($1,'new-admin@example.test')", [user]);
    await asUser(admin);
    await db.query("select grant_administrator('new-admin@example.test','Nuevo administrador')");
    await db.query("select grant_administrator('new-admin@example.test','Nuevo administrador')");
    await asUser(user);
    const result = await db.query<{ role: string; worker_id: string | null; display_name: string }>(
      'select role,worker_id,display_name from profiles where id=$1',
      [user],
    );
    expect(result.rows[0]).toEqual({
      role: 'admin',
      worker_id: null,
      display_name: 'Nuevo administrador',
    });
  });
  it('reenviar una invitación a un trabajador conserva su espacio y rol', async () => {
    await db.query(
      "insert into worker_invitations(worker_id,email) values($1,'two@example.test')",
      [w2],
    );

    await asUser(null, 'service_role');
    await db.query('select invitee_account($1)', [w2]);
    expect(
      (await db.query<{ role: string }>('select role from profiles where id=$1', [u2])).rows[0]
        .role,
    ).toBe('worker');
  });
  it('nadie puede promoverse como trabajador, anónimo o con actualización directa de rol', async () => {
    await asUser(u1);
    await denied("select grant_administrator('one@example.test','Uno')", [], /FORBIDDEN/);
    await asUser(null, 'anon');
    await denied("select grant_administrator('one@example.test','Uno')", [], /permission denied/);
    await asUser(admin);
    await denied("update profiles set role='admin' where id=$1", [u2], /permission denied/);
  });
  it('rechaza cuentas inexistentes, no confirmadas y trabajadores ya vinculados', async () => {
    await denied(
      "select grant_administrator('missing@example.test','Ausente')",
      [],
      /Crea primero/,
    );
    await asUser(null, 'service_role');
    await db.query('update auth.users set email_confirmed_at=null where id=$1', [u2]);
    await asUser(admin);
    await denied("select grant_administrator('two@example.test','Dos')", [], /confirmada/);
    await asUser(null, 'service_role');
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [u2]);
    await asUser(admin);
    await db.query('update workers set active=false where id=$1', [w2]);
    await denied("select grant_administrator('two@example.test','Dos')", [], /ya pertenece/);
  });
  it('el perfil laboral sin cuenta puede recibir turnos y tareas', async () => {
    await shift(w3);
    await db.query('insert into task_assignees(task_id,worker_id) values($1,$2)', [t1, w3]);
    expect((await db.query('select * from profiles where worker_id=$1', [w3])).rows).toHaveLength(
      0,
    );
  });
  it('impide duplicar un correo y la vinculación', async () => {
    await denied(
      "insert into worker_private_details(id,email) values($1,'ONE@example.test')",
      [w2],
      /unique_worker_email/,
    );
    await asUser(null, 'service_role');
    await denied('update profiles set worker_id=$1 where id=$2', [w1, u2], /unique/);
  });
  it('invitación repetida vincula una sola cuenta sin crear trabajadores', async () => {
    await db.query(
      "insert into worker_invitations(worker_id,email) values($1,'two@example.test')",
      [w2],
    );
    await asUser(null, 'service_role');
    for (let n = 0; n < 2; n++)
      expect(
        (await db.query<{ invitee_account: string }>('select invitee_account($1)', [w2])).rows[0]
          .invitee_account,
      ).toBe(u2);
    expect((await db.query('select * from profiles where worker_id=$1', [w2])).rows).toHaveLength(
      1,
    );
  });
  it('rechaza vincular el correo de un administrador como trabajador', async () => {
    await db.query(
      "insert into worker_invitations(worker_id,email) values($1,'admin@example.test')",
      [w3],
    );
    await asUser(null, 'service_role');
    await denied('select invitee_account($1)', [w3], /ya vinculada/);
  });
  it('desactivar bloquea la sesión ya existente y nuevas asignaciones', async () => {
    await db.query('update workers set active=false where id=$1', [w1]);
    await denied(
      'insert into task_assignees(task_id,worker_id) values($1,$2)',
      [t2, w1],
      /INACTIVE/,
    );
    await denied(
      'insert into shifts(worker_id,type_id,starts_at,ends_at) values($1,$2,$3,$4)',
      [w1, type, '2026-11-02T10:00Z', '2026-11-02T12:00Z'],
      /INACTIVE/,
    );
    await asUser(u1);
    expect((await db.query('select * from workers')).rows).toHaveLength(0);
    expect((await db.query('select * from tasks')).rows).toHaveLength(0);
    expect((await db.query('select is_active() as active')).rows[0]).toEqual({ active: false });
  });
  it('acepta turno nocturno y consecutivo, rechaza superposición', async () => {
    await shift(w1, '2026-11-02T23:00Z', '2026-11-03T07:00Z');
    await shift(w1, '2026-11-03T07:00Z', '2026-11-03T10:00Z');
    await denied(
      'insert into shifts(worker_id,type_id,starts_at,ends_at) values($1,$2,$3,$4)',
      [w1, type, '2026-11-03T06:59Z', '2026-11-03T09:00Z'],
      /exclusion constraint/,
    );
  });
  it('un turno cancelado no provoca superposición', async () => {
    await shift(w1, undefined, undefined, 'cancelled');
    await shift(w1);
  });
  it('rechaza fin no posterior y descanso inválido en la base', async () => {
    await denied(
      'insert into shifts(type_id,starts_at,ends_at,break_minutes) values($1,$2,$3,0)',
      [type, '2026-11-02T12:00Z', '2026-11-02T12:00Z'],
      /check constraint/,
    );
    await denied(
      'insert into shifts(type_id,starts_at,ends_at,break_minutes) values($1,$2,$3,481)',
      [type, '2026-11-02T10:00Z', '2026-11-02T18:00Z'],
      /check constraint/,
    );
  });
  it('ausencias bloquean turnos y los turnos bloquean ausencias', async () => {
    await db.query(
      "insert into worker_absences(worker_id,type,start_date,end_date) values($1,'Vacaciones','2026-11-02','2026-11-02')",
      [w1],
    );
    await denied(
      'insert into shifts(worker_id,type_id,starts_at,ends_at) values($1,$2,$3,$4)',
      [w1, type, '2026-11-02T10:00Z', '2026-11-02T18:00Z'],
      /ABSENCE/,
    );
    await shift(w2);
    await denied(
      "insert into worker_absences(worker_id,type,start_date,end_date) values($1,'Libre','2026-11-02','2026-11-02')",
      [w2],
      /SHIFT_CONFLICT/,
    );
  });
  it('lote es atómico, repetible sin duplicar y valida conflictos internos', async () => {
    const item = {
      worker_id: w1,
      type_id: type,
      starts_at: '2026-11-02T10:00Z',
      ends_at: '2026-11-02T18:00Z',
      break_minutes: 30,
    };
    const request = '00000000-0000-4000-8000-000000000999';
    await db.query('select save_shift_batch($1,$2,null)', [request, JSON.stringify([item])]);
    expect(
      (
        await db.query<{ n: number }>('select save_shift_batch($1,$2,null) as n', [
          request,
          JSON.stringify([item]),
        ])
      ).rows[0].n,
    ).toBe(0);
    await denied(
      'select save_shift_batch(gen_random_uuid(),$1,null)',
      [
        JSON.stringify([
          { ...item, worker_id: w2 },
          { ...item, worker_id: w2 },
        ]),
      ],
      /exclusion constraint/,
    );
    expect((await db.query('select * from shifts where worker_id=$1', [w2])).rows).toHaveLength(0);
  });
  it('edición con versión antigua no sobrescribe y aumenta versión', async () => {
    await db.query("update tasks set title='Nueva versión' where id=$1 and version=1", [t1]);
    const r = await db.query(
      "update tasks set title='Perdida' where id=$1 and version=1 returning id",
      [t1],
    );
    expect(r.rows).toHaveLength(0);
    expect(
      (await db.query<{ version: number }>('select version from tasks where id=$1', [t1])).rows[0]
        .version,
    ).toBe(2);
  });
  it('solo responsables ven su tarea y pueden avanzar sin alterar otros campos', async () => {
    await asUser(u1);
    expect((await db.query('select id from tasks')).rows).toEqual([{ id: t1 }]);
    await db.query("update tasks set status='completed' where id=$1", [t1]);
    const task = (
      await db.query<{ completed_by: string }>('select completed_by from tasks where id=$1', [t1])
    ).rows[0];
    expect(task.completed_by).toBe(u1);
    await denied("update tasks set title='Cambio indebido' where id=$1", [t1], /FORBIDDEN/);
    expect(
      (await db.query("update tasks set status='completed' where id=$1 returning id", [t2])).rows,
    ).toHaveLength(0);
  });
  it('la bitácora privada no se lee ni se crea como trabajador', async () => {
    await asUser(u1);
    expect((await db.query('select id from logbook_entries')).rows).toHaveLength(0);
    await denied(
      "insert into logbook_entries(title,description,entry_date,visibility) values('Privado','Dato','2026-11-02','admin')",
      [],
      /FORBIDDEN|row-level security/,
    );
    await db.query(
      "insert into logbook_entries(title,description,entry_date) values('Equipo','Compartido','2026-11-02')",
    );
    await asUser(u2);
    expect(
      (await db.query("update logbook_entries set title='Ajeno' returning id")).rows,
    ).toHaveLength(0);
  });
  it('Storage protege evidencias y bloquea sesión desactivada', async () => {
    await asUser(null, 'service_role');
    const own = `${t1}/${u1}/foto.jpg`,
      other = `${t2}/${u2}/foto.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('task-evidence',$1),('task-evidence',$2)",
      [own, other],
    );
    await asUser(u1);
    expect((await db.query('select name from storage.objects')).rows).toEqual([{ name: own }]);
    await denied(
      "insert into storage.objects(bucket_id,name) values('task-evidence',$1)",
      [`${t2}/${u1}/ilegal.jpg`],
      /row-level security/,
    );
    await asUser(admin);
    await db.query('update workers set active=false where id=$1', [w1]);
    await asUser(u1);
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(0);
  });
  it('auditoría se genera sin intervención del navegador y no incluye notas privadas', async () => {
    await db.query("update worker_private_details set notes='SECRETO' where id=$1", [w1]);
    const r = await db.query<{ before_data: unknown; after_data: unknown }>(
      "select before_data,after_data from activity_logs where entity='worker_private_details'",
    );
    expect(JSON.stringify(r.rows)).not.toContain('SECRETO');
    await denied(
      "insert into activity_logs(action,entity,entity_id) values('x','x',$1)",
      [w1],
      /permission denied/,
    );
  });
});
