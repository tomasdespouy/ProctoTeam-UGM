// Diagnóstico de solo lectura: ¿existe el usuario y con qué rol?
// Uso: node --env-file=.env scripts/check-user.cjs <email>
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const target = (process.argv[2] || 'tomas.despouy@ugm.cl').toLowerCase();

if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  console.log('Supabase URL host:', new URL(url).host);
  console.log('Buscando email (case-insensitive):', target);
  console.log('—'.repeat(50));

  // 1) Coincidencia exacta (case-insensitive)
  let { data: exact, error: e1 } = await sb
    .from('users')
    .select('id, uid, email, nombre, role, created_at, updated_at')
    .ilike('email', target);

  if (e1) {
    console.error('Error consultando por email exacto:', e1.message);
  } else {
    console.log(`\n[1] Coincidencia exacta de "${target}": ${exact.length} fila(s)`);
    console.table(exact.map(u => ({ email: u.email, role: u.role, uid: (u.uid||'').slice(0,12)+'…', creado: u.created_at })));
  }

  // 2) Cualquier "despouy"
  let { data: fuzzy, error: e2 } = await sb
    .from('users')
    .select('email, role, uid, created_at')
    .ilike('email', '%despouy%');
  if (!e2) {
    console.log(`\n[2] Cualquier email con "despouy": ${fuzzy.length} fila(s)`);
    console.table(fuzzy.map(u => ({ email: u.email, role: u.role, uid: (u.uid||'').slice(0,12)+'…' })));
  } else {
    console.error('Error fuzzy:', e2.message);
  }

  // 3) Super-admins actuales
  let { data: admins, error: e3 } = await sb
    .from('users')
    .select('email, role, created_at')
    .eq('role', 'super-admin');
  if (!e3) {
    console.log(`\n[3] Super-admins existentes: ${admins.length}`);
    console.table(admins.map(u => ({ email: u.email, creado: u.created_at })));
  } else {
    console.error('Error admins:', e3.message);
  }

  // 4) Total de usuarios + últimos 8 (para ver si hay actividad de login real)
  let { count, error: e4 } = await sb.from('users').select('*', { count: 'exact', head: true });
  if (!e4) console.log(`\n[4] Total de usuarios en la tabla: ${count}`);

  let { data: recent, error: e5 } = await sb
    .from('users')
    .select('email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  if (!e5) {
    console.log('\n[5] Últimos 8 usuarios creados:');
    console.table(recent.map(u => ({ email: u.email, role: u.role, creado: u.created_at })));
  }
})().catch(err => { console.error('Fallo general:', err.message); process.exit(1); });
