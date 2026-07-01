'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  ScanFace,
  Ban,
  Download,
  Filter,
  Copy,
  Square,
  Loader2,
  Maximize2,
  X,
  Camera,
  Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExamMeta {
  id:         string;
  title:      string;
  accessCode: string;
  duration:   number;   // minutes
  createdAt:  string;   // ISO string — used as "started at" proxy
}

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
  studentId:       string;
  studentName:     string;
  participationId: string;
  connected:       boolean;
  /** All remote MediaStreams received via WebRTC ontrack (deduplicated by id). */
  allStreams?:     MediaStream[];
  /** Legacy field kept for backward compat (last stream received). */
  stream?:         MediaStream;
  alertCount:      number;
  lastSnapshot?:   string;
}

interface ProctorViewProps {
  examId:            string;
  instructorId:      string;
  onBlockStudent?:   (participationId: string) => void;
  /** When true: hides Finalizar Examen + Ban buttons. Used by Super Admin ghost view. */
  readOnly?:         boolean;
}

type AlertFilter = 'all' | 'critical' | 'warning' | 'info';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  warning:  '#F97316',
  info:     '#3B82F6',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Crítico',
  warning:  'Advertencia',
  info:     'Info',
};

// ─── Timer helpers ────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProctorView({ examId, instructorId, onBlockStudent, readOnly = false }: ProctorViewProps) {
  const router      = useRouter();
  const { toast }   = useToast();

  const [students,          setStudents]          = useState<Map<string, StudentStream>>(new Map());
  const [alerts,            setAlerts]            = useState<DbAlert[]>([]);
  const [alertFilter,       setAlertFilter]       = useState<AlertFilter>('all');
  const [isConnected,       setIsConnected]       = useState(false);
  const [isLoading,         setIsLoading]         = useState(true);
  const [isClosing,         setIsClosing]         = useState(false);
  const [gridMode,          setGridMode]          = useState<'normal' | 'dense'>('dense');
  const [maximizedStudent,  setMaximizedStudent]  = useState<StudentStream | null>(null);

  // Acciones por estudiante (enviar mensaje / retirar) desde el modal maximizado
  const [msgText,           setMsgText]           = useState('');
  const [isSendingMsg,      setIsSendingMsg]      = useState(false);
  const [isRemoving,        setIsRemoving]        = useState(false);

  // Close maximize modal on ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaximizedStudent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Limpia el borrador de mensaje al cambiar de estudiante o cerrar el modal.
  useEffect(() => { setMsgText(''); }, [maximizedStudent?.studentId]);

  // ── Bug 3: exam metadata state ─────────────────────────────────────────────
  const [examMeta, setExamMeta] = useState<ExamMeta | null>(null);

  // ── Bug 3: elapsed timer (seconds since exam started) ─────────────────────
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!examMeta?.createdAt) return;
    const started = new Date(examMeta.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [examMeta?.createdAt]);

  const peerConnections  = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load students + historical alerts + exam metadata from DB ──────────────
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/live?examId=${examId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Bug 3: set exam metadata when returned by the API
      if (data.exam) setExamMeta(data.exam);

      // Use functional update so prev state is accessible — critical to
      // preserve live WebRTC streams (stream, allStreams) that arrive via
      // ontrack and must NOT be overwritten on every poll cycle.
      setStudents(prev => {
        const studentsMap = new Map<string, StudentStream>();
        (data.students ?? []).forEach((s: any) => {
          const existing = prev.get(s.studentId); // ← read from PREVIOUS state (not new empty map)
          studentsMap.set(s.studentId, {
            studentId:       s.studentId,
            studentName:     s.name,
            participationId: s.id,
            connected:       s.status === 'in-progress' || s.status === 'joined',
            alertCount:      s.alerts?.length ?? 0,
            lastSnapshot:    s.lastSnapshot ?? undefined,
            stream:          existing?.stream,
            allStreams:       existing?.allStreams,
          });
        });
        return studentsMap;
      });

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
            evidence_url:    a.evidence_url ?? a.evidenceUrl,
            timestamp:       a.timestamp ?? new Date().toISOString(),
          });
        });
      });
      enriched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAlerts(prev => {
        const knownUrls = new Map(prev.map(a => [a.id, a.evidence_url]));
        return enriched
          .map(a => ({ ...a, evidence_url: a.evidence_url ?? knownUrls.get(a.id) }))
          .slice(0, 200);
      });
    } catch (err) {
      console.error('[ProctorView] Error cargando datos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  // ── Close exam — Graceful Shutdown (Nivel 1) ──────────────────────────────
  // After broadcasting 'exam-closed', we wait GRACE_MS before navigating away.
  // This gives in-flight student alert fetches (Storage upload + /api/live POST)
  // time to reach the server before the instructor tab tears down.
  const GRACE_MS = 5_000;

  const handleCloseExam = async () => {
    setIsClosing(true);
    try {
      const res = await fetch('/api/live', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:  'TERMINATE_ALL_SESSIONS',
          payload: { examId },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Notify students via Supabase broadcast (best-effort; polling will also catch it)
      signalingChannel.current?.send({
        type:  'broadcast',
        event: 'webrtc-signaling',
        payload: { type: 'exam-closed', fromId: 'instructor', toId: 'all' },
      });

      // ── Grace period ──────────────────────────────────────────────────────
      // isClosing=true already — the button already shows "Sincronizando..."
      // We wait here so that any in-flight student alert fetches can land
      // on the server before we navigate away and the page unmounts.
      await new Promise(r => setTimeout(r, GRACE_MS));

      toast({ title: 'Examen finalizado', description: 'Todas las evidencias han sido sincronizadas.' });
      router.push('/instructor/historic');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: `No se pudo finalizar: ${err.message}` });
      setIsClosing(false);
    }
  };

  // ── Enviar un mensaje al estudiante ────────────────────────────────────────
  // El alumno lo recibe en su próximo heartbeat (≤5s) como notificación toast.
  const handleSendMessage = async () => {
    if (!maximizedStudent || !msgText.trim()) return;
    setIsSendingMsg(true);
    try {
      const res = await fetch('/api/live', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:  'SEND_MESSAGE_TO_STUDENT',
          payload: { examId, studentId: maximizedStudent.studentId, message: msgText.trim() },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: 'Mensaje enviado', description: `${maximizedStudent.studentName} lo recibirá en unos segundos.` });
      setMsgText('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el mensaje.' });
    } finally {
      setIsSendingMsg(false);
    }
  };

  // ── Retirar (bloquear) a un estudiante de la evaluación ────────────────────
  // Marca status='blocked'; el polling del alumno (≤5s) cierra su sesión y no
  // podrá reingresar.
  const handleRemoveStudent = async (student: StudentStream) => {
    setIsRemoving(true);
    try {
      const res = await fetch('/api/live', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:  'BLOCK_STUDENT',
          payload: { examId, studentId: student.studentId, reason: 'Retirado por el supervisor.' },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: 'Estudiante retirado', description: `${student.studentName} fue retirado de la evaluación.` });
      setMaximizedStudent(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo retirar al estudiante.' });
    } finally {
      setIsRemoving(false);
    }
  };

  // ── WebRTC signaling handler ───────────────────────────────────────────────
  const handleWebRTCSignaling = useCallback(async ({ payload }: any) => {
    const { type, fromId, toId, data, isRenegotiation } = payload;

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

    if (toId !== 'instructor') return;

    if (type === 'offer') {
      let pc: RTCPeerConnection;

      if (isRenegotiation && peerConnections.current.has(fromId)) {
        pc = peerConnections.current.get(fromId)!;
      } else {
        const stale = peerConnections.current.get(fromId);
        if (stale) {
          stale.close();
          peerConnections.current.delete(fromId);
        }

        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerConnections.current.set(fromId, pc);

        pc.onicecandidate = ({ candidate }) => {
          if (candidate && signalingChannel.current) {
            signalingChannel.current.send({
              type: 'broadcast',
              event: 'webrtc-signaling',
              payload: { type: 'ice-candidate', fromId: 'instructor', toId: fromId, data: candidate.toJSON() },
            });
          }
        };

        // ── Tarea 1: accumulate unique streams for PiP classification ──────
        // The student sends camera tracks in streamRef and screen tracks in
        // screenStreamRef — two separate MediaStream objects. We collect all
        // unique streams here; VideoPlayer classifies them at render time
        // (camera = has audio tracks, screen = video-only).
        pc.ontrack = (event) => {
          const incomingStream = event.streams[0];
          if (!incomingStream) return;
          setStudents(prev => {
            const updated = new Map(prev);
            const student = updated.get(fromId);
            if (!student) return prev;
            const existing = student.allStreams ?? [];
            if (existing.some(s => s.id === incomingStream.id)) return updated; // deduplicate
            updated.set(fromId, {
              ...student,
              allStreams: [...existing, incomingStream],
              stream: incomingStream, // keep legacy field updated
            });
            return updated;
          });
        };

        // ── Tarea 2: ICE reconnection — ask student to renegotiate ──────────
        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.warn('[ProctorView] ICE', pc.iceConnectionState, 'for student', fromId, '— requesting renegotiation');
            signalingChannel.current?.send({
              type:  'broadcast',
              event: 'webrtc-signaling',
              payload: { type: 'request-renegotiation', fromId: 'instructor', toId: fromId },
            });
          }
        };
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      signalingChannel.current?.send({
        type: 'broadcast',
        event: 'webrtc-signaling',
        payload: { type: 'answer', fromId: 'instructor', toId: fromId, data: { type: answer.type, sdp: answer.sdp } },
      });
      return;
    }

    if (type === 'ice-candidate') {
      const pc = peerConnections.current.get(fromId);
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
    }
  }, []);

  // ── Supabase: Realtime alerts + WebRTC Broadcast ──────────────────────────
  useEffect(() => {
    loadData();
    const pollInterval = setInterval(loadData, 30_000);

    const channel = supabase
      .channel(`exam-room-${examId}`)
      // Alertas en tiempo real vía Broadcast emitido por el servidor (service_role).
      // Reemplaza `postgres_changes`, que dejó de funcionar al activar RLS en
      // `public.alerts`. El payload es la fila de la alerta insertada.
      .on('broadcast', { event: 'new-alert' }, ({ payload }: any) => {
        const newAlert = payload as DbAlert;
        if (!newAlert?.student_id) return;
        setStudents(prev => {
          const student = prev.get(newAlert.student_id);
          if (!student) return prev;
          const updated = new Map(prev);
          updated.set(newAlert.student_id, { ...student, alertCount: student.alertCount + 1 });
          return updated;
        });
        setAlerts(prev => {
          // Evita duplicar si el polling de 30s ya trajo esta alerta.
          if (newAlert.id && prev.some(a => a.id === newAlert.id)) return prev;
          return [newAlert, ...prev].slice(0, 200);
        });
      })
      .on('broadcast', { event: 'webrtc-signaling' }, handleWebRTCSignaling)
      .subscribe((status: string) => setIsConnected(status === 'SUBSCRIBED'));

    signalingChannel.current = channel;

    return () => {
      clearInterval(pollInterval);
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      signalingChannel.current = null;
      supabase.removeChannel(channel);
    };
  }, [examId, loadData, handleWebRTCSignaling]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const studentsArray = Array.from(students.values());
  const activeCount   = studentsArray.filter(s => s.connected).length;
  const alertCount    = studentsArray.reduce((sum, s) => sum + s.alertCount, 0);

  const filteredAlerts = alertFilter === 'all'
    ? alerts
    : alerts.filter(a => a.severity === alertFilter);

  const resolveStudentName = (alert: DbAlert) =>
    alert.studentName ??
    students.get(alert.student_id)?.studentName ??
    `ID:${alert.student_id.substring(0, 8)}`;

  const handleExportAlerts = () => {
    const csv = [
      'Timestamp,Estudiante,Severidad,Descripción',
      ...filteredAlerts.map(a =>
        `"${a.timestamp}","${resolveStudentName(a)}","${a.severity}","${a.description.replace(/"/g, "'")}"`,
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `alertas-examen-${examId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Timer display ─────────────────────────────────────────────────────────
  const durationSeconds = (examMeta?.duration ?? 0) * 60;
  const remaining       = Math.max(durationSeconds - elapsed, 0);
  const isOvertime      = durationSeconds > 0 && elapsed > durationSeconds;

  const timerValue = durationSeconds > 0
    ? (isOvertime ? `+${formatDuration(elapsed - durationSeconds)}` : formatDuration(remaining))
    : formatDuration(elapsed);

  const timerSub = durationSeconds > 0
    ? (isOvertime ? 'Tiempo excedido' : 'Tiempo restante')
    : 'Tiempo transcurrido';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* ── Header row ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            {examMeta?.title ?? 'Panel de Vigilancia'}
          </h1>
          <p className="text-sm text-gray-500">
            Resumen de la actividad de los estudiantes
          </p>

          {/* Bug 3: Access code displayed prominently so instructor can dictate it */}
          {examMeta?.accessCode && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Código de acceso:
              </span>
              <span
                className="font-mono font-extrabold text-lg tracking-[0.25em] px-3 py-0.5 rounded-lg"
                style={{ backgroundColor: '#1A1D47', color: '#00D4FF' }}
              >
                {examMeta.accessCode}
              </span>
              <button
                title="Copiar código"
                onClick={() => {
                  navigator.clipboard.writeText(examMeta.accessCode);
                  toast({ description: 'Código copiado al portapapeles' });
                }}
                className="opacity-50 hover:opacity-100 transition-opacity"
              >
                <Copy className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          )}
        </div>

        {/* Right side: grid toggle + connection badge + Finalizar button */}
        <div className="flex items-center gap-3 flex-shrink-0">

          <Badge
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full"
            style={{
              backgroundColor: isConnected ? '#DCFCE7' : '#FEE2E2',
              color:           isConnected ? '#15803D' : '#DC2626',
            }}
          >
            {isConnected
              ? <><Wifi    className="h-3.5 w-3.5" /> Tiempo real</>
              : <><WifiOff className="h-3.5 w-3.5" /> Conectando...</>}
          </Badge>

          {/* Finalizar Examen — hidden in readOnly (Super Admin ghost view) */}
          {readOnly && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border border-amber-400/50 text-amber-400 bg-amber-400/10">
              👁 Modo Lectura
            </span>
          )}
          {!readOnly && <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="gap-2 font-bold h-9 px-4 text-sm shadow"
                disabled={isClosing}
              >
                {isClosing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sincronizando evidencias...
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4" />
                    Finalizar Examen
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Finalizar el examen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esto marcará el examen como <strong>terminado</strong>, cerrará todas las sesiones de los
                  estudiantes y no podrás reactivar la sala. Esta acción es irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCloseExam}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  Sí, finalizar examen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Estudiantes Activos"
          value={activeCount.toString()}
          sub="Estudiantes en línea"
          gradient="linear-gradient(135deg, #00BBFF 0%, #0095FF 100%)"
          icon="👥"
        />
        {/* Bug 3: real timer card */}
        <MetricCard
          label="Tiempo de Monitoreo"
          value={timerValue}
          sub={timerSub}
          color={isOvertime ? '#EF4444' : '#0095FF'}
          icon="🕐"
        />
        <MetricCard
          label="Estudiantes con Alertas"
          value={studentsArray.filter(s => s.alertCount > 0).length.toString()}
          sub="Estadísticas en línea"
          color="#EF4444"
          icon="🔔"
        />
        <MetricCard
          label="Total de Alertas"
          value={alertCount.toString()}
          sub="Alertas registradas"
          color="#10B981"
          icon="🛡"
        />
      </div>

      {/* ── Student grid ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800">
            Monitoreo de estudiantes
            {studentsArray.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({studentsArray.length} {studentsArray.length === 1 ? 'estudiante' : 'estudiantes'})
              </span>
            )}
          </h2>
          {gridMode === 'dense' && (
            <span className="text-xs text-gray-400 italic">Clic en video para maximizar</span>
          )}
        </div>

        <div className="rounded-xl p-3 border border-white/10" style={{ backgroundColor: '#111827' }}>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/5 animate-pulse"
                  style={{ backgroundColor: '#0A1228', aspectRatio: '4/3' }}
                />
              ))}
            </div>
          ) : studentsArray.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Video className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Esperando conexión de estudiantes...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {studentsArray.map(student => (
                <DenseStudentCell
                  key={student.studentId}
                  student={student}
                  onMaximize={() => setMaximizedStudent(student)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Maximize modal ────────────────────────────────────────────────── */}
      {maximizedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
          onClick={() => setMaximizedStudent(null)}
        >
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 w-full max-w-3xl flex flex-col max-h-[92vh]"
            style={{ backgroundColor: '#0A0E1A' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0"
              style={{ backgroundColor: '#111827' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: '#4A5568' }}>
                  {maximizedStudent.studentName?.[0] ?? '?'}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{maximizedStudent.studentName}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>
                    ID: {maximizedStudent.studentId.substring(0, 12)}
                    {maximizedStudent.alertCount > 0 && (
                      <span className="ml-2 text-red-400 font-semibold">
                        · {maximizedStudent.alertCount} alerta{maximizedStudent.alertCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: maximizedStudent.connected ? '#22C55E22' : '#64748B22',
                    color: maximizedStudent.connected ? '#4ADE80' : '#94A3B8',
                  }}>
                  {maximizedStudent.connected ? '● Activo' : '○ Inactivo'}
                </span>
                <button
                  onClick={() => setMaximizedStudent(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="relative bg-black flex-shrink min-h-0" style={{ aspectRatio: '16/9', maxHeight: '52vh' }}>
              {maximizedStudent.stream ? (
                <VideoPlayer stream={maximizedStudent.stream} allStreams={maximizedStudent.allStreams} />
              ) : maximizedStudent.lastSnapshot ? (
                <img
                  src={maximizedStudent.lastSnapshot}
                  alt={maximizedStudent.studentName}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                  {maximizedStudent.connected
                    ? <><Video className="h-16 w-16 mb-3 animate-pulse" /><p className="text-sm">Conectando video...</p></>
                    : <><VideoOff className="h-16 w-16 mb-3" /><p className="text-sm">Sin video</p></>
                  }
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-white/10 space-y-3 flex-shrink-0"
              style={{ backgroundColor: '#111827' }}>
              {/* Enviar mensaje al estudiante */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !isSendingMsg) handleSendMessage(); }}
                  placeholder={`Enviar un mensaje a ${maximizedStudent.studentName}…`}
                  maxLength={500}
                  className="flex-1 rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
                <Button
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={isSendingMsg || !msgText.trim()}
                  className="gap-1.5 h-9 flex-shrink-0"
                >
                  {isSendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </Button>
              </div>

              {/* Retirar de la evaluación */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-white/25">
                  El estudiante recibirá el mensaje como notificación en unos segundos.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1.5 h-8 flex-shrink-0" disabled={isRemoving}>
                      {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      Retirar de la evaluación
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Retirar a {maximizedStudent.studentName}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        El estudiante será retirado de la evaluación y no podrá volver a ingresar.
                        Su sesión se cerrará automáticamente en unos segundos. Esta acción es irreversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemoveStudent(maximizedStudent)}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      >
                        Retirar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert panel ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800">Panel de alertas</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8"
              onClick={handleExportAlerts}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar alertas
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8"
              onClick={handleExportAlerts}
            >
              <Filter className="h-3.5 w-3.5" />
              Exportar Estadísticas
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            {(['all', 'critical', 'warning', 'info'] as AlertFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setAlertFilter(f)}
                className={[
                  'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  alertFilter === f
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
                ].join(' ')}
              >
                {f === 'all'      ? 'Todos'
                  : f === 'critical' ? 'Críticos'
                  : f === 'warning'  ? 'Advertencias'
                  : 'Info'}
              </button>
            ))}
            {filteredAlerts.length > 0 && (
              <span className="ml-auto text-xs text-gray-400">{filteredAlerts.length} alertas</span>
            )}
          </div>

          <ScrollArea className="h-64">
            {filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <p className="text-sm">Sin alertas{alertFilter !== 'all' ? ' para este filtro' : ''}</p>
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {filteredAlerts.map(alert => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    studentName={resolveStudentName(alert)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </section>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon, gradient, color,
}: {
  label: string; value: string; sub: string; icon: string;
  gradient?: string; color?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 text-white shadow-md"
      style={{ background: gradient ?? color }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold opacity-90">{label}</span>
      </div>
      <p className="text-3xl font-bold leading-none font-mono">{value}</p>
      <p className="text-sm opacity-70 mt-1.5">{sub}</p>
    </div>
  );
}

// ─── StudentCard ──────────────────────────────────────────────────────────────

function StudentCard({
  student, onBlock, onMaximize,
}: { student: StudentStream; onBlock: () => void; onMaximize: () => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col border border-white/10 shadow"
      style={{ backgroundColor: '#1A2744', opacity: student.connected ? 1 : 0.5 }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: '#4A5568' }}
          >
            {student.studentName?.[0] ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">
              {student.studentName}
            </p>
            <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
              ID:{student.studentId.substring(0, 8)}
            </p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-1"
          style={{
            backgroundColor: student.connected ? '#22C55E' : '#64748B',
            color: '#fff',
          }}
        >
          {student.connected ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div
        className="mx-2 rounded-lg overflow-hidden relative flex items-center justify-center cursor-pointer group"
        style={{ height: 110, backgroundColor: '#0A1228' }}
        onClick={onMaximize}
        title="Clic para maximizar"
      >
        {student.stream ? (
          <VideoPlayer stream={student.stream} />
        ) : student.lastSnapshot ? (
          <img
            src={student.lastSnapshot}
            alt={student.studentName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          student.connected
            ? <Video    className="h-7 w-7 text-white/20 animate-pulse" />
            : <VideoOff className="h-7 w-7 text-white/20" />
        )}

        {student.alertCount > 0 && (
          <span
            className="absolute top-2 right-2 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: '#EF4444' }}
          >
            {student.alertCount}
          </span>
        )}

        {/* Maximize overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-70 transition-opacity" />
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <ScanFace className="h-4 w-4" style={{ color: '#94A3B8' }} />
        <button
          title="Bloquear estudiante"
          onClick={onBlock}
          className="opacity-40 hover:opacity-100 transition-opacity"
        >
          <Ban className="h-3.5 w-3.5 text-red-400" />
        </button>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: student.alertCount > 0 ? '#EF4444' : '#22C55E' }}
        />
      </div>
    </div>
  );
}

// ─── DenseStudentCell (vista grid densificada) ─────────────────────────────────

function DenseStudentCell({
  student, onMaximize,
}: { student: StudentStream; onMaximize: () => void }) {
  return (
    <div
      className={`rounded-lg overflow-hidden relative cursor-pointer group transition-base ${
        student.alertCount > 0
          ? 'ring-2 ring-red-500/60 border border-red-500/30'
          : 'border border-white/5 hover:border-white/20'
      }`}
      style={{ backgroundColor: '#0A1228', aspectRatio: '4/3' }}
      onClick={onMaximize}
      title={`${student.studentName} — clic para maximizar`}
    >
      {student.stream ? (
        <VideoPlayer stream={student.stream} allStreams={student.allStreams} />
      ) : student.lastSnapshot ? (
        <img
          src={student.lastSnapshot}
          alt={student.studentName}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {student.connected
            ? <Video    className="h-6 w-6 text-white/15 animate-pulse" />
            : <VideoOff className="h-6 w-6 text-white/15" />}
        </div>
      )}

      {/* Alert badge */}
      {student.alertCount > 0 && (
        <span
          className="absolute top-1 right-1 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full z-10"
          style={{ backgroundColor: '#EF4444' }}
        >
          {student.alertCount}
        </span>
      )}

      {/* Name overlay — always visible */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
        <p className="text-white text-[10px] font-semibold leading-none truncate">
          {student.studentName}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: student.connected ? '#22C55E' : '#64748B' }} />
          <span className="text-[8px] text-white/50">
            {student.connected ? 'activo' : 'inactivo'}
          </span>
        </div>
      </div>

      {/* Hover maximize hint */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-60 transition-opacity" />
      </div>
    </div>
  );
}

// ─── AlertRow ─────────────────────────────────────────────────────────────────

function AlertRow({ alert, studentName }: { alert: DbAlert; studentName: string }) {
  const color = SEVERITY_COLOR[alert.severity] ?? '#6B7280';
  const label = SEVERITY_LABEL[alert.severity] ?? alert.severity;
  const hasEvidence = !!alert.evidence_url;

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
      <span
        className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{studentName}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{alert.description}</p>
      </div>

      {/* Evidence photo button — only shown when a snapshot URL exists */}
      {hasEvidence && (
        <Dialog>
          <DialogTrigger asChild>
            <button
              title="Ver foto de evidencia"
              className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors"
              style={{
                color:           color,
                borderColor:     color + '44',
                backgroundColor: color + '11',
              }}
            >
              <Camera className="h-3 w-3" />
              Foto
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl p-0 overflow-hidden">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="text-sm font-semibold text-gray-800 leading-tight">
                Evidencia fotográfica
                <span className="ml-2 font-normal text-gray-400">— {studentName}</span>
              </DialogTitle>
              <p className="text-xs text-gray-400 mt-0.5">{alert.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: color }}
                >
                  {label}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(alert.timestamp).toLocaleString('es-CL', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </span>
              </div>
            </DialogHeader>
            <div className="bg-black">
              <img
                src={alert.evidence_url}
                alt={`Evidencia — ${alert.description}`}
                className="w-full object-contain max-h-[60vh]"
              />
            </div>
            <div className="px-5 py-3 flex justify-end">
              <a
                href={alert.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Abrir en nueva pestaña
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <p className="text-xs text-gray-400 flex-shrink-0 mt-0.5 tabular-nums">
        {new Date(alert.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
    </div>
  );
}

// ─── VideoPlayer ──────────────────────────────────────────────────────────────
// Tarea 1: Renders Picture-in-Picture when two streams are available.
// Classification rule:
//   camera stream  = MediaStream that has at least one AudioTrack
//   screen stream  = MediaStream with video-only (no AudioTracks)
// This is reliable because the student sends camera+mic on one stream and
// screen-only on another stream (pc.addTrack with separate MediaStream refs).

function VideoPlayer({ stream, allStreams }: { stream: MediaStream; allStreams?: MediaStream[] }) {
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  // Classify streams at render time — streams are live objects so
  // getAudioTracks() reflects all tracks that have been added by now.
  const streams = allStreams && allStreams.length > 0 ? allStreams : [stream];
  const cameraStream = streams.find(s => s.getAudioTracks().length > 0) ?? null;
  const screenStream = streams.find(s => s.getAudioTracks().length === 0 && s.getVideoTracks().length > 0) ?? null;
  const hasPiP = cameraStream && screenStream;

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream ?? stream;
    }
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [stream, cameraStream, screenStream]);

  return (
    <>
      {/* Background: screen share (or fallback to the only stream) */}
      <video
        ref={screenVideoRef}
        autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* PiP: webcam — only rendered when we have two separate streams */}
      {hasPiP && (
        <video
          ref={cameraVideoRef}
          autoPlay playsInline muted
          className="absolute top-2 right-2 w-1/3 aspect-video rounded-md shadow-lg border border-white/20 object-cover z-10"
          style={{ transform: 'scaleX(-1)' }}
        />
      )}
    </>
  );
}
