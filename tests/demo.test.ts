import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
// @ts-expect-error The JavaScript harness is also used by the standalone generation script.
import { createTestDatabase } from '../scripts/local-db.mjs';
it('el seed opcional crea solo datos ficticios, sin cuentas, y rechaza una segunda carga', async () => {
  const db: PGlite = await createTestDatabase();
  try {
    const actor = '00000000-0000-4000-8000-000000000100';
    await db.query("insert into auth.users(id,email) values($1,'admin@example.test')", [actor]);
    await db.query(
      "insert into profiles(id,role,display_name) values($1,'admin','Admin de prueba')",
      [actor],
    );
    const seed = await readFile(new URL('../supabase/demo.sql', import.meta.url), 'utf8');
    await db.exec(seed);
    expect(
      (await db.query<{ n: number }>('select count(*)::integer as n from workers')).rows[0].n,
    ).toBe(6);
    expect(
      (await db.query<{ n: number }>('select count(*)::integer as n from tasks')).rows[0].n,
    ).toBe(10);
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::integer as n from shifts where worker_id is null',
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (await db.query<{ n: number }>('select count(*)::integer as n from auth.users')).rows[0].n,
    ).toBe(1);
    await expect(db.exec(seed)).rejects.toThrow(/empty workforce/);
    await db.exec('rollback');
    expect(
      (await db.query<{ n: number }>('select count(*)::integer as n from workers')).rows[0].n,
    ).toBe(6);
  } finally {
    await db.close();
  }
});
