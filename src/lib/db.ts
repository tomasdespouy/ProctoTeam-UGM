import { Pool } from 'pg';

// Declaración global para evitar múltiples instancias en Hot Reload (Next.js)
declare global {
  var pool: Pool | undefined;
}

let pool: Pool;

if (!global.pool) {
  global.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false, // Correcto para Replit interno
    max: 10,    // Limitamos conexiones para no saturar
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

pool = global.pool;

// Wrapper tipado para consultas
export const db = {
  query: async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      // Log solo si es lento (>500ms) para no ensuciar la consola
      const duration = Date.now() - start;
      if (duration > 500) {
        console.warn(`Slow query (${duration}ms):`, text);
      }
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },
  // Exponemos el pool por si necesitamos transacciones complejas
  pool
};