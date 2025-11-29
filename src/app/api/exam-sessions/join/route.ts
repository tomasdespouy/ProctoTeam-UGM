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

    if (exam.status === 'finished') {
        return NextResponse.json({ error: 'Este examen ya ha finalizado.' }, { status: 403 });
    }

    // 3. (Opcional pero recomendado) Registrar la intención de participación
    // Esto crea la fila en exam_participations con estado 'joined' antes de que empiece el monitoreo
    await db.query(
        `INSERT INTO exam_participations (exam_session_id, student_id, student_name, status)
         VALUES ($1, $2, $3, 'joined')
         ON CONFLICT (exam_session_id, student_id) DO NOTHING`,
        [exam.id, user.uid, user.email]
    );

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