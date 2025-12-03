import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { examId } = params;

    if (!examId) {
      return NextResponse.json({ error: 'Exam ID required' }, { status: 400 });
    }

    // Consultamos el examen y el estado específico del estudiante en ese examen
    const query = `
      SELECT 
        es.title,
        es.subject,
        es.section,
        es.duration,
        es.status as exam_status,
        ep.status as student_status
      FROM exam_sessions es
      LEFT JOIN exam_participations ep ON es.id = ep.exam_session_id AND ep.student_id = $2
      WHERE es.id = $1
    `;

    const result = await db.query(query, [examId, user.uid]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    }

    const data = result.rows[0];

    return NextResponse.json({
      exam: {
        title: data.title,
        subject: data.subject,
        section: data.section,
        duration: data.duration,
        status: data.exam_status,
      },
      studentStatus: data.student_status // 'joined', 'in-progress', 'blocked', 'submitted'
    });

  } catch (error: any) {
    console.error('Error fetching exam details:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}