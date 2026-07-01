// Migración: agrega la columna users.active (soft-disable de cuentas).
// Uso: node --env-file=.env scripts/migrate-add-user-active.cjs
//
// Intenta primero conexión directa PostgreSQL (DATABASE_URL); si falla
// (redes sin IPv6), usa el RPC exec_sql de Supabase como fallback — el mismo
// patrón que src/lib/db.ts.
const fs = require('fs');
const DDL = `ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;`;

// Lee DATABASE_URL CRUDO desde .env — evita que el parser de --env-file trate
// el '#' de la contraseña como comentario y la trunque.
function rawDatabaseUrl() {
  const raw = fs.readFileSync('.env', 'utf8');
  const line = raw.split(/\r?\n/).find(l => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL no está en .env');
  return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
}

// Parse manual: la contraseña trae caracteres especiales (#@$) sin encodear,
// por lo que el parser de connection-string se confunde. Separamos por el
// ÚLTIMO '@' (el que precede al host).
function parseDbUrl(cs) {
  const noScheme = cs.replace(/^postgres(ql)?:\/\//, '');
  const at = noScheme.lastIndexOf('@');
  const creds = noScheme.slice(0, at);
  const hostPart = noScheme.slice(at + 1);
  const colon = creds.indexOf(':');
  const user = creds.slice(0, colon);
  const password = creds.slice(colon + 1);
  const [hostPort, database = 'postgres'] = hostPart.split('/');
  const [host, port = '5432'] = hostPort.split(':');
  return { user, password, host, port: parseInt(port, 10), database: database.split('?')[0] };
}

async function viaPg() {
  const { Pool } = require('pg');
  const cs = rawDatabaseUrl();
  const cfg = parseDbUrl(cs);
  console.log(`Conectando a ${cfg.host}:${cfg.port}/${cfg.database} como ${cfg.user}…`);
  const pool = new Pool({
    ...cfg,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await pool.query(DDL);
  await pool.end();
}

async function viaRest() {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan credenciales Supabase');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.rpc('exec_sql', { sql_text: DDL, params: [] });
  if (error) throw new Error(error.message);
}

(async () => {
  try {
    await viaPg();
    console.log('✅ Migración aplicada vía PostgreSQL directo: users.active');
  } catch (pgErr) {
    console.warn('PG directo falló:', pgErr.message, '— probando RPC exec_sql…');
    try {
      await viaRest();
      console.log('✅ Migración aplicada vía RPC exec_sql: users.active');
    } catch (restErr) {
      console.error('❌ Falló también el RPC:', restErr.message);
      console.error('Aplica manualmente en el SQL editor de Supabase:');
      console.error('   ' + DDL);
      process.exit(1);
    }
  }
})();
