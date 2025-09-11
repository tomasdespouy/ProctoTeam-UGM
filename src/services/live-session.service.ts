
// Este servicio almacena los datos de la sesión en vivo en la memoria del servidor.
// No es persistente, pero es ideal para un prototipo funcional.

export interface Alert {
  id: string;
  studentId: string;
  studentName: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: number;
}

export interface StudentSession {
  id: string;
  examId: string;
  subject: string;
  section: string;
  name: string;
  email: string;
  status: 'active' | 'alert' | 'finished';
  lastAlert: string;
  lastSeen: number; // timestamp
  imgSrc: string; // La fuente de video del estudiante
  alerts: Alert[];
  messages: string[];
  progress: number;
  startTime?: number; // timestamp
  finishTime?: number; // timestamp
}

// Almacén en memoria
const liveStudents = new Map<string, StudentSession>();
const finishedStudents = new Map<string, StudentSession>();


// Funciones del servicio
export const liveSessionService = {
  addOrUpdateStudent: (studentData: { id: string; name: string; email: string; imgSrc: string; examId: string; subject: string; section: string; }) => {
    const now = Date.now();
    let student = liveStudents.get(studentData.id);

    if (student) {
      // Actualizar estudiante existente
      student.lastSeen = now;
      student.status = 'active'; // Restablecer el estado al registrarse de nuevo
      student.imgSrc = studentData.imgSrc;
      student.examId = studentData.examId;
      student.subject = studentData.subject;
      student.section = studentData.section;
    } else {
      // Crear nuevo estudiante
      student = {
        ...studentData,
        status: 'active',
        lastAlert: 'Ninguna',
        lastSeen: now,
        alerts: [],
        messages: [],
        progress: 0,
        startTime: now,
      };
    }
    
    liveStudents.set(student.id, student);
    console.log(`Estudiante añadido/actualizado: ${student.name} para examen ${student.examId}`);
    return student;
  },

  addAlert: (alertData: { studentId: string; studentName: string; description: string; severity: 'critical' | 'warning' | 'info'; imgSrc: string }) => {
    const student = liveStudents.get(alertData.studentId);
    const now = Date.now();

    const processAlert = (studentToAlert: StudentSession) => {
        const newAlert: Alert = {
            id: `alert-${now}`,
            timestamp: now,
            ...alertData
        };
        studentToAlert.alerts.unshift(newAlert);

        if (studentToAlert.status !== 'finished') {
            studentToAlert.status = 'alert';
            
            // Set a timer to revert the status back to 'active' after 10 seconds
            setTimeout(() => {
                const currentStudent = liveStudents.get(studentToAlert.id);
                // Only revert if the student exists, is still in 'alert' status, 
                // and the last alert is the one that triggered this timer.
                if (currentStudent && currentStudent.status === 'alert' && currentStudent.alerts[0]?.id === newAlert.id) {
                    currentStudent.status = 'active';
                    liveStudents.set(currentStudent.id, currentStudent);
                    console.log(`Estudiante ${currentStudent.name} volvió al estado 'activo'.`);
                }
            }, 10000); // 10 seconds
        }

        studentToAlert.lastAlert = `${alertData.description}`;
        studentToAlert.lastSeen = now;
        studentToAlert.imgSrc = alertData.imgSrc;
        
        console.log(`Alerta añadida para el estudiante: ${studentToAlert.name} - ${alertData.description}`);
        return newAlert;
    };

    if (student) {
        const newAlert = processAlert(student);
        liveStudents.set(student.id, student);
        return newAlert;
    }

    const finishedStudent = finishedStudents.get(alertData.studentId);
    if (finishedStudent) {
        const newAlert = processAlert(finishedStudent);
        finishedStudents.set(finishedStudent.id, finishedStudent);
        return newAlert;
    }
    
    return null;
  },
  
  updateStudentImage: (studentId: string, imgSrc: string) => {
    const student = liveStudents.get(studentId);
    if(student) {
      student.imgSrc = imgSrc;
      student.lastSeen = Date.now();
      liveStudents.set(studentId, student);
    }
  },

  addMessageToStudent: (studentId: string, message: string) => {
    const student = liveStudents.get(studentId);
    if (student) {
      if (!student.messages) {
        student.messages = [];
      }
      student.messages.push(message);
      liveStudents.set(studentId, student);
      console.log(`Mensaje añadido para el estudiante ${studentId}: ${message}`);
    }
  },
  
  addMessageToAllStudents: (message: string) => {
    console.log(`Enviando mensaje masivo a ${liveStudents.size} estudiantes.`);
    liveStudents.forEach(student => {
        if (!student.messages) {
            student.messages = [];
        }
        student.messages.push(message);
        liveStudents.set(student.id, student);
    });
  },

  getAndClearStudentMessages: (studentId: string): string[] => {
    const student = liveStudents.get(studentId);
    if (student && student.messages && student.messages.length > 0) {
      const messagesToReturn = [...student.messages];
      student.messages = [];
      liveStudents.set(studentId, student);
      return messagesToReturn;
    }
    return [];
  },

  terminateStudentSession: (studentId: string, reason: string = 'Sesión finalizada por el supervisor.') => {
    const student = liveStudents.get(studentId);
    if (student) {
      student.status = 'finished';
      student.finishTime = Date.now();
      student.lastAlert = reason;
      finishedStudents.set(studentId, student);
      liveStudents.delete(studentId);
      console.log(`Sesión finalizada para el estudiante ${studentId}. Razón: ${reason}`);
      return student;
    }
    return null;
  },

  terminateAllSessions: () => {
    const now = Date.now();
    liveStudents.forEach(student => {
        student.status = 'finished';
        student.finishTime = now;
        student.lastAlert = 'Sesión finalizada por el supervisor.';
        finishedStudents.set(student.id, student);
    });
    liveStudents.clear();
    // Clear finished students as well to reset the dashboard completely
    finishedStudents.clear();
    console.log('Todas las sesiones de monitoreo activas y finalizadas han sido limpiadas.');
  },
  
  getAllActiveStudents: (): StudentSession[] => {
    return Array.from(liveStudents.values());
  },

  getStudentById: (studentId: string): StudentSession | undefined => {
    return liveStudents.get(studentId);
  },

  getFinishedStudentById: (studentId: string): StudentSession | undefined => {
    return finishedStudents.get(studentId);
  },

  getStudents: (): StudentSession[] => {
    const allStudents = [...liveStudents.values(), ...finishedStudents.values()];
    return allStudents.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  },

  getAllAlerts: (): Alert[] => {
    let allAlerts: Alert[] = [];
    [...liveStudents.values(), ...finishedStudents.values()].forEach(student => {
      allAlerts = [...allAlerts, ...student.alerts];
    });
    // Ordenar por más reciente
    return allAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }
};
