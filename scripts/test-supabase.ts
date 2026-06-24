import { query } from '../src/lib/db';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'evidences';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function testDatabase() {
  console.log('\n── TEST 1: PostgreSQL (Supabase) ───────────────────────────');
  const result = await query('SELECT NOW() AS current_time, current_database() AS db_name;');
  const row = result.rows[0];
  console.log('✅  Conexión exitosa');
  console.log(`    Hora del servidor : ${row.current_time}`);
  console.log(`    Base de datos     : ${row.db_name}`);
}

async function testStorage() {
  console.log('\n── TEST 2: Supabase Storage ────────────────────────────────');
  const supabase = getSupabaseAdmin();

  const content = 'Prueba de conexión exitosa';
  const filename = `test-${Date.now()}.txt`;
  const buffer = Buffer.from(content, 'utf-8');

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: 'text/plain', upsert: true });

  if (uploadError) throw new Error(`Upload falló: ${uploadError.message}`);
  console.log(`✅  Archivo subido al bucket "${BUCKET}" → ${filename}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  console.log(`    URL pública       : ${data.publicUrl}`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  UGM Proctor — Verificación de conexiones Supabase');
  console.log('═══════════════════════════════════════════════════════════');

  let passed = 0;

  try {
    await testDatabase();
    passed++;
  } catch (err: any) {
    console.log(`❌  DB falló: ${err.message}`);
  }

  try {
    await testStorage();
    passed++;
  } catch (err: any) {
    console.log(`❌  Storage falló: ${err.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Resultado: ${passed}/2 pruebas pasaron`);
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(passed === 2 ? 0 : 1);
}

main();
