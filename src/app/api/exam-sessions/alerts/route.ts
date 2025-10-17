import { NextRequest, NextResponse } from 'next/server';
import { addAlert, getAlertsBySession } from '@/lib/exam-session-postgres';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { exam_session_id, student_id, student_name, severity, description } = body;

    if (!exam_session_id || !student_id || !severity || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
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
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
