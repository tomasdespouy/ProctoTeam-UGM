import { query } from './db';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'evidences';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Borra del storage privado todas las grabaciones y evidencias asociadas a un
 * usuario (derecho al olvido / retención). Cubre tanto al alumno (sus propias
 * participaciones) como al docente (las participaciones de los exámenes que
 * posee). Best-effort: nunca lanza, para no bloquear el borrado del usuario.
 *
 * Debe llamarse ANTES del DELETE del usuario (las FK ON DELETE CASCADE borran
 * las participaciones y perderíamos los ids para localizar los objetos).
 */
export async function deleteUserStorage(uid: string): Promise<void> {
  const sb = admin();
  if (!sb) return;
  try {
    const res = await query(
      `SELECT DISTINCT ep.id
         FROM exam_participations ep
        WHERE ep.student_id = $1
           OR ep.exam_session_id IN (SELECT id FROM exam_sessions WHERE instructor_id = $1)`,
      [uid],
    );
    const pids: string[] = res.rows.map((r: any) => r.id).filter(Boolean);
    if (pids.length === 0) return;

    // Grabaciones: recordings/<pid>/*.webm
    for (const pid of pids) {
      const { data: files } = await sb.storage.from(BUCKET).list(`recordings/${pid}`, { limit: 10000 });
      if (files && files.length) {
        await sb.storage.from(BUCKET).remove(files.map(f => `recordings/${pid}/${f.name}`));
      }
    }

    // Evidencia: evidence/<pid>_<tipo>_<ts>.jpg — se lista la carpeta y se filtra
    // por prefijo de participación (el pid es un UUID sin guiones bajos).
    const pidSet = new Set(pids);
    const { data: evFiles } = await sb.storage.from(BUCKET).list('evidence', { limit: 100000 });
    if (evFiles && evFiles.length) {
      const toRemove = evFiles
        .filter(f => pidSet.has(f.name.split('_')[0]))
        .map(f => `evidence/${f.name}`);
      if (toRemove.length) await sb.storage.from(BUCKET).remove(toRemove);
    }
  } catch (e: any) {
    console.error('[storage-cleanup] falló el borrado de storage:', e?.message ?? e);
  }
}
