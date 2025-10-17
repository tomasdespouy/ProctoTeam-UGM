import { NextRequest, NextResponse } from 'next/server';
import { upsertUser } from '@/lib/auth-postgres';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, email, nombre, role, photo_url } = body;

    if (!uid || !email || !nombre || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: uid, email, nombre, role' },
        { status: 400 }
      );
    }

    // Validar rol
    if (!['student', 'instructor', 'super-admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: student, instructor, or super-admin' },
        { status: 400 }
      );
    }

    const user = await upsertUser({
      uid,
      email,
      nombre,
      role,
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
