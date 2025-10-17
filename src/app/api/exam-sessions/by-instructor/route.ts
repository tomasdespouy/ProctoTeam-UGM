import { NextRequest, NextResponse } from 'next/server';
import { getExamSessionsByInstructor } from '@/lib/exam-session-postgres';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get('instructorId');

    if (!instructorId) {
      return NextResponse.json(
        { error: 'Instructor ID is required' },
        { status: 400 }
      );
    }

    const sessions = await getExamSessionsByInstructor(instructorId);
    
    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    console.error('Error fetching exam sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
