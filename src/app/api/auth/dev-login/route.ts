import { NextRequest, NextResponse } from 'next/server';
import { upsertUser, getUserByEmail } from '@/lib/auth-postgres';
import { query } from '@/lib/db';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

// Secretos OBLIGATORIOS — sin valores por defecto. Si faltan, dev-login se desactiva.
const DEV_JWT_SECRET = process.env.DEV_JWT_SECRET;
const DEV_LOGIN_PASSWORD = process.env.DEV_LOGIN_PASSWORD;

export async function POST(request: NextRequest) {
  // 1. El feature debe estar habilitado para este entorno.
  const allowTestLogin = process.env.ALLOW_TEST_LOGIN === 'true';
  if (process.env.NODE_ENV !== 'development' && !allowTestLogin) {
    return NextResponse.json(
      { error: 'Este endpoint solo está disponible en desarrollo' },
      { status: 403 }
    );
  }

  // 2. Debe estar correctamente configurado (sin secretos hardcodeados).
  if (!DEV_JWT_SECRET || !DEV_LOGIN_PASSWORD) {
    console.error(
      '[dev-login] DEV_JWT_SECRET o DEV_LOGIN_PASSWORD no configurados — dev-login deshabilitado'
    );
    return NextResponse.json(
      { error: 'Dev-login no está configurado en este entorno' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { email, password, role: forceRole } = body;

    // 3. Clave de acceso OBLIGATORIA para cualquier dev-login (cierra el backdoor abierto).
    if (!password || password !== DEV_LOGIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Clave de acceso de desarrollo inválida' },
        { status: 401 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();

    let user = await getUserByEmail(emailLower);

    if (!user) {
      const mockUid = `dev-${randomUUID()}`;
      const nombre = emailLower.split('@')[0].replace(/[._]/g, ' ');
      user = await upsertUser({
        uid: mockUid,
        email: emailLower,
        nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      });
    }

    // 4. Forzado de rol — ya protegido por la clave de acceso de arriba.
    const validRoles = ['student', 'instructor', 'super-admin'];
    const requestedRole = forceRole && validRoles.includes(forceRole) ? forceRole : null;
    if (requestedRole && user.role !== requestedRole) {
      await query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE uid = $2`,
        [requestedRole, user.uid]
      );
      user = { ...user, role: requestedRole as 'student' | 'instructor' | 'super-admin' };
    }

    // Token de desarrollo (HS256 + claim dev:true) que auth-middleware sabe verificar.
    const devToken = jwt.sign(
      {
        sub: user.uid,
        oid: user.uid,
        uid: user.uid,
        email: user.email,
        preferred_username: user.email,
        name: user.nombre,
        dev: true,
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
        photo_url: user.photo_url,
      },
    });
  } catch (error: any) {
    console.error('Dev-login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
