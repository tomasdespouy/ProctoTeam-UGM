import { Pool } from 'pg';

// Patrón Singleton para evitar saturar conexiones en desarrollo
declare global {
  var pool: Pool | undefined;
}

let pool: Pool;

if (!global.pool) {
  // Supabase requiere SSL. Replit original no lo necesitaba (red interna).
  // rejectUnauthorized: false permite certificados auto-firmados en entornos dev/staging.
  const isSupabase =
    (process.env.DATABASE_URL ?? '').includes('supabase.co') ||
    (process.env.DATABASE_URL ?? '').includes('pooler.supabase.com');

  global.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

pool = global.pool;

// Exportación nombrada para 'import { query } from ...' (Lo que usa auth-postgres.ts)
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text);
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Exportación por objeto para 'import { db } from ...' (Lo que usan otros servicios)
export const db = {
  query,
  pool,
};
