import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
// @ts-expect-error JavaScript harness applies SQL migrations.
import { createTestDatabase } from '../scripts/local-db.mjs';
let db: PGlite;
const admin = '70000000-0000-4000-8000-000000000001',
  other = '70000000-0000-4000-8000-000000000002',
  workerUser = '70000000-0000-4000-8000-000000000003',
  worker = '80000000-0000-4000-8000-000000000001';
async function as(id: string | null, service = false) {
  await db.exec('reset role');
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
    [id ?? '', service ? 'service_role' : 'authenticated'],
  );
  if (!service) await db.exec('set role authenticated');
}
async function denied(sql: string, args: unknown[] = [], message?: RegExp) {
  await db.exec('savepoint reject');
  let failed = false;
  try {
    await db.query(sql, args);
  } catch (e) {
    failed = true;
    if (message) expect(String(e)).toMatch(message);
  }
  await db.exec('rollback to savepoint reject;release savepoint reject');
  expect(failed).toBe(true);
}
const payload = () =>
  JSON.stringify({
    worker_id: worker,
    week_start: '2026-11-02',
    overtime_minutes: 60,
    additions: 1000,
    deductions: 500,
    contract_net: null,
    notes: 'HE autorizadas',
  });
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query(
    "insert into auth.users(id,email) values($1,'a@test.invalid'),($2,'b@test.invalid'),($3,'w@test.invalid')",
    [admin, other, workerUser],
  );
  await db.query(
    "insert into profiles(id,role,display_name) values($1,'admin','Admin'),($2,'admin','Otro')",
    [admin, other],
  );
  await as(admin);
  await db.query("insert into workers(id,full_name) values($1,'Trabajador')", [worker]);
  await db.query("insert into worker_private_details(id,employment_type) values($1,'boleta')", [
    worker,
  ]);
  await as(null, true);
  await db.query(
    "insert into profiles(id,worker_id,role,display_name) values($1,$2,'worker','Trabajador')",
    [workerUser, worker],
  );
});
beforeEach(async () => {
  await db.exec('begin');
  await as(admin);
});
afterEach(async () => {
  await db.exec('rollback');
});
afterAll(async () => {
  await db?.close();
});
it('guarda y corrige ajustes semanales con control de versión y auditoría', async () => {
  await db.query('select save_payment_entry($1,0)', [payload()]);
  await denied('select save_payment_entry($1,0)', [payload()], /cambiaron/);
  await db.query('select save_payment_entry($1,1)', [payload()]);
  expect(
    (await db.query<{ version: number }>('select version from payment_entries')).rows[0].version,
  ).toBe(2);
  const audit = (
    await db.query<{ actor_id: string; after_data: { overtime_minutes: number } }>(
      "select actor_id,after_data from activity_logs where entity='payment_entries' and action='INSERT'",
    )
  ).rows[0];
  expect(audit.actor_id).toBe(admin);
  expect(audit.after_data.overtime_minutes).toBe(60);
});
it('los datos de pago y modalidad no son visibles ni modificables por trabajadores u otros espacios', async () => {
  await db.query('select save_payment_entry($1,0)', [payload()]);
  await as(other);
  expect((await db.query('select id from payment_entries')).rows).toHaveLength(0);
  await denied('select save_payment_entry($1,0)', [payload()], /no disponible/);
  const week = (
    await db.query<{ data: { workers: unknown[]; entries: unknown[] } }>(
      "select payment_week('2026-11-02') as data",
    )
  ).rows[0].data;
  expect(week.workers).toEqual([]);
  expect(week.entries).toEqual([]);
  await as(workerUser);
  expect((await db.query('select id from payment_entries')).rows).toHaveLength(0);
  expect((await db.query('select employment_type from worker_private_details')).rows).toHaveLength(
    0,
  );
  await denied("select payment_week('2026-11-02')", [], /FORBIDDEN/);
  await denied('select save_payment_entry($1,0)', [payload()], /FORBIDDEN/);
  await as(admin);
  await denied('update payment_entries set additions=0', [], /permission denied/);
});
it('la modalidad se guarda de forma privada desde la operación de ficha', async () => {
  const input = JSON.stringify({
    id: worker,
    full_name: 'Trabajador',
    active: true,
    color: '#00bfff',
  });
  await db.query('select save_worker($1,$2,1)', [
    input,
    JSON.stringify({ employment_type: 'contrato' }),
  ]);
  expect(
    (
      await db.query<{ employment_type: string }>(
        'select employment_type from worker_private_details where id=$1',
        [worker],
      )
    ).rows[0].employment_type,
  ).toBe('contrato');
  await db.query('select save_worker($1,$2,2)', [input, '{}']);
  expect(
    (
      await db.query<{ employment_type: string }>(
        'select employment_type from worker_private_details where id=$1',
        [worker],
      )
    ).rows[0].employment_type,
  ).toBe('contrato');
});
it('rechaza semanas inválidas, horas sin nota, modalidad ausente y tarifas de HE en contrato', async () => {
  await denied(
    'select save_payment_entry($1,0)',
    [JSON.stringify({ ...JSON.parse(payload()), week_start: '2026-11-03' })],
    /Semana/,
  );
  await denied(
    'select save_payment_entry($1,0)',
    [JSON.stringify({ ...JSON.parse(payload()), notes: '' })],
    /nota/,
  );
  await db.query('update worker_private_details set employment_type=null where id=$1', [worker]);
  await denied('select save_payment_entry($1,0)', [payload()], /Selecciona/);
  await db.query("update worker_private_details set employment_type='contrato' where id=$1", [
    worker,
  ]);
  await denied('select save_payment_entry($1,0)', [payload()], /contrato/);
});
