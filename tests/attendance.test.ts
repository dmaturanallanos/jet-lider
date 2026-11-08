import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
// @ts-expect-error JavaScript harness applies the real SQL migrations.
import { createTestDatabase } from '../scripts/local-db.mjs';
let db: PGlite;
const a = '30000000-0000-4000-8000-000000000001',
  b = '30000000-0000-4000-8000-000000000002',
  u = '30000000-0000-4000-8000-000000000003';
const w = '40000000-0000-4000-8000-000000000001';
let type: string, shiftId: string;
async function as(user: string | null, service = false) {
  await db.exec('reset role');
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
    [user ?? '', service ? 'service_role' : 'authenticated'],
  );
  if (!service) await db.exec('set role authenticated');
}
async function denied(sql: string, args: unknown[] = [], message?: RegExp) {
  await db.exec('savepoint reject');
  let caught = false;
  try {
    await db.query(sql, args);
  } catch (e) {
    caught = true;
    if (message) expect(String(e)).toMatch(message);
  }
  await db.exec('rollback to savepoint reject;release savepoint reject');
  expect(caught).toBe(true);
}
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query(
    "insert into auth.users(id,email) values($1,'a@test.invalid'),($2,'b@test.invalid'),($3,'w@test.invalid')",
    [a, b, u],
  );
  await db.query(
    "insert into profiles(id,role,display_name) values($1,'admin','Admin A'),($2,'admin','Admin B')",
    [a, b],
  );
  await as(a);
  await db.query("insert into workers(id,full_name) values($1,'Trabajador A')", [w]);
  type = (await db.query<{ id: string }>('select id from shift_types limit 1')).rows[0].id;
  shiftId = (
    await db.query<{ id: string }>(
      "insert into shifts(worker_id,type_id,starts_at,ends_at,break_minutes) values($1,$2,'2020-11-02T10:00Z','2020-11-02T18:00Z',30) returning id",
      [w, type],
    )
  ).rows[0].id;
  await as(null, true);
  await db.query(
    "insert into profiles(id,worker_id,role,display_name) values($1,$2,'worker','Trabajador')",
    [u, w],
  );
});
beforeEach(async () => {
  await db.exec('begin');
  await as(a);
});
afterEach(async () => {
  await db.exec('rollback');
});
afterAll(async () => {
  await db?.close();
});
it('separa inactivos sin perder datos, controla versiones y protege cambios de estado entre espacios', async () => {
  await db.query(
    "insert into worker_private_details(id,email,employment_type) values($1,'privado@test.invalid','boleta')",
    [w],
  );
  await as(b);
  expect(
    (await db.query('update workers set active=false where id=$1 and version=1 returning id', [w]))
      .rows,
  ).toHaveLength(0);
  await as(u);
  expect(
    (await db.query('update workers set active=false where id=$1 returning id', [w])).rows,
  ).toHaveLength(0);
  await as(a);
  expect(
    (await db.query('update workers set active=false where id=$1 and version=1 returning id', [w]))
      .rows,
  ).toHaveLength(1);
  expect(
    (await db.query('select id from workers where active=true and id=$1', [w])).rows,
  ).toHaveLength(0);
  expect(
    (await db.query('select id from workers where active=false and id=$1', [w])).rows,
  ).toHaveLength(1);
  expect((await db.query('select id from shifts where worker_id=$1', [w])).rows).toHaveLength(1);
  expect(
    (await db.query('select employment_type from worker_private_details where id=$1', [w])).rows[0],
  ).toEqual({ employment_type: 'boleta' });
  expect(
    (await db.query('update workers set active=true where id=$1 and version=1 returning id', [w]))
      .rows,
  ).toHaveLength(0);
  expect(
    (await db.query('update workers set active=true where id=$1 and version=2 returning id', [w]))
      .rows,
  ).toHaveLength(1);
});
it('marca presente o ausente, corrige con versión y permite volver a sin registrar', async () => {
  await db.query("select save_attendance($1,'present','Llegó',0)", [shiftId]);
  let r = (
    await db.query<{ status: string; version: number; worker_id: string }>(
      'select status,version,worker_id from shift_attendance',
    )
  ).rows[0];
  expect(r).toEqual({ status: 'present', version: 1, worker_id: w });
  await denied("select save_attendance($1,'absent','Cambio antiguo',0)", [shiftId], /cambi/);
  await db.query("select save_attendance($1,'absent','Corrección',1)", [shiftId]);
  r = (
    await db.query<{ status: string; version: number; worker_id: string }>(
      'select status,version,worker_id from shift_attendance',
    )
  ).rows[0];
  expect(r.version).toBe(2);
  expect(r.status).toBe('absent');
  await db.query("select save_attendance($1,'pending','',2)", [shiftId]);
  expect((await db.query('select id from shift_attendance')).rows).toHaveLength(0);
  const audit = await db.query<{ action: string; actor_id: string }>(
    "select action,actor_id from activity_logs where entity='shift_attendance' order by created_at,id",
  );
  expect(audit.rows.map((x) => x.action).sort()).toEqual(['DELETE', 'INSERT', 'UPDATE']);
  expect(audit.rows.every((x) => x.actor_id === a)).toBe(true);
});
it('trabajadores y otros administradores no registran ni leen la asistencia ajena', async () => {
  await db.query("select save_attendance($1,'present','',0)", [shiftId]);
  await as(b);
  expect((await db.query('select id from shift_attendance')).rows).toHaveLength(0);
  await denied("select save_attendance($1,'absent','',1)", [shiftId], /no disponible/);
  await as(u);
  expect((await db.query('select id from shift_attendance')).rows).toHaveLength(0);
  await denied("select save_attendance($1,'present','',1)", [shiftId], /FORBIDDEN/);
  await denied("select attendance_week('2020-11-02')", [], /FORBIDDEN/);
  await denied(
    "insert into shift_attendance(shift_id,worker_id,status) values($1,$2,'present')",
    [shiftId, w],
    /permission denied/,
  );
});
it('rechaza turnos futuros, cancelados, sin asignar y marcas inválidas', async () => {
  await denied("select save_attendance($1,'incorrecto','',0)", [shiftId], /inválida/);
  for (const [date, worker, status] of [
    ['2099-11-02T10:00Z', w, 'scheduled'],
    ['2020-11-03T10:00Z', null, 'scheduled'],
    ['2020-11-04T10:00Z', w, 'cancelled'],
  ] as const) {
    const id = (
      await db.query<{ id: string }>(
        "insert into shifts(worker_id,type_id,starts_at,ends_at,status) values($1,$2,$3::timestamptz,$3::timestamptz+interval '8 hours',$4) returning id",
        [worker, type, date, status],
      )
    ).rows[0].id;
    await denied("select save_attendance($1,'present','',0)", [id], /Solo puedes/);
  }
});
it('protege el turno marcado y conserva auditoría al eliminarlo', async () => {
  await db.query("select save_attendance($1,'present','',0)", [shiftId]);
  await denied(
    "update shifts set starts_at=starts_at+interval '1 hour' where id=$1",
    [shiftId],
    /Quita primero/,
  );
  await denied("update shifts set status='cancelled' where id=$1", [shiftId], /Quita primero/);
  await db.query('delete from shifts where id=$1', [shiftId]);
  expect((await db.query('select id from shift_attendance')).rows).toHaveLength(0);
  expect(
    (
      await db.query(
        "select id from activity_logs where entity='shift_attendance' and action='DELETE'",
      )
    ).rows,
  ).toHaveLength(1);
});
it('el informe respeta el espacio y agrupa nocturnos según el inicio local de Chile', async () => {
  await db.query("select save_attendance($1,'absent','',0)", [shiftId]);
  await db.query(
    "insert into shifts(worker_id,type_id,starts_at,ends_at) values($1,$2,'2020-11-03T01:00Z','2020-11-03T09:00Z')",
    [w, type],
  );
  const result = (
    await db.query<{ report: { worker_id: string; attendance_status: string | null }[] }>(
      "select attendance_week('2020-11-02') as report",
    )
  ).rows[0].report;
  expect(result).toHaveLength(2);
  expect(result.filter((x) => x.attendance_status === null)).toHaveLength(1);
  await as(b);
  expect(
    (await db.query<{ report: unknown[] }>("select attendance_week('2020-11-02') as report"))
      .rows[0].report,
  ).toEqual([]);
});
it('elimina observaciones con metadatos de fotos y devuelve solo sus rutas para limpieza', async () => {
  const id = (
    await db.query<{ id: string }>(
      "insert into logbook_entries(title,description,entry_date) values('Error','Dato incorrecto','2020-11-02') returning id",
    )
  ).rows[0].id;
  const path = `${id}/${a}/foto.jpg`;
  await db.query('insert into logbook_attachments(entry_id,path) values($1,$2)', [id, path]);
  const files = (
    await db.query<{ files: { bucket: string; path: string }[] }>(
      "select delete_operational_record('entry',$1,1) as files",
      [id],
    )
  ).rows[0].files;
  expect(files).toEqual([{ bucket: 'logbook-evidence', path }]);
  expect((await db.query('select id from logbook_entries where id=$1', [id])).rows).toHaveLength(0);
  expect(
    (await db.query('select id from logbook_attachments where entry_id=$1', [id])).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select id from activity_logs where entity_id=$1 and action='DELETE'", [id]))
      .rows,
  ).toHaveLength(1);
});
it('borra tareas y dependencias, pero protege referencias de bitácora y versiones', async () => {
  const id = (
    await db.query<{ id: string }>("insert into tasks(title) values('Incorrecta') returning id")
  ).rows[0].id;
  await db.query('insert into task_assignees(task_id,worker_id) values($1,$2)', [id, w]);
  await db.query("insert into task_comments(task_id,body) values($1,'Comentario')", [id]);
  await denied("select delete_operational_record('task',$1,2)", [id], /cambi/);
  const related = (
    await db.query<{ id: string }>(
      "insert into logbook_entries(title,description,entry_date,task_id) values('Referencia','Conservar','2020-11-02',$1) returning id",
      [id],
    )
  ).rows[0].id;
  await denied("select delete_operational_record('task',$1,1)", [id], /relacionada/);
  expect((await db.query('select id from task_comments where task_id=$1', [id])).rows).toHaveLength(
    1,
  );
  await db.query("select delete_operational_record('entry',$1,1)", [related]);
  await db.query("select delete_operational_record('task',$1,1)", [id]);
  expect((await db.query('select id from task_comments where task_id=$1', [id])).rows).toHaveLength(
    0,
  );
  expect(
    (await db.query('select id from task_assignees where task_id=$1', [id])).rows,
  ).toHaveLength(0);
});
it('ningún borrado cruza espacios ni permite al trabajador borrar registros', async () => {
  const id = (
    await db.query<{ id: string }>("insert into tasks(title) values('Conservar') returning id")
  ).rows[0].id;
  await as(b);
  await denied("select delete_operational_record('task',$1,1)", [id], /no est/);
  await as(u);
  await denied("select delete_operational_record('task',$1,1)", [id], /FORBIDDEN/);
  await as(a);
  expect((await db.query('select id from tasks where id=$1', [id])).rows).toHaveLength(1);
});
it('elimina fichas incorrectas sin historial y bloquea cuentas o registros vinculados', async () => {
  const id = (
    await db.query<{ id: string }>(
      "insert into workers(full_name) values('Ficha incorrecta') returning id",
    )
  ).rows[0].id;
  await db.query("insert into worker_private_details(id,notes) values($1,'Privado')", [id]);
  await db.query("select delete_operational_record('worker',$1,1)", [id]);
  expect((await db.query('select id from workers where id=$1', [id])).rows).toHaveLength(0);
  await denied("select delete_operational_record('worker',$1,1)", [w], /cuenta vinculada/);
  expect((await db.query('select id from shifts where id=$1', [shiftId])).rows).toHaveLength(1);
});
