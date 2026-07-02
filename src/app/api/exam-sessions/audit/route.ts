import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

// Lista TODOS los exámenes (para auditoría de grabaciones/alertas). Solo lectura,
// para el rol 'admin' (auditor) y 'super-admin'.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'admin' && user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const result = await db.query(`
      SELECT es.id, es.title, es.subject, es.section, es.status, es.created_at,
             u.nombre AS instructor_name, u.email AS instructor_email,
             (SELECT COUNT(*) FROM exam_participations ep WHERE ep.exam_session_id = es.id) AS student_count,
             (SELECT COUNT(*) FROM alerts a WHERE a.exam_session_id = es.id) AS alert_count
      FROM exam_sessions es
      LEFT JOIN users u ON es.instructor_id = u.uid
      ORDER BY es.created_at DESC
      LIMIT 500
    `);

    return NextResponse.json({ sessions: result.rows });
  } catch (error: any) {
    console.error('Audit exams API error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
