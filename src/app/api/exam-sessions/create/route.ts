import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db'; // Usamos nuestra conexión directa
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const user = await getAuthenticatedUser(request);

    // 2. Verificar rol (Instructor o Admin)
    if (user.role !== 'instructor' && user.role !== 'super-admin') {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Solo instructores pueden crear exámenes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, subject, section, duration, accessCode, audioDisabled } = body;

    // 3. Validación de campos
    if (!title || !subject || !section || !duration || !accessCode) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // 3.1 Validación de formato de datos
    const parsedDuration = parseInt(duration);
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return NextResponse.json({ error: 'Duración inválida' }, { status: 400 });
    }

    if (typeof accessCode !== 'string' || accessCode.trim().length < 4) {
      return NextResponse.json({ error: 'Código de acceso inválido' }, { status: 400 });
    }

    // 5. Insertar en PostgreSQL. Incluimos audio_disabled (modo presencial); si
    // la columna aún no está migrada, reintentamos sin ella.
    const baseCols = 'title, subject, section, duration, access_code, instructor_id, instructor_name, status';
    const baseVals = [title, subject, section, parseInt(duration), accessCode, user.uid, user.email];
    const doInsert = (withAudio: boolean) => db.query(
      withAudio
        ? `INSERT INTO exam_sessions (${baseCols}, audio_disabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
           RETURNING id, access_code, title`
        : `INSERT INTO exam_sessions (${baseCols})
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
           RETURNING id, access_code, title`,
      withAudio ? [...baseVals, !!audioDisabled] : baseVals,
    );

    let result;
    try {
      result = await doInsert(true);
    } catch (e: any) {
      const missing = e?.code === '42703' || /column .*audio_disabled.* does not exist/i.test(e?.message ?? '');
      if (missing) result = await doInsert(false); // columna aún no migrada
      else throw e;
    }

    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (error: any) {
    console.error('Error creating exam session:', error);

    // Manejo de código duplicado (Error Unique de Postgres 23505)
    if (error?.code === '23505') {
        return NextResponse.json(
            { error: 'El código de acceso ya está en uso. Por favor genera uno nuevo.' }, 
            { status: 409 }
        );
    }

    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}