import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serverKey) throw new Error('Completa las variables de .env.local.');

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const privileged = createClient(url, serverKey, options);
const anonymous = createClient(url, publicKey, options);
const [schemaResponse, settingsResponse, buckets, admins, users, anonPermission] =
  await Promise.all([
    fetch(`${url}/rest/v1/`, {
      headers: { apikey: serverKey, Authorization: `Bearer ${serverKey}` },
    }),
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: publicKey } }),
    privileged.storage.listBuckets(),
    privileged.from('profiles').select('id', { head: true, count: 'exact' }).eq('role', 'admin'),
    privileged.auth.admin.listUsers({ page: 1, perPage: 1 }),
    anonymous.rpc('is_admin'),
  ]);
const schema = await schemaResponse.json();
const settings = await settingsResponse.json();
const expected = [
  'workspaces',
  'shift_attendance',
  'workers',
  'profiles',
  'worker_private_details',
  'worker_invitations',
  'shift_types',
  'shifts',
  'shift_series',
  'worker_absences',
  'absence_private_notes',
  'tasks',
  'task_assignees',
  'task_comments',
  'task_attachments',
  'logbook_entries',
  'logbook_attachments',
  'activity_logs',
  'operation_requests',
];
const existing = Object.keys(schema.definitions ?? {});
const missingTables = expected.filter((name) => !existing.includes(name));
const bucketState = ['task-evidence', 'logbook-evidence', 'avatars'].map((id) => {
  const bucket = buckets.data?.find((b) => b.id === id);
  return { id, exists: Boolean(bucket), private: bucket?.public === false };
});
// Print only configuration status and counts: never keys, tokens or account details.
console.log(
  JSON.stringify(
    {
      projectRef: new URL(url).hostname.split('.')[0],
      restAvailable: schemaResponse.ok,
      missingTables,
      authAdminAvailable: !users.error,
      storageAvailable: !buckets.error,
      buckets: bucketState,
      adminProfiles: admins.count,
      publicSignupDisabled: settings.disable_signup === true,
      anonymousAdminRpcDenied: Boolean(anonPermission.error),
      migrationHistory: 'No verificado: requiere Supabase CLI autenticada.',
    },
    null,
    2,
  ),
);
if (
  !schemaResponse.ok ||
  missingTables.length ||
  users.error ||
  buckets.error ||
  admins.error ||
  bucketState.some((b) => !b.private)
)
  process.exitCode = 1;
else if (settings.disable_signup !== true || !admins.count) process.exitCode = 2;
