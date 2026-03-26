import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (user.role !== 'student') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const result = await db.query(
      `SELECT
        es.id,
        es.title,
        es.subject,
        es.section,
        es.duration,
        es.access_code,
        es.status,
        ep.started_at  AS participation_date,
        ep.status      AS participation_status
       FROM exam_participations ep
       JOIN exam_sessions es ON es.id = ep.exam_session_id
       WHERE ep.student_id = $1
       ORDER BY ep.started_at DESC`,
      [user.uid]
    );

    return NextResponse.json({ sessions: result.rows });
  } catch (error: any) {
    console.error('Error fetching student sessions:', error);

    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
