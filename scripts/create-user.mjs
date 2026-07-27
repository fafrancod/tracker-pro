/**
 * Crea un usuario en Supabase Auth (Admin API).
 * NO uses INSERT SQL en auth.users.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/create-user.mjs --email user@example.com --password 'secreto' [--name "Nombre"]
 *
 * Flags:
 *   --email (requerido)
 *   --password (requerido, min 6)
 *   --name (opcional)
 *   --no-confirm  no marcar email_confirm (default: confirmado)
 */
import { createClient } from '@supabase/supabase-js';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const email = arg('--email');
const password = arg('--password');
const name = arg('--name', '');
const emailConfirm = !hasFlag('--no-confirm');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}
if (!email || !password) {
  console.error(
    'Uso: node scripts/create-user.mjs --email a@b.com --password "secret" [--name "Nombre"]'
  );
  process.exit(1);
}
if (password.length < 6) {
  console.error('La contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: emailConfirm,
  user_metadata: name
    ? { name, full_name: name }
    : undefined,
});

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log('OK usuario creado');
console.log('  id   :', data.user?.id);
console.log('  email:', data.user?.email);
console.log('  confirm:', emailConfirm);
console.log('El perfil de app se crea al primer login (bootstrap).');
