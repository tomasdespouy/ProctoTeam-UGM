import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

// Lista los exámenes ACTIVOS (en curso) para que un observador o super-admin
// pueda elegir cuál mirar en tiempo real. Solo lectura.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'observer' && user.role !== 'super-admin' && user.role !== 'instructor') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const result = await db.query(`
      SELECT es.id, es.title, es.subject, es.section, es.created_at,
             u.nombre AS instructor_name,
             (SELECT COUNT(*) FROM exam_participations ep WHERE ep.exam_session_id = es.id) AS student_count
      FROM exam_sessions es
      LEFT JOIN users u ON es.instructor_id = u.uid
      WHERE es.status = 'active'
      ORDER BY es.created_at DESC
    `);

    return NextResponse.json({ sessions: result.rows });
  } catch (error: any) {
    console.error('Active exams API error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
