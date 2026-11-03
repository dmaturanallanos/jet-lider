// Reproducible offline generation from the actual migrated PostgreSQL catalog.
// Hosted projects can regenerate with Supabase CLI instead (README).
import { createTestDatabase } from './local-db.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const db = await createTestDatabase();
const columns = await db.query(
  `select table_name,column_name,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
);
const scalar = (t) =>
  t.startsWith('_')
    ? scalar(t.slice(1)) + '[]'
    : ({
        uuid: 'string',
        text: 'string',
        timestamptz: 'string',
        date: 'string',
        bool: 'boolean',
        int4: 'number',
        int8: 'number',
        jsonb: 'Json',
        void: 'undefined',
      }[t] ?? 'string');
let source =
  '// GENERATED from migrated PostgreSQL catalog by scripts/generate-types.mjs. Do not edit.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n';
for (const name of [...new Set(columns.rows.map((c) => c.table_name))]) {
  const cols = columns.rows.filter((c) => c.table_name === name);
  const fields = (mode) =>
    cols
      .map(
        (c) =>
          `${c.column_name}${mode === 'Update' || (mode === 'Insert' && (c.is_nullable === 'YES' || c.column_default !== null)) ? '?' : ''}: ${scalar(c.udt_name)}${c.is_nullable === 'YES' ? ' | null' : ''}`,
      )
      .join('; ');
  source += `${name}: { Row: {${fields('Row')}}; Insert: {${fields('Insert')}}; Update: {${fields('Update')}}; Relationships: [] };\n`;
}
source += '}; Views: { [_ in never]: never }; Functions: {\n';
const functions = await db.query(
  `select p.proname, p.proargnames, p.proargtypes::oid[] as argtypes, p.pronargdefaults, t.typname as returns from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype where n.nspname='public' and p.proname in ('is_active','is_admin','my_worker_id','can_task','can_entry','my_contact','save_worker','save_shift_batch','save_task','save_absence','invitee_account','set_avatar','worker_impact','dashboard_summary','can_edit_entry','team_authors','grant_administrator','current_workspace','save_attendance','attendance_week','delete_operational_record','save_payment_entry','payment_week')`,
);
for (const f of functions.rows) {
  const args = [];
  for (let i = 0; i < f.argtypes.length; i++) {
    const t = await db.query('select typname from pg_type where oid=$1', [f.argtypes[i]]);
    args.push(
      `${f.proargnames[i]}${i >= f.argtypes.length - f.pronargdefaults ? '?' : ''}: ${scalar(t.rows[0].typname)}`,
    );
  }
  source += `${f.proname}: { Args: ${args.length ? '{' + args.join('; ') + '}' : 'Record<string, never>'}; Returns: ${f.proname === 'team_authors' ? '{ user_id: string; name: string }[]' : f.proname === 'my_contact' ? '{ email: string | null; phone: string | null }[]' : scalar(f.returns)} };\n`;
}
source += '}; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } };\n';
await mkdir('src/types', { recursive: true });
await writeFile('src/types/database.generated.ts', source);
await db.close();
console.log('Database types generated from migrated PostgreSQL.');
