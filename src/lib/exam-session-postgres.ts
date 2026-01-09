import { query, getClient } from './db';

export interface ExamSession {
  id: string;
  title: string;
  subject: string;
  section: string;
  duration: number;
  access_code: string;
  instructor_id: string;
  instructor_name?: string;
  status: 'pending' | 'active' | 'finished';
  created_at: Date;
  updated_at: Date;
}

export interface BlockedStudent {
  uid: string;
  reason: string;
  timestamp: Date;
}

export interface Alert {
  id: string;
  exam_session_id: string;
  student_id: string;
  student_name?: string;
  severity: string;
  description: string;
  timestamp: Date;
}

export interface StudentDetail {
  id: string;
  exam_session_id: string;
  student_id: string;
  student_name: string;
  start_time: number;
  finish_time: number;
  created_at: Date;
}

// Crear sesión de examen
export async function createExamSession(sessionData: {
  title: string;
  subject: string;
  section: string;
  duration: number;
  access_code: string;
  instructor_id: string;
  instructor_name?: string;
}): Promise<ExamSession> {
  const result = await query(
    `INSERT INTO exam_sessions 
     (title, subject, section, duration, access_code, instructor_id, instructor_name, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING *`,
    [
      sessionData.title,
      sessionData.subject,
      sessionData.section,
      sessionData.duration,
      sessionData.access_code,
      sessionData.instructor_id,
      sessionData.instructor_name || null,
    ]
  );
  
  return result.rows[0] as ExamSession;
}

// Obtener sesión por código de acceso
export async function getExamSessionByCode(accessCode: string): Promise<ExamSession | null> {
  const result = await query(
    'SELECT * FROM exam_sessions WHERE access_code = $1',
    [accessCode]
  );
  
  return result.rows.length > 0 ? (result.rows[0] as ExamSession) : null;
}

// Obtener sesión por ID
export async function getExamSessionById(id: string): Promise<ExamSession | null> {
  const result = await query(
    'SELECT * FROM exam_sessions WHERE id = $1',
    [id]
  );
  
  return result.rows.length > 0 ? (result.rows[0] as ExamSession) : null;
}

// Obtener sesiones por instructor
export async function getExamSessionsByInstructor(instructorId: string): Promise<ExamSession[]> {
  const result = await query(
    'SELECT * FROM exam_sessions WHERE instructor_id = $1 ORDER BY created_at DESC',
    [instructorId]
  );
  
  return result.rows as ExamSession[];
}

// Obtener todas las sesiones (para super-admin)
export async function getAllExamSessions(): Promise<ExamSession[]> {
  const result = await query(
    `SELECT 
      es.*,
      u.nombre as instructor_name,
      COUNT(DISTINCT sd.student_id) as student_count
    FROM exam_sessions es
    LEFT JOIN users u ON es.instructor_id = u.uid
    LEFT JOIN student_details sd ON es.id = sd.exam_session_id
    GROUP BY es.id, u.nombre
    ORDER BY es.created_at DESC`
  );
  
  return result.rows as ExamSession[];
}

// Actualizar estado de sesión
export async function updateExamSessionStatus(
  id: string,
  status: 'pending' | 'active' | 'finished'
): Promise<void> {
  await query(
    'UPDATE exam_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, id]
  );
}

// Agregar estudiante bloqueado
export async function addBlockedStudent(
  sessionId: string,
  blockedStudent: BlockedStudent
): Promise<void> {
  await query(
    `UPDATE exam_participations 
     SET status = 'blocked', updated_at = NOW() 
     WHERE exam_session_id = $1 AND student_id = $2`,
    [sessionId, blockedStudent.uid]
  );
}

// Agregar alerta
export async function addAlert(alertData: {
  exam_session_id: string;
  student_id: string;
  student_name?: string;
  severity: string;
  description: string;
}): Promise<Alert> {
  const result = await query(
    `INSERT INTO alerts 
     (exam_session_id, student_id, student_name, severity, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      alertData.exam_session_id,
      alertData.student_id,
      alertData.student_name || null,
      alertData.severity,
      alertData.description,
    ]
  );
  
  return result.rows[0] as Alert;
}

// Obtener alertas de una sesión
export async function getAlertsBySession(sessionId: string): Promise<Alert[]> {
  const result = await query(
    'SELECT * FROM alerts WHERE exam_session_id = $1 ORDER BY timestamp DESC',
    [sessionId]
  );
  
  return result.rows as Alert[];
}

// Agregar detalle de estudiante
export async function addStudentDetail(detailData: {
  exam_session_id: string;
  student_id: string;
  student_name: string;
  start_time: number;
  finish_time: number;
}): Promise<StudentDetail> {
  const result = await query(
    `INSERT INTO student_details 
     (exam_session_id, student_id, student_name, start_time, finish_time)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      detailData.exam_session_id,
      detailData.student_id,
      detailData.student_name,
      detailData.start_time,
      detailData.finish_time,
    ]
  );
  
  return result.rows[0] as StudentDetail;
}

// Obtener detalles de estudiantes de una sesión
export async function getStudentDetailsBySession(sessionId: string): Promise<StudentDetail[]> {
  const result = await query(
    'SELECT * FROM student_details WHERE exam_session_id = $1 ORDER BY created_at DESC',
    [sessionId]
  );
  
  return result.rows as StudentDetail[];
}
