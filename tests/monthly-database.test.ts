import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
// @ts-expect-error JavaScript harness runs the actual migrations.
import { createTestDatabase } from '../scripts/local-db.mjs';
let db: PGlite;
const a = '90000000-0000-4000-8000-000000000001',
  b = '90000000-0000-4000-8000-000000000002',
  u = '90000000-0000-4000-8000-000000000003',
  w = 'a0000000-0000-4000-8000-000000000001',
  boleta = 'a0000000-0000-4000-8000-000000000002';
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
const payload = (month = '2026-11-01') =>
  JSON.stringify({
    worker_id: w,
    month_start: month,
    salary_net: 800000,
    advance_net: 1,
    notes: 'Dato de prueba',
  });
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query(
    "insert into auth.users(id,email) values($1,'a@test.invalid'),($2,'b@test.invalid'),($3,'u@test.invalid')",
    [a, b, u],
  );
  await db.query(
    "insert into profiles(id,role,display_name) values($1,'admin','Uno'),($2,'admin','Dos')",
    [a, b],
  );
  await as(a);
  await db.query("insert into workers(id,full_name) values($1,'Contrato'),($2,'Boleta')", [
    w,
    boleta,
  ]);
  await db.query(
    "insert into worker_private_details(id,employment_type) values($1,'contrato'),($2,'boleta')",
    [w, boleta],
  );
  await as(null, true);
  await db.query(
    "insert into profiles(id,role,worker_id,display_name) values($1,'worker',$2,'Trabajador')",
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
it('guarda un anticipo fijo por mes, ignora anticipo enviado por el cliente y controla la versión', async () => {
  await db.query('select save_contract_month($1,0)', [payload()]);
  await denied('select save_contract_month($1,0)', [payload()], /cambió/);
  await db.query('select save_contract_month($1,1)', [payload()]);
  const row = (
    await db.query<{ salary_net: number; advance_net: number; version: number }>(
      'select salary_net,advance_net,version from contract_monthly_payments',
    )
  ).rows[0];
  expect(row).toEqual({ salary_net: 800000, advance_net: 200000, version: 2 });
  expect(
    (
      await db.query(
        "select id from activity_logs where entity='contract_monthly_payments' and action='INSERT'",
      )
    ).rows,
  ).toHaveLength(1);
});
it('el sueldo mensual no se duplica por semana y separa meses diferentes', async () => {
  await db.query('select save_contract_month($1,0)', [payload()]);
  await db.query('select save_contract_month($1,0)', [payload('2026-12-01')]);
  const november = (
    await db.query<{ data: { entries: unknown[] } }>(
      "select contract_payment_month('2026-11-01') as data",
    )
  ).rows[0].data;
  expect(november.entries).toHaveLength(1);
  expect((await db.query('select id from contract_monthly_payments')).rows).toHaveLength(2);
});
it('otros espacios y trabajadores no consultan ni cambian los sueldos', async () => {
  await db.query('select save_contract_month($1,0)', [payload()]);
  await as(b);
  expect((await db.query('select id from contract_monthly_payments')).rows).toHaveLength(0);
  await denied('select save_contract_month($1,0)', [payload()], /no disponible/);
  const other = (
    await db.query<{ data: { workers: unknown[]; entries: unknown[] } }>(
      "select contract_payment_month('2026-11-01') as data",
    )
  ).rows[0].data;
  expect(other.workers).toEqual([]);
  expect(other.entries).toEqual([]);
  await as(u);
  await denied("select contract_payment_month('2026-11-01')", [], /FORBIDDEN/);
  expect((await db.query('select id from contract_monthly_payments')).rows).toHaveLength(0);
  await as(a);
  await denied('update contract_monthly_payments set advance_net=1', [], /permission denied/);
});
it('rechaza sueldos menores al anticipo, fechas inválidas y trabajadores de boleta', async () => {
  await denied(
    'select save_contract_month($1,0)',
    [JSON.stringify({ ...JSON.parse(payload()), salary_net: 199999 })],
    /anticipo/,
  );
  await denied('select save_contract_month($1,0)', [payload('2026-11-02')], /mes/);
  await denied(
    'select save_contract_month($1,0)',
    [JSON.stringify({ ...JSON.parse(payload()), worker_id: boleta })],
    /contrato no disponible/,
  );
});
it('los contratos ya no admiten nuevas preparaciones semanales', async () => {
  await denied(
    'select save_payment_entry($1,0)',
    [
      JSON.stringify({
        worker_id: w,
        week_start: '2026-11-02',
        overtime_minutes: 0,
        additions: 0,
        deductions: 0,
        contract_net: 800000,
        notes: '',
      }),
    ],
    /por mes/,
  );
});
it('conserva un registro mensual histórico aunque se desactive la ficha', async () => {
  await db.query('select save_contract_month($1,0)', [payload()]);
  await db.query('update workers set active=false where id=$1', [w]);
  expect(
    (
      await db.query<{ data: { workers: unknown[] } }>(
        "select contract_payment_month('2026-11-01') as data",
      )
    ).rows[0].data.workers,
  ).toHaveLength(1);
  expect(
    (
      await db.query<{ data: { workers: unknown[] } }>(
        "select contract_payment_month('2026-12-01') as data",
      )
    ).rows[0].data.workers,
  ).toHaveLength(0);
});
