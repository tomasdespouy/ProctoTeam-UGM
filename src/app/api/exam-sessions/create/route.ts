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
    const { title, subject, section, duration } = body;

    // 3. Validación de campos (accessCode ya no viene del body)
    if (!title || !subject || !section || !duration) {
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

    // 4. Generación de código único recursivo
    const generateUniqueCode = async (): Promise<string> => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evitamos I, O, 0, 1 para legibilidad
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Verificar si existe
        const exists = await db.query('SELECT 1 FROM exam_sessions WHERE access_code = $1', [code]);
        if (exists.rowCount && exists.rowCount > 0) {
            return generateUniqueCode();
        }
        return code;
    };

    const accessCode = await generateUniqueCode();

    // 5. Insertar en PostgreSQL (Nuevo Esquema)
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