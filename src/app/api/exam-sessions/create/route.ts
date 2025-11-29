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
    const { title, subject, section, duration, accessCode } = body;

    // 3. Validación de campos
    if (!title || !subject || !section || !duration || !accessCode) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // 4. Insertar en PostgreSQL (Nuevo Esquema)
    // Nota: Ya no insertamos 'students' aquí. Los estudiantes se unen después.
    const query = `
      INSERT INTO exam_sessions (
        title, 
        subject, 
        section, 
        duration, 
        access_code, 
        instructor_id, 
        instructor_name, 
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING id, access_code, title
    `;

    const result = await db.query(query, [
      title,
      subject,
      section,
      parseInt(duration), // Asegurar entero
      accessCode,
      user.uid,   // ID real de Azure AD
      user.email  // Usamos email como nombre de respaldo si no hay nombre display
    ]);

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