// Promueve un usuario existente a super-admin (o al rol indicado).
// Uso: node --env-file=.env scripts/promote-user.cjs <email> [role]
//   role por defecto: super-admin   (valores: student | instructor | super-admin)
//
// Requiere que el usuario YA exista en la tabla `users` (es decir, que haya
// iniciado sesión al menos una vez por SSO). Si no existe, avisa y no hace nada.
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] || '').toLowerCase().trim();
const role = process.argv[3] || 'super-admin';

if (!url || !key) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!email) { console.error('Uso: node --env-file=.env scripts/promote-user.cjs <email> [role]'); process.exit(1); }
if (!['student', 'instructor', 'super-admin'].includes(role)) { console.error('Rol inválido:', role); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const { data: found, error: e1 } = await sb
    .from('users').select('id, uid, email, role').ilike('email', email);
  if (e1) { console.error('Error buscando usuario:', e1.message); process.exit(1); }

  if (!found || found.length === 0) {
    console.log(`❌ "${email}" NO existe en la tabla users.`);
    console.log('   El usuario debe iniciar sesión por SSO al menos una vez antes de promoverlo.');
    process.exit(2);
  }

  const u = found[0];
  console.log(`Encontrado: ${u.email} (rol actual: ${u.role}). Promoviendo a "${role}"...`);

  const { error: e2 } = await sb
    .from('users').update({ role, updated_at: new Date().toISOString() }).eq('uid', u.uid);
  if (e2) { console.error('Error actualizando rol:', e2.message); process.exit(1); }

  console.log(`✅ Listo. ${u.email} ahora es "${role}". Cierra sesión y vuelve a entrar para refrescar el rol.`);
})().catch(err => { console.error('Fallo general:', err.message); process.exit(1); });
