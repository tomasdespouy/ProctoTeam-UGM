import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    // 1. Autenticación estricta
    const user = await getAuthenticatedUser(request);
    // Next.js 15: params debe ser awaited
    const { examId } = await params;

    if (!examId) {
      return NextResponse.json({ error: 'ID de examen requerido' }, { status: 400 });
    }

    // 2. Detección de Tipo de ID (UUID vs Código Corto)
    // Regex para UUID v4 estándar
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(examId);

    let query = '';

    // 3. Construcción de Query Segura
    // [CORRECCIÓN BACKEND]: Se incluye ep.started_at en el SELECT de ambas queries
    if (isUUID) {
        query = `
          SELECT es.id, es.title, es.subject, es.section, es.duration, es.status as exam_status,
                 ep.id as participation_id, ep.status as student_status, ep.started_at as student_started_at
          FROM exam_sessions es
          LEFT JOIN exam_participations ep ON es.id = ep.exam_session_id AND ep.student_id = $2
          WHERE es.id = $1
        `;
    } else {
        query = `
          SELECT es.id, es.title, es.subject, es.section, es.duration, es.status as exam_status,
                 ep.id as participation_id, ep.status as student_status, ep.started_at as student_started_at
          FROM exam_sessions es
          LEFT JOIN exam_participations ep ON es.id = ep.exam_session_id AND ep.student_id = $2
          WHERE es.access_code = $1
        `;
    }

    const result = await db.query(query, [examId, user.uid]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    }

    const data = result.rows[0];

    return NextResponse.json({
      exam: {
        id: data.id,
        title: data.title,
        subject: data.subject,
        section: data.section,
        duration: data.duration,
        status: data.exam_status,
        startedAt: data.student_started_at ? data.student_started_at.toISOString() : null,
      },
      studentStatus:   data.student_status,
      participationId: data.participation_id ?? null,  // UUID para WebRTC (StudentCam)
    });

  } catch (error: any) {
    console.error('API Error fetching exam:', error);
    if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}