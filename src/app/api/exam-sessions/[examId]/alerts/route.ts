import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Next.js 15: params debe ser awaited
    const { examId } = await params;

    // Get alerts for the session — JOIN exam_participations to resolve student_name
    const alertsResult = await db.query(
      `SELECT 
        a.id,
        a.student_id,
        ep.student_name,
        a.severity,
        a.description,
        a.evidence_url,
        a.timestamp
       FROM alerts a
       LEFT JOIN exam_participations ep
         ON ep.exam_session_id = a.exam_session_id
         AND ep.student_id = a.student_id
       WHERE a.exam_session_id = $1
       ORDER BY a.timestamp ASC`,
      [examId]
    );

    // Get student details for the session — correct table is exam_participations
    const studentDetailsResult = await db.query(
      `SELECT 
        id,
        student_id,
        student_name as name,
        started_at,
        finished_at
       FROM exam_participations
       WHERE exam_session_id = $1`,
      [examId]
    );

    return NextResponse.json({
      alerts: alertsResult.rows,
      studentDetails: studentDetailsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching session data:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos de la sesión' },
      { status: 500 }
    );
  }
}
