import { NextRequest, NextResponse } from 'next/server';
import { addAlert, getAlertsBySession } from '@/lib/exam-session-postgres';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación - solo estudiantes pueden generar alertas (del sistema)
    const user = await getAuthenticatedUser(request);

    const body = await request.json();
    const { exam_session_id, student_id, student_name, severity, description } = body;

    if (!exam_session_id || !student_id || !severity || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verificar que el estudiante solo pueda crear alertas para sí mismo
    if (user.role === 'student' && user.uid !== student_id) {
      return NextResponse.json(
        { error: 'Can only create alerts for yourself' },
        { status: 403 }
      );
    }

    const alert = await addAlert({
      exam_session_id,
      student_id,
      student_name,
      severity,
      description,
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error: any) {
    console.error('Error creating alert:', error);
    
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

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getAuthenticatedUser(request);
    
    // Solo instructores y super-admins pueden ver alertas
    if (user.role !== 'instructor' && user.role !== 'super-admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const alerts = await getAlertsBySession(sessionId);
    
    return NextResponse.json(alerts, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    
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
