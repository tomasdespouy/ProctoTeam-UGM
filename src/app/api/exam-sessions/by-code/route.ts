import { NextRequest, NextResponse } from 'next/server';
import { getExamSessionByCode } from '@/lib/exam-session-postgres';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Exige autenticación (antes era anónimo y filtraba instructor_id vía SELECT *).
    try {
      await getAuthenticatedUser(request);
    } catch {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accessCode = searchParams.get('code');

    if (!accessCode) {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
    }

    const session = await getExamSessionByCode(accessCode);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Solo los campos que necesita la pantalla de unirse — nada de instructor_id
    // ni metadatos internos.
    return NextResponse.json({
      id:     (session as any).id,
      title:  (session as any).title,
      status: (session as any).status,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching exam session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
