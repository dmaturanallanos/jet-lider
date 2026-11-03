import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
// @ts-expect-error JavaScript harness executes the actual versioned migrations.
import { createTestDatabase } from '../scripts/local-db.mjs';
let db: PGlite;
const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const c = '10000000-0000-4000-8000-000000000003';
const wa = '20000000-0000-4000-8000-000000000001';
const wb = '20000000-0000-4000-8000-000000000002';
let sa: string,
  sb: string,
  ta: string,
  tb: string,
  ea: string,
  eb: string,
  typeA: string,
  typeB: string;
async function asUser(user: string | null, privileged = false) {
  await db.exec('reset role');
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
    [user ?? '', privileged ? 'service_role' : 'authenticated'],
  );
  if (!privileged) await db.exec('set role authenticated');
}
async function rejected(sql: string, values: unknown[] = []) {
  await db.exec('savepoint rejected');
  let error = false;
  try {
    await db.query(sql, values);
  } catch {
    error = true;
  }
  await db.exec('rollback to savepoint rejected; release savepoint rejected');
  expect(error, sql).toBe(true);
}
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query(
    "insert into auth.users(id,email) values($1,'a@example.test'),($2,'b@example.test'),($3,'c@example.test')",
    [a, b, c],
  );
  await db.query(
    "insert into profiles(id,role,display_name) values($1,'admin','Admin A'),($2,'admin','Admin B')",
    [a, b],
  );
  for (const [user, worker] of [
    [a, wa],
    [b, wb],
  ]) {
    await asUser(user);
    await db.query("insert into workers(id,full_name) values($1,'Trabajador del espacio')", [
      worker,
    ]);
    await db.query(
      "insert into worker_private_details(id,email,notes) values($1,'same@example.test','Nota privada')",
      [worker],
    );
    const type = (
      await db.query<{ id: string }>('select id from shift_types order by name limit 1')
    ).rows[0].id;
    const task = (
      await db.query<{ id: string }>(
        "insert into tasks(title) values('Tarea privada') returning id",
      )
    ).rows[0].id;
    await db.query('insert into task_assignees(task_id,worker_id) values($1,$2)', [task, worker]);
    const entry = (
      await db.query<{ id: string }>(
        "insert into logbook_entries(title,description,entry_date) values('Entrada privada','Datos','2026-11-02') returning id",
      )
    ).rows[0].id;
    const tenant = (await db.query<{ id: string }>('select current_workspace() as id')).rows[0].id;
    if (user === a) {
      sa = tenant;
      ta = task;
      ea = entry;
      typeA = type;
    } else {
      sb = tenant;
      tb = task;
      eb = entry;
      typeB = type;
    }
  }
  await asUser(null, true);
  for (const [task, entry, worker, user] of [
    [ta, ea, wa, a],
    [tb, eb, wb, b],
  ]) {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('task-evidence',$1),('logbook-evidence',$2),('avatars',$3)",
      [`${task}/${user}/foto.jpg`, `${entry}/${user}/foto.jpg`, `${worker}/${user}/foto.jpg`],
    );
  }
});
beforeEach(async () => {
  await db.exec('begin');
  await asUser(b);
});
afterEach(async () => {
  await db.exec('rollback');
});
afterAll(async () => {
  await db?.close();
});

it('cada administrador ve solo su espacio, perfiles, catálogo y datos operativos', async () => {
  expect(sa).not.toBe(sb);
  for (const table of [
    'workers',
    'profiles',
    'worker_private_details',
    'worker_invitations',
    'shift_types',
    'shifts',
    'shift_series',
    'tasks',
    'task_assignees',
    'task_comments',
    'task_attachments',
    'logbook_entries',
    'logbook_attachments',
    'worker_absences',
    'absence_private_notes',
    'activity_logs',
    'operation_requests',
  ]) {
    expect(
      (await db.query(`select id from ${table} where workspace_id<>$1`, [sb])).rows,
      table,
    ).toHaveLength(0);
  }
  expect((await db.query('select id from workspaces')).rows).toEqual([{ id: sb }]);
  expect((await db.query('select id from profiles')).rows).toEqual([{ id: b }]);
  expect((await db.query('select id from workers')).rows).toEqual([{ id: wb }]);
  expect((await db.query('select * from shift_types')).rows).toHaveLength(4);
  expect((await db.query('select user_id from team_authors()')).rows).toEqual([{ user_id: b }]);
  expect(
    (
      await db.query<{ summary: { open: number } }>(
        "select dashboard_summary('2026-11-02','2026-11-02') as summary",
      )
    ).rows[0].summary.open,
  ).toBe(1);
});
it('conocer el UUID ajeno no permite consultar, editar ni eliminarlo', async () => {
  expect((await db.query('select * from tasks where id=$1', [ta])).rows).toHaveLength(0);
  expect(
    (await db.query("update tasks set title='Ataque' where id=$1 returning id", [ta])).rows,
  ).toHaveLength(0);
  expect((await db.query('delete from workers where id=$1 returning id', [wa])).rows).toHaveLength(
    0,
  );
  expect((await db.query<{ yes: boolean }>('select can_task($1) as yes', [ta])).rows[0].yes).toBe(
    false,
  );
  expect((await db.query<{ yes: boolean }>('select can_entry($1) as yes', [ea])).rows[0].yes).toBe(
    false,
  );
  expect(
    (await db.query<{ yes: boolean }>('select can_edit_entry($1) as yes', [ea])).rows[0].yes,
  ).toBe(false);
});
it('rechaza falsificar el espacio o trasladar registros y perfiles', async () => {
  await rejected("insert into workers(full_name,workspace_id) values('Ajeno',$1)", [sa]);
  await rejected('update workers set workspace_id=$1 where id=$2', [sa, wb]);
  await rejected('update profiles set workspace_id=$1 where id=$2', [sa, b]);
  await rejected("insert into shift_types(name,workspace_id) values('Ajeno',$1)", [sa]);
});
it('las relaciones cruzadas no pasan ni aunque el administrador conozca los UUID', async () => {
  await rejected(
    "insert into shifts(worker_id,type_id,starts_at,ends_at) values($1,$2,'2026-11-02T10:00Z','2026-11-02T18:00Z')",
    [wa, typeB],
  );
  await rejected(
    "insert into shifts(worker_id,type_id,starts_at,ends_at) values($1,$2,'2026-11-02T10:00Z','2026-11-02T18:00Z')",
    [wb, typeA],
  );
  await rejected('insert into task_assignees(task_id,worker_id) values($1,$2)', [tb, wa]);
  await rejected("insert into task_comments(task_id,body) values($1,'Ajeno')", [ta]);
  await rejected(
    "insert into logbook_entries(title,description,entry_date,task_id) values('Ajeno','Dato','2026-11-02',$1)",
    [ta],
  );
  await rejected("insert into worker_private_details(id,notes) values($1,'Ajeno')", [wa]);
});
it('Storage y la función de avatar siguen el espacio de su registro padre', async () => {
  const visible = await db.query<{ name: string }>('select name from storage.objects');
  expect(visible.rows).toHaveLength(3);
  expect(visible.rows.every((row) => row.name.includes(`/${b}/`))).toBe(true);
  await rejected("insert into storage.objects(bucket_id,name) values('task-evidence',$1)", [
    `${ta}/${b}/ilegal.jpg`,
  ]);
  await rejected("insert into storage.objects(bucket_id,name) values('avatars',$1)", [
    `${wa}/${b}/ilegal.jpg`,
  ]);
  await rejected('select set_avatar($1,$2)', [wa, `${wa}/${a}/foto.jpg`]);
  expect(
    (
      await db.query('delete from storage.objects where name=$1 returning id', [
        `${ta}/${a}/foto.jpg`,
      ])
    ).rows,
  ).toHaveLength(0);
});
it('crear otro administrador es idempotente y empieza sin operaciones ni datos ajenos', async () => {
  await db.query("select grant_administrator('c@example.test','Admin C')");
  await db.query("select grant_administrator('c@example.test','Admin C')");
  expect((await db.query('select id from profiles where id=$1', [c])).rows).toHaveLength(0);
  await asUser(c);
  expect((await db.query('select id from profiles')).rows).toEqual([{ id: c }]);
  expect((await db.query('select id from workers')).rows).toHaveLength(0);
  expect((await db.query('select id from tasks')).rows).toHaveLength(0);
  expect((await db.query('select id from logbook_entries')).rows).toHaveLength(0);
  expect((await db.query('select id from shift_types')).rows).toHaveLength(4);
});

it('la invitación vincula al trabajador solo con el espacio del administrador que lo registró', async () => {
  await db.query("insert into worker_invitations(worker_id,email) values($1,'c@example.test')", [
    wb,
  ]);
  await asUser(null, true);
  await db.query('select invitee_account($1)', [wb]);
  await asUser(c);
  expect((await db.query<{ id: string }>('select current_workspace() as id')).rows[0].id).toBe(sb);
  expect((await db.query('select id from workers')).rows).toEqual([{ id: wb }]);
  expect((await db.query('select id from tasks')).rows).toEqual([{ id: tb }]);
  expect((await db.query('select id from tasks where id=$1', [ta])).rows).toHaveLength(0);
});

it('la migración conserva registros, versiones y archivos y deja vacío al segundo administrador', async () => {
  const legacy: PGlite = await createTestDatabase('202611020011');
  try {
    await legacy.query(
      "insert into auth.users(id,email) values($1,'old@example.test'),($2,'second@example.test')",
      [a, b],
    );
    await legacy.query(
      "insert into profiles(id,role,display_name,created_at) values($1,'admin','Primero','2026-11-01'),($2,'admin','Segundo','2026-11-02')",
      [a, b],
    );
    await legacy.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
    await legacy.query("insert into workers(id,full_name) values($1,'Conservar')", [wa]);
    const oldWorker = (
      await legacy.query<Record<string, unknown>>('select * from workers where id=$1', [wa])
    ).rows[0];
    await legacy.query("insert into tasks(id,title,created_by) values($1,'Conservar tarea',$2)", [
      ta,
      a,
    ]);
    await legacy.exec(
      await readFile(
        new URL('../supabase/migrations/202611030012_private_workspaces.sql', import.meta.url),
        'utf8',
      ),
    );
    await legacy.exec('set role authenticated');
    expect((await legacy.query('select id from workers')).rows).toEqual([{ id: wa }]);
    const migrated = (await legacy.query('select * from workers where id=$1', [wa])).rows[0];
    expect(migrated).toEqual({ ...oldWorker, workspace_id: a });
    await legacy.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
    expect((await legacy.query('select id from workers')).rows).toHaveLength(0);
    expect((await legacy.query('select id from tasks')).rows).toHaveLength(0);
    expect((await legacy.query('select id from shift_types')).rows).toHaveLength(4);
    expect((await legacy.query('select id from profiles')).rows).toEqual([{ id: b }]);
  } finally {
    await legacy.close();
  }
});
