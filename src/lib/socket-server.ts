import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

interface ExamRoom {
  examId: string;
  instructorSocketId: string | null;
  students: Map<string, {
    socketId: string;
    name: string;
    participationId: string;
    connected: boolean;
  }>;
}

const examRooms = new Map<string, ExamRoom>();

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/api/socket',
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);

    socket.on('instructor:join-exam', (data: { examId: string; instructorId: string }) => {
      const { examId, instructorId } = data;
      
      if (!examRooms.has(examId)) {
        examRooms.set(examId, {
          examId,
          instructorSocketId: socket.id,
          students: new Map(),
        });
      } else {
        const room = examRooms.get(examId)!;
        room.instructorSocketId = socket.id;
      }

      socket.join(`exam:${examId}`);
      socket.join(`instructor:${examId}`);
      
      console.log(`[Socket] Instructor ${instructorId} se unió al examen ${examId}`);
      
      const room = examRooms.get(examId)!;
      const studentsList = Array.from(room.students.values());
      socket.emit('exam:students-list', studentsList);
    });

    socket.on('student:join-exam', (data: { 
      examId: string; 
      studentId: string; 
      studentName: string;
      participationId: string;
    }) => {
      const { examId, studentId, studentName, participationId } = data;
      
      if (!examRooms.has(examId)) {
        examRooms.set(examId, {
          examId,
          instructorSocketId: null,
          students: new Map(),
        });
      }

      const room = examRooms.get(examId)!;
      room.students.set(studentId, {
        socketId: socket.id,
        name: studentName,
        participationId,
        connected: true,
      });

      socket.join(`exam:${examId}`);
      socket.join(`student:${examId}:${studentId}`);
      
      console.log(`[Socket] Estudiante ${studentName} se unió al examen ${examId}`);

      io.to(`instructor:${examId}`).emit('student:connected', {
        studentId,
        studentName,
        participationId,
        socketId: socket.id,
      });
    });

    socket.on('webrtc:offer', (data: { 
      examId: string; 
      fromStudentId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      const { examId, fromStudentId, offer } = data;
      io.to(`instructor:${examId}`).emit('webrtc:offer', {
        fromStudentId,
        offer,
      });
    });

    socket.on('webrtc:answer', (data: { 
      examId: string; 
      toStudentId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const { examId, toStudentId, answer } = data;
      io.to(`student:${examId}:${toStudentId}`).emit('webrtc:answer', {
        answer,
      });
    });

    socket.on('webrtc:ice-candidate', (data: { 
      examId: string; 
      fromId: string;
      toStudentId?: string;
      candidate: RTCIceCandidateInit;
      isInstructor: boolean;
    }) => {
      const { examId, fromId, toStudentId, candidate, isInstructor } = data;
      
      if (isInstructor && toStudentId) {
        io.to(`student:${examId}:${toStudentId}`).emit('webrtc:ice-candidate', {
          fromId,
          candidate,
        });
      } else {
        io.to(`instructor:${examId}`).emit('webrtc:ice-candidate', {
          fromId,
          candidate,
        });
      }
    });

    socket.on('alert:new', (data: {
      examId: string;
      studentId: string;
      participationId: string;
      alertType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      timestamp: string;
    }) => {
      io.to(`instructor:${data.examId}`).emit('alert:received', data);
      console.log(`[Socket] Nueva alerta: ${data.alertType} - ${data.description}`);
    });

    socket.on('student:snapshot', (data: {
      examId: string;
      studentId: string;
      snapshot: string;
    }) => {
      io.to(`instructor:${data.examId}`).emit('student:snapshot', data);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Cliente desconectado: ${socket.id}`);
      
      for (const [examId, room] of examRooms.entries()) {
        if (room.instructorSocketId === socket.id) {
          room.instructorSocketId = null;
          io.to(`exam:${examId}`).emit('instructor:disconnected');
        }
        
        for (const [studentId, student] of room.students.entries()) {
          if (student.socketId === socket.id) {
            student.connected = false;
            io.to(`instructor:${examId}`).emit('student:disconnected', {
              studentId,
              studentName: student.name,
              participationId: student.participationId,
            });
          }
        }
      }
    });

    socket.on('exam:force-close', (data: { examId: string }) => {
      const { examId } = data;
      io.to(`exam:${examId}`).emit('exam:closed');
      examRooms.delete(examId);
      console.log(`[Socket] Examen ${examId} cerrado forzadamente`);
    });
  });

  return io;
}

export function getExamRoom(examId: string): ExamRoom | undefined {
  return examRooms.get(examId);
}

export function cleanupExamRoom(examId: string): void {
  examRooms.delete(examId);
}
