// Dry-run unless --apply. Removes only unreferenced images older than 24 hours.
import { createClient } from '@supabase/supabase-js';
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const apply = process.argv.includes('--apply');
const cutoff = Date.now() - 86400000;
for (const [bucket, table, column] of [
  ['task-evidence', 'task_attachments', 'path'],
  ['logbook-evidence', 'logbook_attachments', 'path'],
  ['avatars', 'workers', 'avatar_path'],
]) {
  const orphans = [];
  const referenced = new Set();
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from(table)
      .select(column)
      .range(offset, offset + 499);
    if (error) throw error;
    for (const row of data) if (row[column]) referenced.add(row[column]);
    if (data.length < 500) break;
    offset += 500;
  }
  async function walk(prefix = '') {
    let cursor = 0;
    while (true) {
      const { data, error } = await db.storage
        .from(bucket)
        .list(prefix, { limit: 100, offset: cursor, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      for (const object of data) {
        const path = prefix ? `${prefix}/${object.name}` : object.name;
        if (!object.id) {
          await walk(path);
          continue;
        }
        if (!referenced.has(path) && object.created_at && Date.parse(object.created_at) < cutoff) {
          console.log(`${apply ? 'DELETE' : 'WOULD DELETE'} ${bucket}/${path}`);
          orphans.push(path);
        }
      }
      if (data.length < 100) break;
      cursor += 100;
    }
  }
  await walk();
  if (apply)
    for (let i = 0; i < orphans.length; i += 100) {
      const { error } = await db.storage.from(bucket).remove(orphans.slice(i, i + 100));
      if (error) throw error;
    }
}
