import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener usuario autenticado
    const user = await getAuthenticatedUser(request);

    // 2. Verificar Rol
    if (user.role !== 'instructor' && user.role !== 'super-admin') {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // 3. Buscar sesiones donde este usuario es el instructor
    // Nota: Usamos user.uid directamente, más seguro que leer query params
    const query = `
      SELECT 
        id,
        title,
        subject,
        section,
        duration,
        access_code,
        status,
        created_at,
        (SELECT COUNT(*) FROM exam_participations ep WHERE ep.exam_session_id = es.id) as student_count
      FROM exam_sessions es
      WHERE instructor_id = $1
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [user.uid]);

    return NextResponse.json({ sessions: result.rows });

  } catch (error: any) {
    console.error('Error fetching instructor sessions:', error);

    if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}