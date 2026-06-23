import { db } from '@/lib/db';
import { broadcastAlert } from '@/lib/realtime-broadcast';

/**
 * SERVICIO LIVE SESSION (PERSISTENTE)
 * * Este servicio reemplaza la memoria RAM por PostgreSQL.
 * Gestiona el estado de los alumnos, alertas y mensajes en tiempo real.
 */

// Tipos adaptados a la base de datos
export interface Alert {
  id: string;
  studentId: string;
  studentName?: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: Date;
  evidenceUrl?: string;
}

export interface StudentSession {
  id: string; // ID de participación
  studentId: string;
  examId?: string;
  name: string;
  email?: string;
  status: 'joined' | 'in-progress' | 'submitted' | 'blocked';
  lastSnapshot?: string; // Base64 o URL de la imagen
  lastSeen: Date;
  startedAt?: Date;
  finishedAt?: Date;
  alerts: Alert[];
  unreadMessages: number; // Conteo de mensajes sin leer
}

export const liveSessionService = {

  /**
   * Registra la entrada de un estudiante al examen (Join/Rejoin)
   * 
   * DEFENSE IN DEPTH: Guard Clause + Safe Logging
   */
  joinSession: async (data: { examId: string; studentId: string; name: string; email?: string }) => {
    // ═══════════════════════════════════════════════════════════════
    // GUARD CLAUSE: Validación estricta de parámetros requeridos
    // ═══════════════════════════════════════════════════════════════
    if (!data.studentId || typeof data.studentId !== 'string') {
      console.warn('⛔ [JOIN_SESSION] Guard Clause: studentId inválido o undefined. Operación abortada.');
      return { success: false, reason: 'INVALID_STUDENT_ID' };
    }
    
    if (!data.examId || typeof data.examId !== 'string') {
      console.warn('⛔ [JOIN_SESSION] Guard Clause: examId inválido o undefined. Operación abortada.');
      return { success: false, reason: 'INVALID_EXAM_ID' };
    }

    // SAFE LOGGING
    const studentIdPreview = data.studentId?.substring?.(0, 8) ?? 'UNKNOWN';
    console.log(`📥 Join Session: ${studentIdPreview}... | Name: ${data.name}`);

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
   * 
   * DEFENSE IN DEPTH: Guard Clause + Safe Logging
   */
  reportAlert: async (data: { examId: string; studentId: string; description: string; severity: string; evidenceUrl?: string }) => {
    // ═══════════════════════════════════════════════════════════════
    // GUARD CLAUSE: Validación estricta de parámetros requeridos
    // ═══════════════════════════════════════════════════════════════
    if (!data.studentId || typeof data.studentId !== 'string') {
      console.warn('⛔ [REPORT_ALERT] Guard Clause: studentId inválido o undefined. Operación abortada.');
      return { success: false, reason: 'INVALID_STUDENT_ID' };
    }
    
    if (!data.examId || typeof data.examId !== 'string') {
      console.warn('⛔ [REPORT_ALERT] Guard Clause: examId inválido o undefined. Operación abortada.');
      return { success: false, reason: 'INVALID_EXAM_ID' };
    }

    // SAFE LOGGING
    const studentIdPreview = data.studentId?.substring?.(0, 8) ?? 'UNKNOWN';

    // ── Nivel 3: Visibilidad post-cierre ─────────────────────────────────────
    // Query el estado del examen ANTES de insertar para loguear si la alerta
    // llega durante el periodo de gracia (después de que el examen fue marcado
    // 'finished'). Esto confirma que el Graceful Shutdown está funcionando.
    const examStatusRes = await db.query(
      `SELECT status FROM exam_sessions WHERE id = $1`,
      [data.examId]
    );
    const examStatus: string = examStatusRes.rows[0]?.status ?? 'unknown';

    if (examStatus === 'finished') {
      console.warn(
        `⚠️ [Alert] Recibida alerta post-cierre para la sesión ` +
        `${data.examId.substring(0, 8)}... — Estado: ${examStatus}. ` +
        `Procesando insert (periodo de gracia activo). ` +
        `Student: ${studentIdPreview}... | Severity: ${data.severity}`
      );
    } else {
      console.log(`🚨 Alert registrada: ${studentIdPreview}... | Severity: ${data.severity} | Desc: ${data.description?.substring(0, 30)}...`);
    }

    // 1. Guardar la alerta
    const res = await db.query(
      `INSERT INTO alerts (exam_session_id, student_id, description, severity, evidence_url, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [data.examId, data.studentId, data.description, data.severity, data.evidenceUrl || null]
    );

    const alert = res.rows[0];

    // 2. Notificar al panel del proctor en tiempo real (reemplaza postgres_changes).
    await broadcastAlert(data.examId, alert);

    return alert;
  },

  /**
   * Actualiza el "latido" y la foto del estudiante
   * Se debe llamar periódicamente (ej. cada 10-30s)
   * 
   * DEFENSE IN DEPTH: Guard Clause + Safe Logging
   */
  heartbeat: async (examId: string, studentId: string, snapshot?: string) => {
    // ═══════════════════════════════════════════════════════════════
    // GUARD CLAUSE: Validación estricta de parámetros requeridos
    // Protege contra datos corruptos que lleguen desde capas superiores
    // ═══════════════════════════════════════════════════════════════
    if (!studentId || typeof studentId !== 'string') {
      console.warn('⛔ [HEARTBEAT] Guard Clause: studentId inválido o undefined. Operación abortada.');
      return { success: false, reason: 'INVALID_STUDENT_ID' };
    }
    
    if (!examId || typeof examId !== 'string') {
      console.warn('⛔ [HEARTBEAT] Guard Clause: examId inválido o undefined. Operación abortada.');
      return { success: false, reason: 'INVALID_EXAM_ID' };
    }

    // SAFE LOGGING: Usamos optional chaining para prevenir excepciones
    const studentIdPreview = studentId?.substring?.(0, 8) ?? 'UNKNOWN';
    
    if (snapshot) {
        console.log(`💓 Heartbeat OK: ${studentIdPreview}... | IMG Size: ${snapshot.length} chars`);
    } else {
        console.log(`💓 Heartbeat OK: ${studentIdPreview}... | ⚠️ Sin imagen`);
    }

    // Usamos finished_at como columna "last_seen" mientras el alumno está activo.
    // Dado que finished_at solo tiene significado real cuando status='submitted'/'blocked',
    // es seguro sobreescribirlo con NOW() durante 'joined'/'in-progress' para trazar
    // cuándo fue el último heartbeat. getExamDashboardState ya usa COALESCE(finished_at, started_at).
    const query = `
      UPDATE exam_participations 
      SET last_snapshot = COALESCE($3, last_snapshot),
          finished_at   = NOW()
      WHERE exam_session_id = $1 AND student_id = $2 AND status IN ('joined', 'in-progress')
      RETURNING id
    `;

    const result = await db.query(query, [examId, studentId, snapshot]);

    if (result.rowCount === 0) {
        console.warn(`⚠️ Heartbeat ignorado: No se encontró sesión activa para estudiante ${studentId} en examen ${examId}`);
    }
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
   * 
   * DEFENSE IN DEPTH: Guard Clause + Safe Logging
   */
  finishExam: async (examId: string, studentId: string) => {
    // ═══════════════════════════════════════════════════════════════
    // GUARD CLAUSE: Validación estricta de parámetros requeridos
    // ═══════════════════════════════════════════════════════════════
    if (!studentId || typeof studentId !== 'string') {
      console.warn('⛔ [FINISH_EXAM] Guard Clause: studentId inválido o undefined. Operación abortada.');
      return { success: false, reason: 'INVALID_STUDENT_ID' };
    }
    
    if (!examId || typeof examId !== 'string') {
      console.warn('⛔ [FINISH_EXAM] Guard Clause: examId inválido o undefined. Operación abortada.');
      return { success: false, reason: 'INVALID_EXAM_ID' };
    }

    // SAFE LOGGING
    const studentIdPreview = studentId?.substring?.(0, 8) ?? 'UNKNOWN';
    console.log(`✅ Finish Exam: ${studentIdPreview}...`);

    await db.query(
      `UPDATE exam_participations 
       SET status = 'submitted', finished_at = NOW() 
       WHERE exam_session_id = $1 AND student_id = $2`,
      [examId, studentId]
    );
    
    return { success: true };
  },

  /**
   * Retira (bloquea) a un estudiante de la evaluación. Marca status='blocked',
   * que el polling del alumno (GET /api/exam-sessions/[examId]) detecta para
   * cerrarle la sesión, y que el UPSERT de joinSession respeta para impedir el
   * reingreso. A diferencia de finishExam ('submitted'), esto sí expulsa.
   */
  blockStudent: async (examId: string, studentId: string) => {
    if (!studentId || typeof studentId !== 'string') {
      console.warn('⛔ [BLOCK_STUDENT] Guard Clause: studentId inválido. Operación abortada.');
      return { success: false, reason: 'INVALID_STUDENT_ID' };
    }
    if (!examId || typeof examId !== 'string') {
      console.warn('⛔ [BLOCK_STUDENT] Guard Clause: examId inválido. Operación abortada.');
      return { success: false, reason: 'INVALID_EXAM_ID' };
    }

    const studentIdPreview = studentId.substring(0, 8);
    console.log(`🚫 Block Student: ${studentIdPreview}... en examen ${examId.substring(0, 8)}...`);

    await db.query(
      `UPDATE exam_participations
       SET status = 'blocked', finished_at = NOW()
       WHERE exam_session_id = $1 AND student_id = $2`,
      [examId, studentId]
    );

    return { success: true };
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
        ep.exam_session_id as "examId",
        ep.student_id as "studentId",
        ep.student_name as name,
        u.email,
        ep.status,
        ep.last_snapshot as "lastSnapshot",
        ep.started_at as "startedAt",
        ep.finished_at as "finishedAt",
        -- Usamos started_at o finished_at como proxy de "visto por última vez" si no tenemos columna heartbeat dedicada
        COALESCE(ep.finished_at, ep.started_at) as "lastSeen",

        -- Subquery para contar mensajes sin leer del alumno (feedback para el profesor)
        (SELECT COUNT(*)::int FROM messages m WHERE m.student_id = ep.student_id AND m.exam_session_id = ep.exam_session_id AND m.is_read = FALSE) as "unreadMessages",

        -- Alertas más recientes del alumno (ORDER BY garantiza que LIMIT toma las últimas)
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', a.id,
              'description', a.description,
              'severity', a.severity,
              'timestamp', a.timestamp,
              'evidence_url', a.evidence_url
            ) ORDER BY a.timestamp DESC)
            FROM (
              SELECT * FROM alerts 
              WHERE exam_session_id = ep.exam_session_id AND student_id = ep.student_id
              ORDER BY timestamp DESC
              LIMIT 20
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

    // Mapeo final — alerts puede llegar como string JSON desde el REST fallback
    return result.rows.map(row => ({
      ...row,
      alerts: typeof row.alerts === 'string' ? JSON.parse(row.alerts) : (row.alerts ?? []),
      lastSeen: row.lastSeen ? new Date(row.lastSeen) : new Date(),
      startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
      finishedAt: row.finishedAt ? new Date(row.finishedAt) : undefined,
    }));
  }
};
