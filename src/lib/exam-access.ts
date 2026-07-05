import { db } from './db';

/**
 * ¿Puede este usuario acceder a este examen?
 *  - super-admin: siempre.
 *  - admin (auditor): solo lectura (write=false).
 *  - instructor: solo si es el dueño del examen (instructor_id === uid).
 *  - student u otros: no.
 *
 * Centraliza el chequeo de propiedad para cerrar los IDOR de alertas/grabaciones.
 */
export async function userCanAccessExam(
  examId: string,
  user: { uid: string; role: string },
  write: boolean,
): Promise<boolean> {
  if (!examId) return false;
  if (user.role === 'super-admin') return true;
  if (user.role === 'admin' && !write) return true;
  if (user.role === 'instructor') {
    const r = await db.query('SELECT instructor_id FROM exam_sessions WHERE id = $1', [examId]);
    return r.rows[0]?.instructor_id === user.uid;
  }
  return false;
}

/**
 * Igual que userCanAccessExam pero para participaciones: resuelve el examen de la
 * participación y aplica la misma regla de propiedad. Cierra el IDOR de descarga
 * de grabaciones (un docente no puede bajar la de alumnos de otro examen).
 */
export async function userCanAccessParticipation(
  participationId: string,
  user: { uid: string; role: string },
  write: boolean,
): Promise<boolean> {
  if (!participationId) return false;
  if (user.role === 'super-admin') return true;
  if (user.role === 'admin' && !write) return true;
  const r = await db.query(
    'SELECT exam_session_id FROM exam_participations WHERE id = $1',
    [participationId],
  );
  const examId = r.rows[0]?.exam_session_id;
  if (!examId) return false;
  return userCanAccessExam(examId, user, write);
}
