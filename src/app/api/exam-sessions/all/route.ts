import { NextRequest, NextResponse } from 'next/server';
import { getAllExamSessions } from '@/lib/exam-session-postgres';

export async function GET(request: NextRequest) {
  try {
    const sessions = await getAllExamSessions();
    
    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    console.error('Error fetching all exam sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
