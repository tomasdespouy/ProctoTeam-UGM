// Verificación de solo lectura del hardening RLS + exec_sql.
// Uso: node --env-file=.env scripts/verify-rls.cjs
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const TABLES = ['users', 'exam_sessions', 'exam_participations', 'exam_alerts', 'alerts', 'messages'];
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const ok = (b) => (b ? '✅' : '❌');

async function execSql(sql) {
  const { data, error } = await admin.rpc('exec_sql', { sql_text: sql, params: [] });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

(async () => {
  console.log('Host:', new URL(url).host);
  console.log('='.repeat(60));

  // ── 1) RLS activo en las 6 tablas ────────────────────────────────────────
  console.log('\n[1] RLS habilitado por tabla (pg_class.relrowsecurity):');
  let rls = [];
  try {
    rls = await execSql(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN ('users','exam_sessions','exam_participations','exam_alerts','alerts','messages')
      ORDER BY relname;
    `);
    const byName = Object.fromEntries(rls.map(r => [r.relname, r]));
    for (const t of TABLES) {
      const row = byName[t];
      if (!row) { console.log(`   ${ok(false)} ${t} — NO EXISTE`); continue; }
      console.log(`   ${ok(row.relrowsecurity)} ${t} — RLS=${row.relrowsecurity}`);
    }
  } catch (e) {
    console.log('   ❌ No se pudo consultar (¿exec_sql falló?):', e.message);
  }

  // ── 2) Privilegios EXECUTE sobre exec_sql ────────────────────────────────
  console.log('\n[2] EXECUTE sobre public.exec_sql(text, text[]):');
  try {
    const [p] = await execSql(`
      SELECT
        has_function_privilege('anon',          'public.exec_sql(text, text[])', 'EXECUTE') AS anon,
        has_function_privilege('authenticated', 'public.exec_sql(text, text[])', 'EXECUTE') AS authenticated,
        has_function_privilege('service_role',  'public.exec_sql(text, text[])', 'EXECUTE') AS service_role;
    `);
    console.log(`   ${ok(p.anon === false)} anon          = ${p.anon}  (debe ser false)`);
    console.log(`   ${ok(p.authenticated === false)} authenticated = ${p.authenticated}  (debe ser false)`);
    console.log(`   ${ok(p.service_role === true)} service_role  = ${p.service_role}  (debe ser true — lo usa el fallback)`);
  } catch (e) {
    console.log('   ❌ No se pudo consultar:', e.message);
  }

  // ── 3) Backend sigue leyendo (service_role hace BYPASS de RLS) ───────────
  console.log('\n[3] Lectura con service_role vía PostgREST (debe ver filas):');
  for (const t of TABLES) {
    const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true });
    if (error) console.log(`   ❌ ${t} — ERROR: ${error.message}`);
    else console.log(`   ${ok(true)} ${t} — ${count} fila(s) visibles`);
  }

  // ── 4) anon está bloqueado (la victoria de seguridad) ────────────────────
  console.log('\n[4] Acceso con la llave anon (pública) — debe estar bloqueado:');
  if (!anonKey) {
    console.log('   ⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY no está en el entorno — omito esta prueba.');
  } else {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });

    // 4a) Lectura de tabla: con RLS sin política => 0 filas (datos protegidos)
    const { data, error } = await anon.from('users').select('id').limit(5);
    if (error) {
      console.log(`   ✅ users vía anon — bloqueado con error: ${error.message}`);
    } else {
      console.log(`   ${ok((data?.length ?? 0) === 0)} users vía anon — devolvió ${data?.length ?? 0} fila(s) (debe ser 0)`);
    }

    // 4b) exec_sql vía anon: debe ser denegado
    const { error: rpcErr } = await anon.rpc('exec_sql', { sql_text: 'SELECT 1', params: [] });
    if (rpcErr) {
      console.log(`   ✅ exec_sql vía anon — DENEGADO: ${rpcErr.message}`);
    } else {
      console.log('   ❌ exec_sql vía anon — ¡SE EJECUTÓ! El revoke NO tuvo efecto.');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Verificación completa.');
})().catch(err => { console.error('Fallo general:', err.message); process.exit(1); });
