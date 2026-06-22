import { NextRequest, NextResponse } from 'next/server';
import { upsertUser, getUserByEmail } from '@/lib/auth-postgres';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

// Secret used only for signing dev tokens — never exposed to production
const DEV_JWT_SECRET = process.env.DEV_JWT_SECRET ?? 'ugm-proctor-dev-secret-2024';

export async function POST(request: NextRequest) {
  const allowTestLogin = process.env.ALLOW_TEST_LOGIN === 'true';
  if (process.env.NODE_ENV !== 'development' && !allowTestLogin) {
    return NextResponse.json(
      { error: 'Este endpoint solo está disponible en desarrollo' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email, password, role: forceRole } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const teacherEmail = (process.env.DEV_TEACHER_EMAIL ?? 'docente@ugm.cl').toLowerCase().trim();
    const teacherPassword = process.env.DEV_TEACHER_PASSWORD ?? 'Docente123!';

    if (!emailLower.includes('@')) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
    }

    let requestedRole = forceRole;

    if (emailLower === teacherEmail || password) {
      if (password !== teacherPassword) {
        return NextResponse.json(
          { error: 'Credenciales de docente invÃ¡lidas' },
          { status: 401 }
        );
      }
      requestedRole = requestedRole ?? 'instructor';
    }

    let user = await getUserByEmail(emailLower);

    if (!user) {
      const mockUid = `dev-${randomUUID()}`;
      const nombre = emailLower.split('@')[0].replace(/[._]/g, ' ');

      user = await upsertUser({
        uid: mockUid,
        email: emailLower,
        nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1)
      });
    }

    // In development only: allow forcing a specific role (e.g. super-admin)
    const validRoles = ['student', 'instructor', 'super-admin'];
    if (requestedRole && validRoles.includes(requestedRole) && user.role !== requestedRole) {
      const { query } = await import('@/lib/db');
      await query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE uid = $2`,
        [requestedRole, user.uid]
      );
      user = { ...user, role: requestedRole as 'student' | 'instructor' | 'super-admin' };
    }

    // Generate a properly-structured JWT so that auth-middleware.ts can decode it.
    // The middleware uses jwt.decode() (no signature verification) and reads:
    //   oid || sub || uid  → for the user ID
    //   email || preferred_username || upn  → for the email
    const devToken = jwt.sign(
      {
        sub: user.uid,
        oid: user.uid,
        uid: user.uid,
        email: user.email,
        preferred_username: user.email,
        name: user.nombre,
        dev: true,          // marker so logs can identify dev sessions
      },
      DEV_JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({
      success: true,
      devToken,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        photo_url: user.photo_url
      }
    });

  } catch (error: any) {
    console.error('Dev-login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
