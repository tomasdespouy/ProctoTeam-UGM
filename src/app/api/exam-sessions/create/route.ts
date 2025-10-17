import { NextRequest, NextResponse } from 'next/server';
import { createExamSession } from '@/lib/exam-session-postgres';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación y rol
    const user = await getAuthenticatedUser(request);
    
    if (user.role !== 'instructor' && user.role !== 'super-admin') {
      return NextResponse.json(
        { error: 'Only instructors can create exam sessions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, subject, section, duration, accessCode, students } = body;

    if (!title || !subject || !section || !duration || !accessCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Usar el UID del usuario autenticado como instructor_id
    const session = await createExamSession({
      title,
      subject,
      section,
      duration: parseInt(duration),
      access_code: accessCode,
      instructor_id: user.uid,
      instructor_name: user.email,
      students: students || [],
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    console.error('Error creating exam session:', error);
    
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
