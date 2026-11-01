import { createClient } from '@supabase/supabase-js';
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  BOOTSTRAP_ADMIN_USER_ID: id,
  BOOTSTRAP_ADMIN_NAME: name,
} = process.env;
if (!url || !key || !id || !name)
  throw new Error(
    'Completa URL, service role y BOOTSTRAP_ADMIN_USER_ID / BOOTSTRAP_ADMIN_NAME en .env.local.',
  );
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const {
  data: { user },
  error,
} = await db.auth.admin.getUserById(id);
if (error || !user?.email_confirmed_at)
  throw new Error('Crea y verifica primero tu propia cuenta desde Auth en Supabase.');
const current = await db.from('profiles').select('id').eq('role', 'admin').maybeSingle();
if (current.error) throw current.error;
if (current.data) {
  if (current.data.id === id) {
    console.log('El administrador ya está configurado.');
    process.exit(0);
  }
  throw new Error('Ya existe otro administrador. No se modificó nada.');
}
const result = await db.from('profiles').insert({ id, display_name: name, role: 'admin' });
if (result.error) throw result.error;
console.log('Administrador inicial configurado. No se crearon contraseñas.');
