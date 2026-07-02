import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { liveSessionService } from '@/services/live-session.service';

// Forzar que esta ruta sea dinámica (no cacheada estáticamente) para tener datos frescos
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Seguridad: Verificar que sea Super Admin
    const user = await getAuthenticatedUser(request);

    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de Super Admin.' }, { status: 403 });
    }

    // Auto-cierre perezoso de salas abandonadas (no rompe el endpoint si falla).
    try { await liveSessionService.autoCloseStaleExams(); } catch (e) { console.error('[autoClose] error:', e); }

    // Query B: lista de exámenes. Incluye columnas nuevas (section, started_at,
    // ended_at, faculty, school) + conteo de alertas críticas y de advertencia.
    // Si alguna columna no está migrada, cae a una versión mínima.
    const examsQuery = (full: boolean) => db.query(`
        SELECT
          es.id, es.title, es.subject, es.section, es.status, es.created_at, es.access_code,
          ${full
            ? 'es.started_at, es.ended_at, es.faculty, es.school,'
            : 'NULL AS started_at, NULL AS ended_at, NULL AS faculty, NULL AS school,'}
          u.nombre as instructor_name,
          u.email as instructor_email,
          (SELECT COUNT(*) FROM exam_participations ep WHERE ep.exam_session_id = es.id) as student_count,
          (SELECT COUNT(*) FROM alerts a WHERE a.exam_session_id = es.id AND a.severity = 'critical') as critical_alerts,
          (SELECT COUNT(*) FROM alerts a WHERE a.exam_session_id = es.id AND a.severity = 'warning') as warning_alerts
        FROM exam_sessions es
        LEFT JOIN users u ON es.instructor_id = u.uid
        ORDER BY es.created_at DESC
        LIMIT 100
    `);

    const statsResult = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM exam_sessions) as total_exams,
        (SELECT COUNT(*) FROM exam_sessions WHERE status = 'active') as active_exams,
        (SELECT COUNT(*) FROM users WHERE role = 'student') as total_students,
        (SELECT COUNT(*) FROM users WHERE role = 'instructor') as total_instructors
    `);

    let examsResult;
    try {
      examsResult = await examsQuery(true);
    } catch (e: any) {
      if (e?.code === '42703' || /column .* does not exist/i.test(e?.message ?? '')) {
        examsResult = await examsQuery(false);
      } else {
        throw e;
      }
    }

    // Procesar resultados
    const statsRow = statsResult.rows[0];
    const stats = {
        totalExams: parseInt(statsRow.total_exams || '0'),
        activeExams: parseInt(statsRow.active_exams || '0'),
        totalStudents: parseInt(statsRow.total_students || '0'),
        totalInstructors: parseInt(statsRow.total_instructors || '0')
    };

    const exams = examsResult.rows;

    return NextResponse.json({
      stats,
      exams
    });

  } catch (error: any) {
    console.error('Admin Dashboard API Error:', error);

    // Si el error es de autenticación, devolvemos 401
    if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}