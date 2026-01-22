import { NextRequest, NextResponse } from 'next/server';
import { upsertUser, getUserByEmail } from '@/lib/auth-postgres';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Este endpoint solo está disponible en desarrollo' },
      { status: 403 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    if (!emailLower.includes('@')) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
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
