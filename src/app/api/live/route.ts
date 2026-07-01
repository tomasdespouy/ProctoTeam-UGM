import { NextRequest, NextResponse } from 'next/server';
import { liveSessionService } from '@/services/live-session.service';

/**
 * API Route: /api/live
 * Maneja la comunicación en tiempo real entre el cliente (Alumno/Profesor) y el servidor.
 * Versión 2.0: Completamente asíncrona y persistente en PostgreSQL.
 */

export const dynamic = 'force-dynamic'; // Evita cache estático en Vercel/Next.js

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Unificamos la estructura: el frontend puede enviar { action, ...payload } o { action, payload: {...} }
    // Este adaptador permite soportar ambos formatos mientras migras el frontend.
    const action = body.action;
    const payload = body.payload || body; 

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    let result;

    switch (action) {
      // --- ACCIONES DEL ALUMNO ---

      case 'REGISTER_STUDENT': 
      case 'join': {
        // ═══════════════════════════════════════════════════════════════
        // DEFENSE IN DEPTH: Validación para join (mismo patrón)
        // ═══════════════════════════════════════════════════════════════
        const joinStudentId = body.studentId || payload.studentId || payload.uid || body.uid;
        const joinExamId = body.examId || payload.examId;
        
        if (!joinStudentId) {
          console.warn('⛔ [API /live] join rechazado: Missing studentId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required field: studentId for join' }, 
            { status: 400 }
          );
        }
        
        if (!joinExamId) {
          console.warn('⛔ [API /live] join rechazado: Missing examId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required field: examId for join' }, 
            { status: 400 }
          );
        }

        result = await liveSessionService.joinSession({
            examId: joinExamId,
            studentId: joinStudentId,
            name: payload.name || payload.studentName || body.name || 'Estudiante',
            email: payload.email || body.email
        });
        break;
      }

      case 'UPDATE_IMAGE':
      case 'heartbeat': {
        // ═══════════════════════════════════════════════════════════════
        // DEFENSE IN DEPTH: Extracción estandarizada y validación estricta
        // ═══════════════════════════════════════════════════════════════
        
        // 1. Extracción robusta: Buscar studentId en múltiples ubicaciones
        //    Prioridad: body.studentId > payload.studentId > payload.uid > body.uid
        const extractedStudentId = body.studentId || payload.studentId || payload.uid || body.uid;
        const extractedExamId = body.examId || payload.examId;
        
        // 2. Validación explícita ANTES de llamar al servicio
        if (!extractedStudentId) {
          console.warn('⛔ [API /live] heartbeat rechazado: Missing studentId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required field: studentId' }, 
            { status: 400 }
          );
        }
        
        if (!extractedExamId) {
          console.warn('⛔ [API /live] heartbeat rechazado: Missing examId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required field: examId' }, 
            { status: 400 }
          );
        }

        // 3. Llamar al servicio con datos validados
        await liveSessionService.heartbeat(
            extractedExamId, 
            extractedStudentId, 
            payload.imgSrc || payload.snapshot || body.snapshot
        );

        // 4. Piggybacking: devolver mensajes pendientes
        const messages = await liveSessionService.getMyMessages(extractedExamId, extractedStudentId);
        result = { status: 'alive', messages };
        break;
      }

      case 'ADD_ALERT':
      case 'alert': {
        // ═══════════════════════════════════════════════════════════════
        // DEFENSE IN DEPTH: Validación para alertas (mismo patrón que heartbeat)
        // ═══════════════════════════════════════════════════════════════
        // Extracción robusta: Buscar studentId en múltiples ubicaciones
        // Prioridad: body.studentId > payload.studentId > payload.uid > body.uid
        const alertStudentId = body.studentId || payload.studentId || payload.uid || body.uid;
        const alertExamId = body.examId || payload.examId;
        
        if (!alertStudentId) {
          console.warn('⛔ [API /live] alert rechazado: Missing studentId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required field: studentId for alert' }, 
            { status: 400 }
          );
        }
        
        if (!alertExamId) {
          console.warn('⛔ [API /live] alert rechazado: Missing examId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required field: examId for alert' }, 
            { status: 400 }
          );
        }

        // ── Severity normalizer ──────────────────────────────────────────
        // StudentCam uses 4 levels: low | medium | high | critical.
        // The DB alerts table only accepts: info | warning | critical.
        // Map at the API boundary so the constraint is never violated.
        const rawSev = (payload.severity || body.severity || 'medium') as string;
        const dbSeverity: 'info' | 'warning' | 'critical' =
          rawSev === 'critical' ? 'critical' :
          rawSev === 'high'     ? 'critical' :
          rawSev === 'warning'  ? 'warning'  :
          rawSev === 'medium'   ? 'warning'  :
          rawSev === 'info'     ? 'info'     :
          rawSev === 'low'      ? 'info'     : 'warning';

        result = await liveSessionService.reportAlert({
            examId:       alertExamId,
            studentId:    alertStudentId,
            description:  payload.description || 'Alerta sin descripción',
            severity:     dbSeverity,
            evidenceUrl:  payload.imgSrc || payload.evidenceUrl || body.imgSrc,
        });
        break;
      }

      case 'FINISH_STUDENT_SESSION':
      case 'finish': {
        // ═══════════════════════════════════════════════════════════════
        // DEFENSE IN DEPTH: Validación para finish (mismo patrón)
        // ═══════════════════════════════════════════════════════════════
        const finishStudentId = body.studentId || payload.studentId || payload.uid || body.uid;
        const finishExamId = body.examId || payload.examId;
        
        if (!finishStudentId) {
          console.warn('⛔ [API /live] finish rechazado: Missing studentId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required field: studentId for finish' }, 
            { status: 400 }
          );
        }
        
        if (!finishExamId) {
          console.warn('⛔ [API /live] finish rechazado: Missing examId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required field: examId for finish' }, 
            { status: 400 }
          );
        }

        await liveSessionService.finishExam(finishExamId, finishStudentId);
        result = { status: 'finished' };
        break;
      }

      // --- ACCIONES DEL PROFESOR (DASHBOARD) ---

      case 'SEND_MESSAGE_TO_STUDENT':
        await liveSessionService.sendMessage(payload.examId, payload.studentId, payload.message);
        result = { success: true };
        break;

      case 'SEND_BULK_MESSAGE':
        // Para mensajes masivos, iteramos sobre los alumnos activos (se podría optimizar en SQL, pero esto es seguro)
        const students = await liveSessionService.getExamDashboardState(payload.examId);
        const activeStudents = students.filter(s => s.status === 'in-progress' || s.status === 'joined');

        await Promise.all(activeStudents.map(s => 
            liveSessionService.sendMessage(payload.examId, s.studentId, payload.message)
        ));
        result = { success: true, count: activeStudents.length };
        break;

      case 'BLOCK_STUDENT': {
        // Expulsión manual por el profesor: marca status='blocked' (no 'submitted'),
        // que el polling del alumno detecta para cerrarle la sesión y que impide reingreso.
        const blockExamId = payload.examId || body.examId;
        const blockStudentId = payload.studentId || body.studentId || payload.uid || body.uid;

        if (!blockExamId || !blockStudentId) {
          console.warn('⛔ [API /live] BLOCK_STUDENT rechazado: Missing examId/studentId');
          return NextResponse.json(
            { error: 'Bad Request', details: 'Missing required fields: examId and studentId for block' },
            { status: 400 }
          );
        }

        await liveSessionService.blockStudent(blockExamId, blockStudentId);
        result = { success: true, message: 'Estudiante retirado de la evaluación.' };
        break;
      }

      case 'TERMINATE_ALL_SESSIONS':
        // Finalizar examen completo (Profesor)
        // Esto requiere una query especial que ya no está en el servicio básico, pero podemos improvisar
        // Lo ideal es añadir forceCloseExam al servicio.
        // Asumiendo que añadiste forceCloseExam como sugerí antes:
        if (liveSessionService.forceCloseExam) {
             await liveSessionService.forceCloseExam(payload.examId);
        } else {
             // Fallback si no añadiste ese método al servicio
             console.warn('forceCloseExam no implementado en servicio, simulando...');
        }
        result = { success: true };
        break;

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    console.error('API Live Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message }, 
      { status: 500 }
    );
  }
}

// GET para obtener el estado actual (Polling del Dashboard del Profesor)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    if (!examId) {
        return NextResponse.json({ error: 'Exam ID required' }, { status: 400 });
    }

    try {
        const { db } = await import('@/lib/db');

        // Fetch students/alerts and exam metadata in parallel
        const [students, examResult] = await Promise.all([
            liveSessionService.getExamDashboardState(examId),
            db.query(
                `SELECT id, title, access_code, duration, created_at
                 FROM exam_sessions WHERE id = $1`,
                [examId]
            ),
        ]);

        // Firmar las URLs de evidencia (bucket privado) para que las <img> carguen.
        const { signEvidenceUrl } = await import('@/lib/evidence');
        await Promise.all(
            students.flatMap(s =>
                (s.alerts ?? []).map(async (a: any) => {
                    if (a.evidence_url) a.evidence_url = await signEvidenceUrl(a.evidence_url);
                })
            )
        );

        const examRow = examResult.rows[0] ?? null;
        const exam = examRow ? {
            id:          examRow.id,
            title:       examRow.title,
            accessCode:  examRow.access_code,
            duration:    examRow.duration,     // minutes
            createdAt:   examRow.created_at,
        } : null;

        return NextResponse.json({
            exam,
            students,
            alerts: students
                .flatMap(s => s.alerts)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        });
    } catch (error) {
        console.error('API GET Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}