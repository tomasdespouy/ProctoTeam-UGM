import { NextRequest, NextResponse } from 'next/server';
import { createExamSession } from '@/lib/exam-session-postgres';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, subject, section, duration, accessCode, instructorId, instructorName, students } = body;

    if (!title || !subject || !section || !duration || !accessCode || !instructorId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const session = await createExamSession({
      title,
      subject,
      section,
      duration: parseInt(duration),
      access_code: accessCode,
      instructor_id: instructorId,
      instructor_name: instructorName,
      students: students || [],
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating exam session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
