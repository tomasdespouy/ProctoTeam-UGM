/**
 * dump-schema.js
 * Extrae el DDL real de la base de datos actual (Replit PostgreSQL).
 * Uso: node scripts/dump-schema.js
 * Requiere la variable de entorno DATABASE_URL configurada.
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Lista todas las tablas del schema 'public' */
async function listTables(client) {
  const { rows } = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  return rows.map((r) => r.tablename);
}

/** Reconstruye el CREATE TABLE con columnas, tipos, defaults, NOT NULL y PKs */
async function getTableDDL(client, table) {
  // Columnas
  const { rows: cols } = await client.query(
    `
    SELECT
      a.attname                                          AS column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod)   AS data_type,
      a.attnotnull                                       AS not_null,
      pg_get_expr(d.adbin, d.adrelid)                   AS column_default,
      a.attnum
    FROM pg_catalog.pg_attribute a
    LEFT JOIN pg_catalog.pg_attrdef d
      ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = $1::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum;
    `,
    [table]
  );

  // Constraints (PK, UNIQUE, CHECK, FK)
  const { rows: constraints } = await client.query(
    `
    SELECT
      c.conname  AS constraint_name,
      c.contype  AS constraint_type,
      pg_get_constraintdef(c.oid, true) AS definition
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = $1::regclass
    ORDER BY c.contype, c.conname;
    `,
    [table]
  );

  // Construir DDL
  const colDefs = cols.map((col) => {
    let def = `  ${col.column_name} ${col.data_type}`;
    if (col.column_default) def += ` DEFAULT ${col.column_default}`;
    if (col.not_null)       def += ' NOT NULL';
    return def;
  });

  const constraintDefs = constraints.map(
    (c) => `  CONSTRAINT ${c.constraint_name} ${c.definition}`
  );

  const allDefs = [...colDefs, ...constraintDefs];
  return `CREATE TABLE IF NOT EXISTS ${table} (\n${allDefs.join(',\n')}\n);`;
}

/** Extrae los índices asociados a una tabla */
async function getTableIndexes(client, table) {
  const { rows } = await client.query(
    `
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = $1
      AND indexname NOT IN (
        -- Excluir los índices de PK/UNIQUE que ya están en las constraints
        SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass
      )
    ORDER BY indexname;
    `,
    [table]
  );
  return rows.map((r) => r.indexdef + ';');
}

/** Extrae las extensiones habilitadas */
async function getExtensions(client) {
  const { rows } = await client.query(`
    SELECT extname FROM pg_extension WHERE extname != 'plpgsql' ORDER BY extname;
  `);
  return rows.map((r) => `CREATE EXTENSION IF NOT EXISTS ${r.extname};`);
}

/** Extrae comentarios de columnas y tablas */
async function getComments(client, table) {
  const { rows } = await client.query(
    `
    SELECT
      col.attname     AS column_name,
      d.description   AS comment
    FROM pg_description d
    JOIN pg_attribute col ON col.attrelid = d.objoid AND col.attnum = d.objsubid
    WHERE d.objoid = $1::regclass AND d.objsubid > 0;
    `,
    [table]
  );
  return rows.map(
    (r) => `COMMENT ON COLUMN ${table}.${r.column_name} IS '${r.comment.replace(/'/g, "''")}';`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    console.log('-- ============================================================');
    console.log('-- DDL real extraído de la base de datos actual de Replit');
    console.log(`-- Fecha: ${new Date().toISOString()}`);
    console.log('-- ============================================================\n');

    // Extensiones
    const extensions = await getExtensions(client);
    if (extensions.length) {
      console.log('-- Extensiones\n' + extensions.join('\n') + '\n');
    }

    // Tablas
    const tables = await listTables(client);
    console.log(`-- Tablas encontradas: ${tables.join(', ')}\n`);

    for (const table of tables) {
      console.log(`\n-- ── Tabla: ${table} ${'─'.repeat(Math.max(0, 50 - table.length))}`);
      const ddl = await getTableDDL(client, table);
      console.log(ddl);

      const indexes = await getTableIndexes(client, table);
      if (indexes.length) {
        console.log('\n-- Índices');
        indexes.forEach((idx) => console.log(idx));
      }

      const comments = await getComments(client, table);
      if (comments.length) {
        console.log('\n-- Comentarios');
        comments.forEach((c) => console.log(c));
      }
    }

    console.log('\n-- ============================================================');
    console.log('-- Fin del dump');
    console.log('-- ============================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error ejecutando dump-schema:', err);
  process.exit(1);
});
