import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { createManagedUser, getUserByEmail } from '@/lib/auth-postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const result = await db.query(`
      SELECT
        u.id,
        u.uid,
        u.email,
        u.nombre,
        u.role,
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM exam_sessions es WHERE es.instructor_id = u.uid) AS exams_created
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 200
    `);

    return NextResponse.json({ users: result.rows });
  } catch (error: any) {
    console.error('Admin users API error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { email, nombre, role } = await request.json();
    const validRoles = ['student', 'instructor', 'super-admin'];

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email válido requerido' }, { status: 400 });
    }
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const existing = await getUserByEmail(emailLower);
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese email' },
        { status: 409 }
      );
    }

    const created = await createManagedUser({ email: emailLower, nombre, role });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error: any) {
    console.error('Admin POST user error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    // 23505 = unique_violation (email duplicado, carrera con otra petición)
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { uid, role } = await request.json();
    const validRoles = ['student', 'instructor', 'super-admin'];

    if (!uid || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'uid y role válidos son requeridos' }, { status: 400 });
    }

    // Prevent demoting the last super-admin
    if (role !== 'super-admin') {
      const check = await db.query(
        `SELECT COUNT(*) FROM users WHERE role = 'super-admin' AND uid != $1`,
        [uid]
      );
      if (parseInt(check.rows[0].count) === 0) {
        return NextResponse.json({ error: 'No puedes cambiar el rol del último super-admin' }, { status: 400 });
      }
    }

    const result = await db.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE uid = $2 RETURNING id, uid, email, nombre, role`,
      [role, uid]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ user: result.rows[0] });
  } catch (error: any) {
    console.error('Admin PATCH user error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
