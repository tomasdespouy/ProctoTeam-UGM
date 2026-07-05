import { Pool } from 'pg';
import { supabaseServer } from './supabase-server';

// ── Direct Postgres connection (works on IPv6 networks / production) ──
declare global {
  var pool: Pool | undefined;
  var pgAvailable: boolean | undefined;
}

let pool: Pool;

if (!global.pool) {
  const isSupabase =
    (process.env.DATABASE_URL ?? '').includes('supabase.co') ||
    (process.env.DATABASE_URL ?? '').includes('pooler.supabase.com');

  // Un '#' sin codificar en la contraseña trunca la URL (se interpreta como
  // fragmento). Lo codificamos para que la conexión directa no falle por eso.
  const connectionString = (process.env.DATABASE_URL ?? '').replace(/#/g, '%23') || undefined;

  global.pool = new Pool({
    connectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000, // cold-start: cae rápido a REST si PG directo no responde
  });
}

pool = global.pool;

// Sin este handler, un error en un cliente idle del pool puede propagarse como
// excepción no capturada y tumbar el proceso.
if (!(global as any).__poolErrHandler) {
  pool.on('error', (err) => {
    console.error('[DB] error inesperado en cliente idle del pool:', err?.message);
  });
  (global as any).__poolErrHandler = true;
}

// ── Test direct PG once on startup; cache the result ──
async function isPgAvailable(): Promise<boolean> {
  if (global.pgAvailable !== undefined) return global.pgAvailable;
  try {
    await pool.query('SELECT 1');
    global.pgAvailable = true;
    console.log('[DB] Conexión directa PostgreSQL OK');
  } catch {
    global.pgAvailable = false;
    console.log('[DB] PostgreSQL directo no disponible — usando Supabase REST fallback');
  }
  return global.pgAvailable;
}

// ── Supabase REST fallback via exec_sql RPC ──
async function queryViaRest(text: string, params?: any[]) {
  const stringParams = (params ?? []).map((p) =>
    p === null || p === undefined ? null : String(p)
  );

  const { data, error } = await supabaseServer.rpc('exec_sql', {
    sql_text: text,
    params: stringParams,
  });

  if (error) {
    console.error('Supabase RPC error:', error);
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : [];
  return { rows, rowCount: rows.length };
}

// ── Public query function (same interface for all callers) ──
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    if (await isPgAvailable()) {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query (${duration}ms):`, text);
      }
      return res;
    }
    return await queryViaRest(text, params);
  } catch (error) {
    // If direct PG fails at runtime, try REST fallback once
    if (global.pgAvailable) {
      global.pgAvailable = false;
      console.log('[DB] PG falló en runtime — cambiando a REST fallback');
      return await queryViaRest(text, params);
    }
    console.error('Database query error:', error);
    throw error;
  }
};

export const db = {
  query,
  pool,
};
