import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar que es un usuario logueado (estudiante)
    const user = await getAuthenticatedUser(request);

    const body = await request.json();
    const { accessCode } = body;

    if (!accessCode) {
      return NextResponse.json({ error: 'Código de acceso requerido' }, { status: 400 });
    }

    // 2. Buscar el examen por código
    const examResult = await db.query(
      `SELECT id, title, status FROM exam_sessions WHERE access_code = $1`,
      [accessCode]
    );

    if (examResult.rowCount === 0) {
      return NextResponse.json({ error: 'Examen no encontrado. Verifica el código.' }, { status: 404 });
    }

    const exam = examResult.rows[0];

    // Validación de estado del examen
    if (exam.status === 'finished') {
        return NextResponse.json({ error: 'Este examen ya ha finalizado y no acepta más ingresos.' }, { status: 403 });
    }

    // 3. Registrar la intención de participación (IDEMPOTENTE)
    // Usamos ON CONFLICT para manejar si el estudiante ya se había unido antes
    // IMPORTANTE: NO actualizamos started_at si ya existe para evitar reinicio de tiempo
    await db.query(
        `INSERT INTO exam_participations (exam_session_id, student_id, student_name, status, started_at)
         VALUES ($1, $2, $3, 'joined', NOW())
         ON CONFLICT (exam_session_id, student_id) 
         DO UPDATE SET 
            status = CASE 
                WHEN exam_participations.status = 'submitted' THEN 'submitted'
                WHEN exam_participations.status = 'blocked' THEN 'blocked'
                ELSE 'joined' 
            END,
            updated_at = NOW()`,
        [exam.id, user.uid, user.email]
    );

    // Verificar si el estudiante está bloqueado
    const checkStatus = await db.query(
        `SELECT status FROM exam_participations WHERE exam_session_id = $1 AND student_id = $2`,
        [exam.id, user.uid]
    );

    if (checkStatus.rows[0].status === 'blocked') {
        return NextResponse.json({ error: 'Tu acceso a este examen ha sido bloqueado por el instructor.' }, { status: 403 });
    }

    // 4. Retornar el ID para que el frontend redirija a /student/exam/[id]
    return NextResponse.json({ 
        examId: exam.id, 
        title: exam.title,
        success: true 
    });

  } catch (error: any) {
    console.error('Error joining exam:', error);
    return NextResponse.json({ error: 'Error al unirse al examen' }, { status: 500 });
  }
}