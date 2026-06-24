import { NextRequest, NextResponse } from 'next/server';
import { upsertUser } from '@/lib/auth-postgres';
import { requireRole } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Solo un super-admin autenticado puede crear/actualizar usuarios manualmente.
    const authError = await requireRole(['super-admin'])(request);
    if (authError) return authError;

    const body = await request.json();
    const { uid, email, nombre, photo_url } = body;

    if (!uid || !email || !nombre) {
      return NextResponse.json(
        { error: 'Missing required fields: uid, email, nombre' },
        { status: 400 }
      );
    }

    const user = await upsertUser({
      uid,
      email,
      nombre,
      photo_url: photo_url || undefined,
    });

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
