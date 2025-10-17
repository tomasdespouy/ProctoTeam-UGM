import { NextRequest, NextResponse } from 'next/server';
import { getExamSessionsByInstructor } from '@/lib/exam-session-postgres';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getAuthenticatedUser(request);
    
    // Solo instructores y super-admins pueden ver sesiones
    if (user.role !== 'instructor' && user.role !== 'super-admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get('instructorId');

    if (!instructorId) {
      return NextResponse.json(
        { error: 'Instructor ID is required' },
        { status: 400 }
      );
    }

    // Si es instructor, solo puede ver sus propias sesiones
    if (user.role === 'instructor' && user.uid !== instructorId) {
      return NextResponse.json(
        { error: 'Can only view your own sessions' },
        { status: 403 }
      );
    }

    const sessions = await getExamSessionsByInstructor(instructorId);
    
    return NextResponse.json(sessions, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching exam sessions:', error);
    
    if (error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
