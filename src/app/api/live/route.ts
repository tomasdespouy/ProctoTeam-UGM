import { NextRequest, NextResponse } from 'next/server';
import { liveSessionService } from '@/services/live-session.service';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { userCanAccessExam } from '@/lib/exam-access';
import { db } from '@/lib/db';

/**
 * API Route: /api/live
 * Comunicación en tiempo real Alumno/Profesor ↔ servidor.
 *
 * SEGURIDAD (C1): ambos handlers exigen autenticación.
 *  - Acciones de alumno (join/heartbeat/alert/finish): el studentId se DERIVA del
 *    token (user.uid); el del body se ignora → un alumno no puede actuar por otro.
 *  - Acciones de docente (SEND_*, BLOCK_STUDENT, TERMINATE_ALL_SESSIONS) y el GET:
 *    requieren ser el instructor dueño del examen o super-admin (admin = solo GET).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Verifica acceso al examen (usa el helper compartido). Lanza 'Forbidden' si no.
async function assertExamAccess(
  examId: string,
  user: { uid: string; role: string },
  write: boolean,
) {
  if (!(await userCanAccessExam(examId, user, write))) throw new Error('Forbidden');
}

export async function POST(request: NextRequest) {
  let user: { uid: string; email: string; role: string };
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action;
    const payload = body.payload || body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const bodyExamId = () => body.examId || payload.examId;
    let result;

    switch (action) {
      // ─── ACCIONES DEL ALUMNO (identidad derivada del token) ───────────────
      case 'REGISTER_STUDENT':
      case 'join': {
        const examId = bodyExamId();
        if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 400 });
        result = await liveSessionService.joinSession({
          examId,
          studentId: user.uid,
          name: payload.name || payload.studentName || body.name || user.email || 'Estudiante',
          email: user.email,
        });
        break;
      }

      case 'UPDATE_IMAGE':
      case 'heartbeat': {
        const examId = bodyExamId();
        if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 400 });
        await liveSessionService.heartbeat(
          examId,
          user.uid,
          payload.imgSrc || payload.snapshot || body.snapshot,
        );
        const messages = await liveSessionService.getMyMessages(examId, user.uid);
        result = { status: 'alive', messages };
        break;
      }

      case 'ADD_ALERT':
      case 'alert': {
        const examId = bodyExamId();
        if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 400 });

        // StudentCam usa 4 niveles (low|medium|high|critical); la tabla acepta
        // info|warning|critical. Se normaliza aquí para no violar el CHECK.
        const rawSev = (payload.severity || body.severity || 'medium') as string;
        const dbSeverity: 'info' | 'warning' | 'critical' =
          rawSev === 'critical' ? 'critical' :
          rawSev === 'high'     ? 'critical' :
          rawSev === 'warning'  ? 'warning'  :
          rawSev === 'medium'   ? 'warning'  :
          rawSev === 'info'     ? 'info'     :
          rawSev === 'low'      ? 'info'     : 'warning';

        const description = String(payload.description || 'Alerta sin descripción').slice(0, 500);

        result = await liveSessionService.reportAlert({
          examId,
          studentId: user.uid,
          description,
          severity: dbSeverity,
          evidenceUrl: payload.imgSrc || payload.evidenceUrl || body.imgSrc,
        });
        break;
      }

      case 'FINISH_STUDENT_SESSION':
      case 'finish': {
        const examId = bodyExamId();
        if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 400 });
        await liveSessionService.finishExam(examId, user.uid);
        result = { status: 'finished' };
        break;
      }

      // ─── ACCIONES DEL PROFESOR (requieren propiedad del examen) ────────────
      case 'SEND_MESSAGE_TO_STUDENT': {
        const examId = payload.examId || body.examId;
        await assertExamAccess(examId, user, true);
        await liveSessionService.sendMessage(examId, payload.studentId, payload.message);
        result = { success: true };
        break;
      }

      case 'SEND_BULK_MESSAGE': {
        const examId = payload.examId || body.examId;
        await assertExamAccess(examId, user, true);
        const students = await liveSessionService.getExamDashboardState(examId);
        const activeStudents = students.filter(s => s.status === 'in-progress' || s.status === 'joined');
        await Promise.all(activeStudents.map(s =>
          liveSessionService.sendMessage(examId, s.studentId, payload.message),
        ));
        result = { success: true, count: activeStudents.length };
        break;
      }

      case 'BLOCK_STUDENT': {
        const examId = payload.examId || body.examId;
        const studentId = payload.studentId || body.studentId || payload.uid || body.uid;
        if (!examId || !studentId) {
          return NextResponse.json({ error: 'Missing examId/studentId' }, { status: 400 });
        }
        await assertExamAccess(examId, user, true);
        await liveSessionService.blockStudent(examId, studentId);
        result = { success: true, message: 'Estudiante retirado de la evaluación.' };
        break;
      }

      case 'TERMINATE_ALL_SESSIONS': {
        const examId = payload.examId || body.examId;
        await assertExamAccess(examId, user, true);
        if (liveSessionService.forceCloseExam) {
          await liveSessionService.forceCloseExam(examId);
        }
        result = { success: true };
        break;
      }

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    if (error?.message === 'Forbidden') {
      return NextResponse.json({ error: 'No autorizado para este examen' }, { status: 403 });
    }
    console.error('API Live Error:', error?.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// GET — estado del examen (polling del dashboard del profesor / auditor).
export async function GET(request: NextRequest) {
  let user: { uid: string; email: string; role: string };
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId');
  if (!examId) {
    return NextResponse.json({ error: 'Exam ID required' }, { status: 400 });
  }

  try {
    await assertExamAccess(examId, user, false);

    const [students, examResult] = await Promise.all([
      liveSessionService.getExamDashboardState(examId),
      db.query(
        `SELECT id, title, access_code, duration, created_at
         FROM exam_sessions WHERE id = $1`,
        [examId],
      ),
    ]);

    // Firmar las URLs de evidencia (bucket privado) para que las <img> carguen.
    const { signEvidenceUrl } = await import('@/lib/evidence');
    await Promise.all(
      students.flatMap(s =>
        (s.alerts ?? []).map(async (a: any) => {
          if (a.evidence_url) a.evidence_url = await signEvidenceUrl(a.evidence_url);
        }),
      ),
    );

    const examRow = examResult.rows[0] ?? null;
    const exam = examRow ? {
      id:          examRow.id,
      title:       examRow.title,
      accessCode:  examRow.access_code,
      duration:    examRow.duration,
      createdAt:   examRow.created_at,
    } : null;

    return NextResponse.json({
      exam,
      students,
      alerts: students
        .flatMap(s => s.alerts)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    });
  } catch (error: any) {
    if (error?.message === 'Forbidden') {
      return NextResponse.json({ error: 'No autorizado para este examen' }, { status: 403 });
    }
    console.error('API GET Error:', error?.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
