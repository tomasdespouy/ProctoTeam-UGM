'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Video, 
  VideoOff, 
  AlertTriangle, 
  Users, 
  Eye,
  Ban,
  Maximize2
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface StudentStream {
  studentId: string;
  studentName: string;
  participationId: string;
  connected: boolean;
  stream?: MediaStream;
  alertCount: number;
}

interface Alert {
  studentId: string;
  studentName: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
}

interface ProctorViewProps {
  examId: string;
  instructorId: string;
  onBlockStudent?: (participationId: string) => void;
}

export function ProctorView({ examId, instructorId, onBlockStudent }: ProctorViewProps) {
  const [students, setStudents] = useState<Map<string, StudentStream>>(new Map());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    const socket = io({
      path: '/api/socket',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('instructor:join-exam', { examId, instructorId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('exam:students-list', (studentsList: StudentStream[]) => {
      const studentsMap = new Map<string, StudentStream>();
      studentsList.forEach(student => {
        studentsMap.set(student.studentId, { ...student, alertCount: 0 });
      });
      setStudents(studentsMap);
    });

    socket.on('student:connected', (data: {
      studentId: string;
      studentName: string;
      participationId: string;
    }) => {
      setStudents(prev => {
        const updated = new Map(prev);
        updated.set(data.studentId, {
          ...data,
          connected: true,
          alertCount: 0,
        });
        return updated;
      });
    });

    socket.on('student:disconnected', (data: {
      studentId: string;
      studentName: string;
    }) => {
      setStudents(prev => {
        const updated = new Map(prev);
        const student = updated.get(data.studentId);
        if (student) {
          updated.set(data.studentId, { ...student, connected: false });
        }
        return updated;
      });

      setAlerts(prev => [...prev, {
        studentId: data.studentId,
        studentName: data.studentName,
        alertType: 'disconnection',
        severity: 'high',
        description: 'Estudiante desconectado',
        timestamp: new Date().toISOString(),
      }]);
    });

    socket.on('webrtc:offer', async (data: {
      fromStudentId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      peerConnections.current.set(data.fromStudentId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc:ice-candidate', {
            examId,
            fromId: instructorId,
            toStudentId: data.fromStudentId,
            candidate: event.candidate,
            isInstructor: true,
          });
        }
      };

      pc.ontrack = (event) => {
        setStudents(prev => {
          const updated = new Map(prev);
          const student = updated.get(data.fromStudentId);
          if (student) {
            updated.set(data.fromStudentId, {
              ...student,
              stream: event.streams[0],
            });
          }
          return updated;
        });
      };

      await pc.setRemoteDescription(data.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc:answer', {
        examId,
        toStudentId: data.fromStudentId,
        answer,
      });
    });

    socket.on('webrtc:ice-candidate', (data: {
      fromId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnections.current.get(data.fromId);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on('alert:received', (data: Alert) => {
      setAlerts(prev => [data, ...prev].slice(0, 100));
      
      setStudents(prev => {
        const updated = new Map(prev);
        const student = updated.get(data.studentId);
        if (student) {
          updated.set(data.studentId, {
            ...student,
            alertCount: student.alertCount + 1,
          });
        }
        return updated;
      });
    });

    socket.on('student:snapshot', (data: {
      studentId: string;
      snapshot: string;
    }) => {
      // Handle snapshot updates if needed
    });

    return () => {
      socket.disconnect();
      peerConnections.current.forEach(pc => pc.close());
    };
  }, [examId, instructorId]);

  const handleBlockStudent = (participationId: string) => {
    if (onBlockStudent) {
      onBlockStudent(participationId);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const studentsArray = Array.from(students.values());

  return (
    <div className="flex h-full gap-4">
      <div className="flex-1">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Monitoreo en Vivo
                <Badge variant={isConnected ? 'default' : 'destructive'}>
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </CardTitle>
              <Badge variant="secondary">
                {studentsArray.filter(s => s.connected).length} / {studentsArray.length} activos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {studentsArray.map((student) => (
                <Card 
                  key={student.studentId}
                  className={`relative cursor-pointer transition-all hover:ring-2 hover:ring-primary ${
                    selectedStudent === student.studentId ? 'ring-2 ring-primary' : ''
                  } ${!student.connected ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedStudent(student.studentId)}
                >
                  <div className="aspect-video bg-muted relative overflow-hidden rounded-t-lg">
                    {student.stream ? (
                      <VideoPlayer stream={student.stream} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {student.connected ? (
                          <Video className="h-8 w-8 text-muted-foreground animate-pulse" />
                        ) : (
                          <VideoOff className="h-8 w-8 text-destructive" />
                        )}
                      </div>
                    )}
                    
                    {student.alertCount > 0 && (
                      <Badge 
                        className="absolute top-2 right-2 bg-red-600"
                      >
                        {student.alertCount}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="p-2">
                    <p className="text-sm font-medium truncate">{student.studentName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={student.connected ? 'default' : 'secondary'} className="text-xs">
                        {student.connected ? 'En línea' : 'Desconectado'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(student.studentId);
                      }}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBlockStudent(student.participationId);
                      }}
                    >
                      <Ban className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}

              {studentsArray.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4" />
                  <p>Esperando estudiantes...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="w-80 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Alertas Recientes
            {alerts.length > 0 && (
              <Badge variant="destructive">{alerts.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-2">
              {alerts.map((alert, idx) => (
                <Card key={idx} className="p-3">
                  <div className="flex items-start gap-2">
                    <Badge className={`${getSeverityColor(alert.severity)} text-xs`}>
                      {alert.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.studentName}</p>
                      <p className="text-xs text-muted-foreground">{alert.alertType}</p>
                      <p className="text-xs mt-1">{alert.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setSelectedStudent(alert.studentId)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}

              {alerts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin alertas</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function VideoPlayer({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}
