
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { liveSessionService } from '@/services/live-session.service';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, Timestamp, getDoc, setDoc, getDocs } from 'firebase/firestore';

export const dynamic = 'force-dynamic'; // Asegura que la ruta no sea cacheada estáticamente

export async function GET() {
  try {
    const students = liveSessionService.getStudents();
    const alerts = liveSessionService.getAllAlerts();
    return NextResponse.json({ students, alerts });
  } catch (error) {
    console.error('API GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    if (!action || !payload) {
      return NextResponse.json({ error: 'Acción y payload son requeridos' }, { status: 400 });
    }

    switch (action) {
      case 'REGISTER_STUDENT':
        const newStudent = liveSessionService.addOrUpdateStudent(payload);
        return NextResponse.json(newStudent, { status: 201 });
      
      case 'ADD_ALERT':
        const { studentId: alertStudentId, studentName, description, severity, imgSrc } = payload;
        
        // Add to in-memory service for live view
        const newAlert = liveSessionService.addAlert({ studentId: alertStudentId, studentName, description, severity, imgSrc });
        
        // Persist to Firestore for historical report
        if (payload.examId) {
            const alertDoc = {
                studentId: alertStudentId,
                studentName,
                description,
                severity,
                timestamp: serverTimestamp(),
                imgSrc,
            };
            try {
                const examAlertsCollection = collection(db, 'examSessions', payload.examId, 'alerts');
                await addDoc(examAlertsCollection, alertDoc);
            } catch (firestoreError) {
                console.error('Firestore ADD_ALERT Error:', firestoreError);
                // No devolver error al cliente para no interrumpir la sesión en vivo
            }
        }

        if (newAlert) {
          return NextResponse.json(newAlert, { status: 201 });
        }
        return NextResponse.json({ error: 'Estudiante no encontrado para la sesión en vivo' }, { status: 404 });
        
      case 'UPDATE_IMAGE': {
        const { studentId, imgSrc: updateImgSrc } = payload;
        liveSessionService.updateStudentImage(studentId, updateImgSrc);
        const student = liveSessionService.getStudentById(studentId);
        const messages = liveSessionService.getAndClearStudentMessages(studentId);
        // This is no longer the primary method for termination, but kept as a fallback.
        // Real-time listener on the client is the primary method now.
        return NextResponse.json({ success: true, messages, terminate: student?.status === 'finished' }, { status: 200 });
      }

      case 'SEND_MESSAGE_TO_STUDENT':
        liveSessionService.addMessageToStudent(payload.studentId, payload.message);
        return NextResponse.json({ success: true }, { status: 200 });
      
      case 'SEND_BULK_MESSAGE':
        liveSessionService.addMessageToAllStudents(payload.message);
        return NextResponse.json({ success: true, message: 'Mensaje enviado a todos los estudiantes activos.' }, { status: 200 });

      case 'FINISH_STUDENT_SESSION': {
        const { studentId, examId, studentName } = payload;
        // Terminate in-memory session
        const finishedStudent = liveSessionService.terminateStudentSession(studentId, 'El estudiante ha finalizado el examen.');
        
        // Add a final 'info' alert for the instructor
        const finishAlert = {
          studentId: studentId,
          studentName: studentName,
          description: 'El estudiante ha finalizado el examen',
          severity: 'info' as const,
          imgSrc: 'https://placehold.co/256x192.png'
        };
        liveSessionService.addAlert(finishAlert);

        // Block student from re-entry
        try {
            const examDocRef = doc(db, 'examSessions', examId);
            await updateDoc(examDocRef, {
                blockedStudents: arrayUnion({
                    uid: studentId,
                    reason: 'Finalizó el examen voluntariamente.',
                    timestamp: Timestamp.now()
                })
            });

            // Persist student session details for historical stats
            if (finishedStudent) {
              const studentDetailRef = doc(db, 'examSessions', examId, 'studentDetails', studentId);
              await setDoc(studentDetailRef, {
                id: finishedStudent.id,
                name: finishedStudent.name,
                startTime: finishedStudent.startTime,
                finishTime: finishedStudent.finishTime
              }, { merge: true });
            }

        } catch (firestoreError: any) {
             console.error('Firestore FINISH_STUDENT_SESSION Error:', firestoreError);
             return NextResponse.json({ error: `Fallo al escribir el bloqueo en la base de datos: ${firestoreError.message}` }, { status: 500 });
        }
        
        return NextResponse.json({ success: true }, { status: 200 });
      }

      case 'BLOCK_STUDENT': {
        const { studentId: blockedStudentId, examId: blockedExamId, reason } = payload;
        
        if (!blockedStudentId || !blockedExamId) {
            return NextResponse.json({ error: 'ID de estudiante o de examen faltante. No se puede bloquear permanentemente.' }, { status: 400 });
        }
        
        // 1. Terminate live session in memory
        const finishedStudent = liveSessionService.terminateStudentSession(blockedStudentId, reason || 'Razón no especificada');

        // 2. Add student to blocked list in Firestore for persistence
        try {
            const examDocRef = doc(db, 'examSessions', blockedExamId);
            await updateDoc(examDocRef, {
                blockedStudents: arrayUnion({
                    uid: blockedStudentId,
                    reason: reason || 'Razón no especificada',
                    timestamp: Timestamp.now()
                })
            });
             // Persist student session details for historical stats
            if (finishedStudent) {
              const studentDetailRef = doc(db, 'examSessions', blockedExamId, 'studentDetails', blockedStudentId);
              await setDoc(studentDetailRef, {
                id: finishedStudent.id,
                name: finishedStudent.name,
                startTime: finishedStudent.startTime,
                finishTime: finishedStudent.finishTime
              }, { merge: true });
            }

        } catch (firestoreError: any) {
             console.error('Firestore BLOCK_STUDENT Error:', firestoreError);
             return NextResponse.json({ error: `Fallo al escribir el bloqueo en la base de datos: ${firestoreError.message}` }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, message: `Estudiante ${blockedStudentId} bloqueado.` }, { status: 200 });
      }

      case 'TERMINATE_ALL_SESSIONS': {
        const { examId } = payload;
        
        if (!examId) {
          return NextResponse.json({ error: 'ID de examen es requerido para finalizar la sesión.' }, { status: 400 });
        }

        const examDocRef = doc(db, 'examSessions', examId);
        const examSnapshot = await getDoc(examDocRef);
        if (!examSnapshot.exists()) {
             return NextResponse.json({ error: 'El examen no fue encontrado.' }, { status: 404 });
        }
        
        const studentsToPersist = liveSessionService.getAllActiveStudents();

        liveSessionService.terminateAllSessions();
        try {
          await updateDoc(examDocRef, {
            status: 'finished'
          });

           const now = Date.now();
           for (const student of studentsToPersist) {
              const studentDetailRef = doc(db, 'examSessions', examId, 'studentDetails', student.id);
              await setDoc(studentDetailRef, {
                id: student.id,
                name: student.name,
                startTime: student.startTime,
                finishTime: now
              }, { merge: true });
           }

        } catch (firestoreError: any) {
          console.error('Firestore TERMINATE_ALL_SESSIONS Error:', firestoreError);
          return NextResponse.json({ error: `Fallo al actualizar el estado del examen en la base de datos: ${firestoreError.message}` }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, message: 'Todas las sesiones han sido terminadas.' }, { status: 200 });
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('API POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
