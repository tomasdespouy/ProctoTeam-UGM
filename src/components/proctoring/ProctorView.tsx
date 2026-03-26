'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  Maximize2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbAlert {
  id: string;
  exam_session_id: string;
  student_id: string;
  studentName?: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  evidence_url?: string;
  timestamp: string;
}

interface StudentStream {
  studentId: string;
  studentName: string;
  participationId: string;
  connected: boolean;
  stream?: MediaStream;
  alertCount: number;
  lastSnapshot?: string;
}

interface ProctorViewProps {
  examId: string;
  instructorId: string;
  onBlockStudent?: (participationId: string) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ProctorView({ examId, instructorId, onBlockStudent }: ProctorViewProps) {
  const [students, setStudents]           = useState<Map<string, StudentStream>>(new Map());
  const [alerts, setAlerts]               = useState<DbAlert[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [isConnected, setIsConnected]     = useState(false);
  const [isLoading, setIsLoading]         = useState(true);

  // WebRTC: one RTCPeerConnection per student, keyed by studentId
  const peerConnections  = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Ref to the active Supabase channel so async WebRTC callbacks can send
  const signalingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load students + historical alerts from DB ─────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/live?examId=${examId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const studentsMap = new Map<string, StudentStream>();
      (data.students ?? []).forEach((s: any) => {
        // Preserve existing stream if already connected via WebRTC
        const existing = studentsMap.get(s.studentId);
        studentsMap.set(s.studentId, {
          studentId:       s.studentId,
          studentName:     s.name,
          participationId: s.id,
          connected:       s.status === 'in-progress' || s.status === 'joined',
          alertCount:      s.alerts?.length ?? 0,
          lastSnapshot:    s.lastSnapshot ?? undefined,
          stream:          existing?.stream,
        });
      });
      setStudents(studentsMap);

      const enriched: DbAlert[] = [];
      (data.students ?? []).forEach((s: any) => {
        (s.alerts ?? []).forEach((a: any) => {
          enriched.push({
            id:              a.id,
            exam_session_id: examId,
            student_id:      s.studentId,
            studentName:     s.name,
            severity:        a.severity ?? 'info',
            description:     a.description,
            timestamp:       a.timestamp ?? new Date().toISOString(),
          });
        });
      });
      enriched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAlerts(enriched.slice(0, 100));
    } catch (err) {
      console.error('[ProctorView] Error cargando datos del examen:', err);
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  // ── WebRTC signaling handler ──────────────────────────────────────────────
  const handleWebRTCSignaling = useCallback(async ({ payload }: any) => {
    const { type, fromId, toId, data, isRenegotiation } = payload;

    // ── Student joined announcement ──
    if (type === 'student-joined') {
      const { studentName, participationId } = payload;
      setStudents(prev => {
        const updated  = new Map(prev);
        const existing = updated.get(fromId);
        updated.set(fromId, {
          studentId:       fromId,
          studentName:     studentName ?? existing?.studentName ?? fromId,
          participationId: participationId ?? existing?.participationId ?? '',
          connected:       true,
          alertCount:      existing?.alertCount ?? 0,
          lastSnapshot:    existing?.lastSnapshot,
          stream:          existing?.stream,
        });
        return updated;
      });
      return;
    }

    // All other message types are addressed to the instructor
    if (toId !== 'instructor') return;

    // ── WebRTC offer ─────────────────────────────────────────────────────────
    if (type === 'offer') {
      let pc: RTCPeerConnection;

      if (isRenegotiation && peerConnections.current.has(fromId)) {
        // Renegotiation (e.g. screen share added): reuse existing connection
        pc = peerConnections.current.get(fromId)!;
      } else {
        // New connection — cleanup stale PC first (fixes Riesgo 4)
        const stale = peerConnections.current.get(fromId);
        if (stale) {
          stale.close();
          peerConnections.current.delete(fromId);
          console.log(`[ProctorView] Closed stale RTCPeerConnection for ${fromId}`);
        }

        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerConnections.current.set(fromId, pc);

        // Trickle ICE back to the student
        pc.onicecandidate = ({ candidate }) => {
          if (candidate && signalingChannel.current) {
            signalingChannel.current.send({
              type: 'broadcast',
              event: 'webrtc-signaling',
              payload: {
                type:   'ice-candidate',
                fromId: 'instructor',
                toId:   fromId,
                data:   candidate.toJSON(),
              },
            });
          }
        };

        // Incoming media tracks → display in student card
        pc.ontrack = (event) => {
          setStudents(prev => {
            const updated = new Map(prev);
            const student = updated.get(fromId);
            if (student) {
              updated.set(fromId, { ...student, stream: event.streams[0] });
            }
            return updated;
          });
        };
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      signalingChannel.current?.send({
        type: 'broadcast',
        event: 'webrtc-signaling',
        payload: {
          type:   'answer',
          fromId: 'instructor',
          toId:   fromId,
          data:   { type: answer.type, sdp: answer.sdp },
        },
      });

      return;
    }

    // ── ICE candidate from student ────────────────────────────────────────────
    if (type === 'ice-candidate') {
      const pc = peerConnections.current.get(fromId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
      }
    }
  }, []);

  // ── Supabase channel: Realtime alerts + WebRTC Broadcast ─────────────────
  useEffect(() => {
    loadData();
    const pollInterval = setInterval(loadData, 30_000);

    const channel = supabase
      .channel(`exam-room-${examId}`)
      // Phase 2: persistent alert feed from DB
      .on(
        'postgres_changes' as any,
        {
          event:  'INSERT',
          schema: 'public',
          table:  'alerts',
          filter: `exam_session_id=eq.${examId}`,
        },
        (payload: any) => {
          const newAlert = payload.new as DbAlert;

          setStudents(prev => {
            const student = prev.get(newAlert.student_id);
            if (!student) return prev;
            const updated = new Map(prev);
            updated.set(newAlert.student_id, { ...student, alertCount: student.alertCount + 1 });
            return updated;
          });

          setAlerts(prev => [newAlert, ...prev].slice(0, 100));
        }
      )
      // Phase 3: WebRTC signaling via Broadcast
      .on('broadcast', { event: 'webrtc-signaling' }, handleWebRTCSignaling)
      .subscribe((status: string) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    signalingChannel.current = channel;

    return () => {
      clearInterval(pollInterval);
      // Close all peer connections cleanly
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      signalingChannel.current = null;
      supabase.removeChannel(channel);
    };
  }, [examId, loadData, handleWebRTCSignaling]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'warning':  return 'bg-orange-500';
      case 'info':     return 'bg-blue-500';
      default:         return 'bg-gray-500';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return 'crítico';
      case 'warning':  return 'aviso';
      case 'info':     return 'info';
      default:         return severity;
    }
  };

  const resolveStudentName = (alert: DbAlert): string =>
    alert.studentName ??
    students.get(alert.student_id)?.studentName ??
    `ID:${alert.student_id.substring(0, 8)}`;

  const studentsArray = Array.from(students.values());

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full gap-4">

      {/* ── Grid de estudiantes ─────────────────────────────────────────── */}
      <div className="flex-1">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Monitoreo en Vivo
                <Badge variant={isConnected ? 'default' : 'destructive'}>
                  {isConnected
                    ? <><Wifi    className="h-3 w-3 mr-1 inline" />Tiempo real</>
                    : <><WifiOff className="h-3 w-3 mr-1 inline" />Conectando...</>}
                </Badge>
              </CardTitle>
              <Badge variant="secondary">
                {studentsArray.filter(s => s.connected).length} / {studentsArray.length} activos
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
                Cargando estudiantes...
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {studentsArray.map(student => (
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
                      ) : student.lastSnapshot ? (
                        <img
                          src={student.lastSnapshot}
                          alt={student.studentName}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {student.connected
                            ? <Video    className="h-8 w-8 text-muted-foreground animate-pulse" />
                            : <VideoOff className="h-8 w-8 text-destructive" />}
                        </div>
                      )}

                      {student.alertCount > 0 && (
                        <Badge className="absolute top-2 right-2 bg-red-600">
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
                        size="icon" variant="ghost" className="h-6 w-6"
                        onClick={e => { e.stopPropagation(); setSelectedStudent(student.studentId); }}
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-6 w-6 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={e => { e.stopPropagation(); onBlockStudent?.(student.participationId); }}
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Panel de alertas ─────────────────────────────────────────────── */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Alertas Recientes
            {alerts.length > 0 && <Badge variant="destructive">{alerts.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-2">
              {alerts.map(alert => (
                <Card key={alert.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <Badge className={`${getSeverityColor(alert.severity)} text-xs shrink-0`}>
                      {getSeverityLabel(alert.severity)}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{resolveStudentName(alert)}</p>
                      <p className="text-xs mt-1">{alert.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.timestamp).toLocaleTimeString('es-CL')}
                      </p>
                    </div>
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                      onClick={() => setSelectedStudent(alert.student_id)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}

              {alerts.length === 0 && !isLoading && (
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

// ─── VideoPlayer ──────────────────────────────────────────────────────────────

function VideoPlayer({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay playsInline muted
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}
