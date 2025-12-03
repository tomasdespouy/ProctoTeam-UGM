import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import db from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const examId = params.examId;

    // Get alerts for the session
    const alertsResult = await db.query(
      `SELECT 
        id, 
        student_id, 
        student_name, 
        severity, 
        description, 
        created_at as timestamp
       FROM alerts 
       WHERE exam_session_id = $1 
       ORDER BY created_at ASC`,
      [examId]
    );

    // Get student details for the session
    const studentDetailsResult = await db.query(
      `SELECT 
        id, 
        student_id, 
        student_name as name, 
        start_time, 
        finish_time
       FROM student_details 
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
