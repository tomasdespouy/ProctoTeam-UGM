import { NextRequest, NextResponse } from 'next/server';
import { getExamSessionByCode } from '@/lib/exam-session-postgres';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessCode = searchParams.get('code');

    if (!accessCode) {
      return NextResponse.json(
        { error: 'Access code is required' },
        { status: 400 }
      );
    }

    const session = await getExamSessionByCode(accessCode);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session, { status: 200 });
  } catch (error) {
    console.error('Error fetching exam session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
