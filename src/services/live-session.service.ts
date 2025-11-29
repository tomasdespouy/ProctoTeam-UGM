import { db } from '@/lib/db';

/**
 * SERVICIO LIVE SESSION (PERSISTENTE)
 * * Este servicio reemplaza la memoria RAM por PostgreSQL.
 * Gestiona el estado de los alumnos, alertas y mensajes en tiempo real.
 */

// Tipos adaptados a la base de datos
export interface Alert {
  id: string;
  studentId: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: Date;
  evidenceUrl?: string;
}

export interface StudentSession {
  id: string; // ID de participación
  studentId: string;
  name: string;
  email?: string;
  status: 'joined' | 'in-progress' | 'submitted' | 'blocked';
  lastSnapshot?: string; // Base64 o URL de la imagen
  lastSeen: Date;
  alerts: Alert[];
  unreadMessages: number; // Conteo de mensajes sin leer
}

export const liveSessionService = {

  /**
   * Registra la entrada de un estudiante al examen (Join/Rejoin)
   */
  joinSession: async (data: { examId: string; studentId: string; name: string; email?: string }) => {
    // Usamos UPSERT: Si ya existe, actualizamos su estado a 'in-progress' y su última conexión
    const query = `
      INSERT INTO exam_participations (exam_session_id, student_id, student_name, status, started_at, last_snapshot)
      VALUES ($1, $2, $3, 'in-progress', NOW(), NULL)
      ON CONFLICT (exam_session_id, student_id) 
      DO UPDATE SET 
        status = CASE WHEN exam_participations.status = 'blocked' THEN 'blocked' ELSE 'in-progress' END,
        student_name = $3
      RETURNING *;
    `;
    const res = await db.query(query, [data.examId, data.studentId, data.name]);
    return res.rows[0];
  },

  /**
   * Reporta una alerta de comportamiento sospechoso
   */
  reportAlert: async (data: { examId: string; studentId: string; description: string; severity: string; evidenceUrl?: string }) => {
    // 1. Guardar la alerta
    const res = await db.query(
      `INSERT INTO alerts (exam_session_id, student_id, description, severity, evidence_url, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [data.examId, data.studentId, data.description, data.severity, data.evidenceUrl || null]
    );

    // 2. (Opcional) Si la severidad es crítica, podríamos cambiar el estado del alumno aquí
    // pero por ahora solo registramos.

    return res.rows[0];
  },

  /**
   * Actualiza el "latido" y la foto del estudiante
   * Se debe llamar periódicamente (ej. cada 10-30s)
   */
  heartbeat: async (examId: string, studentId: string, snapshot?: string) => {
    // Solo actualizamos si el alumno no ha finalizado
    const query = `
      UPDATE exam_participations 
      SET last_snapshot = COALESCE($3, last_snapshot)
      WHERE exam_session_id = $1 AND student_id = $2 AND status IN ('joined', 'in-progress')
    `;
    await db.query(query, [examId, studentId, snapshot]);
  },

  /**
   * Envía un mensaje del instructor al estudiante
   */
  sendMessage: async (examId: string, studentId: string, message: string) => {
    await db.query(
      `INSERT INTO messages (exam_session_id, student_id, message) VALUES ($1, $2, $3)`,
      [examId, studentId, message]
    );
  },

  /**
   * Obtiene y marca como leídos los mensajes para un estudiante
   */
  getMyMessages: async (examId: string, studentId: string) => {
    // Transacción implícita: Leer y luego marcar
    // 1. Obtener mensajes no leídos
    const res = await db.query(
      `SELECT message, created_at FROM messages 
       WHERE exam_session_id = $1 AND student_id = $2 AND is_read = FALSE
       ORDER BY created_at ASC`,
      [examId, studentId]
    );

    // 2. Marcarlos como leídos (si hubo alguno)
    if (res.rowCount && res.rowCount > 0) {
      await db.query(
        `UPDATE messages SET is_read = TRUE 
         WHERE exam_session_id = $1 AND student_id = $2 AND is_read = FALSE`,
        [examId, studentId]
      );
    }

    return res.rows.map(r => r.message);
  },

  /**
   * Finaliza el examen (Submit)
   */
  finishExam: async (examId: string, studentId: string) => {
    await db.query(
      `UPDATE exam_participations 
       SET status = 'submitted', finished_at = NOW() 
       WHERE exam_session_id = $1 AND student_id = $2`,
      [examId, studentId]
    );
  },

  /**
   * Fuerza el cierre de un examen y marca a todos los participantes como finalizados
   */
  forceCloseExam: async (examId: string) => {
    // 1. Marcar todos los estudiantes como 'submitted'
    await db.query(
      `UPDATE exam_participations 
       SET status = 'submitted', finished_at = NOW() 
       WHERE exam_session_id = $1 AND status IN ('joined', 'in-progress')`,
      [examId]
    );

    // 2. Marcar el examen como finalizado
    await db.query(
      `UPDATE exam_sessions SET status = 'finished', updated_at = NOW() WHERE id = $1`,
      [examId]
    );
  },

  /**
   * OBTIENE EL ESTADO COMPLETO DEL EXAMEN (Para el Dashboard del Profesor)
   * Devuelve: Lista de alumnos, sus estados, últimas alertas y mensajes pendientes.
   */
  getExamDashboardState: async (examId: string): Promise<StudentSession[]> => {
    const query = `
      SELECT 
        ep.id,
        ep.student_id as "studentId",
        ep.student_name as name,
        u.email,
        ep.status,
        ep.last_snapshot as "lastSnapshot",
        -- Usamos started_at o finished_at como proxy de "visto por última vez" si no tenemos columna heartbeat dedicada
        COALESCE(ep.finished_at, ep.started_at) as "lastSeen",

        -- Subquery para contar mensajes sin leer del alumno (feedback para el profesor)
        (SELECT COUNT(*)::int FROM messages m WHERE m.student_id = ep.student_id AND m.exam_session_id = ep.exam_session_id AND m.is_read = FALSE) as "unreadMessages",

        -- Agregamos las últimas 5 alertas como JSON
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', a.id,
              'description', a.description,
              'severity', a.severity,
              'timestamp', a.timestamp
            ) ORDER BY a.timestamp DESC)
            FROM (
              SELECT * FROM alerts 
              WHERE exam_session_id = ep.exam_session_id AND student_id = ep.student_id 
              LIMIT 5
            ) a
          ), 
          '[]'
        ) as alerts

      FROM exam_participations ep
      LEFT JOIN users u ON ep.student_id = u.uid
      WHERE ep.exam_session_id = $1
      ORDER BY ep.student_name ASC
    `;

    const result = await db.query(query, [examId]);

    // Mapeo final
    return result.rows.map(row => ({
      ...row,
      alerts: row.alerts,
      lastSeen: new Date(row.lastSeen) // Asegurar objeto Date
    }));
  }
};