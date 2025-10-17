import { NextRequest, NextResponse } from 'next/server';
import { getAllExamSessions } from '@/lib/exam-session-postgres';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getAuthenticatedUser(request);
    
    // Solo super-admins pueden ver todas las sesiones
    if (user.role !== 'super-admin') {
      return NextResponse.json(
        { error: 'Only super-admins can view all sessions' },
        { status: 403 }
      );
    }

    const sessions = await getAllExamSessions();
    
    return NextResponse.json(sessions, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching all exam sessions:', error);
    
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
