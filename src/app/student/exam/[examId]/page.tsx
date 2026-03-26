'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ExamHeader } from '@/components/student/exam-header';
import { RequirementsModal } from '@/components/student/requirements-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  XCircle,
  AlertTriangle,
  LogOut,
  CheckCircle,
  ExternalLink,
  Send,
  Loader2,
  ShieldCheck,
  Eye,
  MonitorCheck,
} from 'lucide-react';
import { DocumentTitleHandler } from '@/components/student/document-title-handler';
import { StudentCam } from '@/components/proctoring/StudentCam';

export type ExamStep = 'requirements' | 'monitoring' | 'finished';

interface ExamData {
  title: string;
  subject: string;
  section: string;
  duration: number;
  status: 'pending' | 'active' | 'finished';
}

// ─── Professional loader ────────────────────────────────────────────────────

const ProfessionalLoader = () => (
  <div className="flex flex-col min-h-screen items-center justify-center p-8 bg-slate-50">
    <div className="w-16 h-16 rounded-2xl bg-[#1A1D47]/10 flex items-center justify-center mb-6">
      <ShieldCheck className="h-8 w-8 text-[#1A1D47]" />
    </div>
    <h1 className="text-2xl font-bold mb-2 text-slate-800">Preparando Entorno Seguro</h1>
    <p className="text-sm text-slate-500 mb-6">Verificando conexión y cargando datos del examen…</p>
    <Skeleton className="h-1.5 w-48 rounded-full bg-slate-200" />
  </div>
);

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StudentExamLivePage() {
  const { user, userProfile, loading } = useAuth();
  const params = useParams();
  const examId = Array.isArray(params.examId) ? params.examId[0] : params.examId;

  const [step,               setStep]               = useState<ExamStep>('requirements');
  const [examData,           setExamData]           = useState<ExamData | null>(null);
  const [participationId, setParticipationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(`participation_${examId}`) ?? null;
  });
  const [blockReason,        setBlockReason]        = useState('');
  const [fullscreenKey,      setFullscreenKey]      = useState('F11');
  const [isFinishing,        setIsFinishing]        = useState(false);
  const [isTerminated,       setIsTerminated]       = useState(false);
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);

  const { toast } = useToast();

  const handleStudentAlert = useCallback((
    _alertType: string,
    _description: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
  ) => {
    if (severity === 'critical') {
      setCriticalAlertCount(prev => prev + 1);
    }
  }, []);

  const handleStudentReady = useCallback(() => {
    toast({ title: 'Monitoreo activo', description: 'Cámara y pantalla conectadas con el instructor.' });
  }, [toast]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.navigator.userAgent.includes('Mac')) {
      setFullscreenKey('Cmd + Ctrl + F');
    }
  }, []);

  const participationIdRef = React.useRef(participationId);
  useEffect(() => { participationIdRef.current = participationId; }, [participationId]);

  useEffect(() => {
    if (!examId || !user) return;

    const studentIdForCheck = userProfile?.uid || user.uid;
    if (!studentIdForCheck) return;

    const fetchExamStatus = async () => {
      try {
        const token = await user.getIdToken();
        if (!token) return;

        const response = await fetch(`/api/exam-sessions/${examId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404) throw new Error('Examen no encontrado o acceso no autorizado.');
          if (response.status === 401) throw new Error('Tu sesión ha expirado. Por favor recarga.');
          throw new Error('Error de conexión con el servidor.');
        }

        const data = await response.json();
        setExamData(data.exam);

        if (data.participationId && !participationIdRef.current) {
          setParticipationId(data.participationId);
        }

        if (!isTerminated) {
          if (data.studentStatus === 'blocked') {
            setBlockReason('Has sido bloqueado por el instructor.');
            setIsTerminated(true);
            setStep('finished');
          } else if (data.exam.status === 'finished') {
            setBlockReason('La sesión de examen ha sido finalizada por el instructor.');
            setIsTerminated(true);
            setStep('finished');
          }
        }
      } catch (error: any) {
        console.error('Error polling exam data:', error);
        if (error.message.includes('no encontrado') || error.message.includes('bloqueado')) {
          toast({ variant: 'destructive', title: 'Error de Acceso', description: error.message });
        }
      }
    };

    fetchExamStatus();
    const interval = setInterval(fetchExamStatus, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, user, userProfile, isTerminated, toast]);

  const handleAcceptRequirements = () => {
    setStep('monitoring');
  };

  const handleFinishExam = async () => {
    const studentIdToUse = userProfile?.uid || user?.uid;
    if (!studentIdToUse || !examId) return;

    setIsFinishing(true);
    try {
      await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finish',
          payload: { studentId: studentIdToUse, examId },
        }),
      });
      toast({ title: 'Examen Finalizado', description: 'Tu sesión de monitoreo ha terminado.' });
      setIsTerminated(true);
      setStep('finished');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Intenta de nuevo.' });
    } finally {
      setIsFinishing(false);
    }
  };

  const examStarted = step === 'monitoring';

  if (loading || !examData) return <ProfessionalLoader />;

  // ── Finished / blocked screen ──────────────────────────────────────────────
  if (step === 'finished') {
    return (
      <div className="fixed inset-0 bg-slate-100 flex items-center justify-center p-4 z-50">
        <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
          <div className={`px-8 pt-8 pb-6 text-center border-b ${blockReason ? 'border-red-100' : 'border-green-100'}`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${blockReason ? 'bg-red-50' : 'bg-green-50'}`}>
              {blockReason
                ? <XCircle className="h-8 w-8 text-red-500" />
                : <CheckCircle className="h-8 w-8 text-green-500" />}
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              {blockReason ? 'Sesión Interrumpida' : 'Monitoreo Finalizado'}
            </h2>
            <p className="text-sm text-slate-500">
              {blockReason || 'Has completado la sesión de monitoreo exitosamente.'}
            </p>
          </div>
          <div className="p-8">
            <Button
              onClick={() => window.location.href = '/student'}
              className="w-full h-12 font-bold text-white"
              style={{ backgroundColor: '#1A1D47' }}
            >
              <LogOut className="mr-2 h-5 w-5" />
              Volver al Portal de Estudiantes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) return null;

  const studentId   = userProfile.uid ?? user.uid;
  const studentName = userProfile.nombre ?? userProfile.correo ?? user.email ?? 'Estudiante';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <DocumentTitleHandler criticalAlertCount={criticalAlertCount} />

      <RequirementsModal
        isOpen={step === 'requirements'}
        onAcceptRequirements={handleAcceptRequirements}
      />

      {/* Navy topbar — same style as instructor dashboard */}
      <ExamHeader examStarted={examStarted} examData={examData} />

      <main className="flex-grow mt-16 px-4 pb-6">
        {step === 'monitoring' ? (
          <div className="max-w-6xl mx-auto py-6 grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* ── Left: StudentCam — Picture-in-Picture panel ─────────────── */}
            <div className="lg:col-span-2">
              {participationId ? (
                <StudentCam
                  examId={examId}
                  studentId={studentId}
                  studentName={studentName}
                  participationId={participationId}
                  enableAI={true}
                  onAlert={handleStudentAlert}
                  onReady={handleStudentReady}
                />
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center gap-3 p-8 shadow-sm" style={{ minHeight: 220 }}>
                  <Loader2 className="h-8 w-8 animate-spin text-[#1A1D47]" />
                  <p className="text-sm text-slate-400">Iniciando cámara…</p>
                </div>
              )}
            </div>

            {/* ── Right: Exam instructions ─────────────────────────────────── */}
            <div className="lg:col-span-3 space-y-4">

              {/* Active monitoring card */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">

                {/* Card header — navy topbar style */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3"
                  style={{ background: 'linear-gradient(135deg,#1A1D47 0%,#242F62 100%)' }}>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />
                  <div>
                    <h2 className="text-white font-bold text-lg leading-tight">MONITOREO ACTIVO</h2>
                    <p className="text-white/60 text-xs">{examData.title}</p>
                  </div>
                  <MonitorCheck className="h-5 w-5 text-sky-300 ml-auto" />
                </div>

                <div className="p-6 space-y-5">
                  {/* Rules box */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-bold flex items-center gap-2 mb-3 text-amber-700 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Requerimientos de Monitoreo
                    </p>
                    <ul className="space-y-2 text-sm text-amber-800">
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-amber-500">•</span>
                        Mantén la pantalla completa
                        {' '}(<code className="font-mono text-xs bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded text-amber-700">{fullscreenKey}</code>)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-amber-500">•</span>
                        No cambies de pestaña, ni minimices la ventana
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-amber-500">•</span>
                        Mantente siempre visible y sin ayuda externa
                      </li>
                    </ul>
                  </div>

                  {/* Blackboard button */}
                  <Button
                    className="w-full text-base font-bold shadow-sm text-white border-0"
                    style={{
                      background: 'linear-gradient(135deg, #1A1D47 0%, #242F62 100%)',
                      height: 52,
                    }}
                    onClick={() => window.open('https://ugm.blackboard.com/?new_loc=%2Fultra%2Fcourse', '_blank')}
                  >
                    <ExternalLink className="mr-2 h-5 w-5" />
                    Abrir Plataforma de Examen (Blackboard)
                  </Button>
                  <p className="text-xs text-center text-slate-400">
                    Se abrirá en una nueva pestaña · No cierres esta ventana de monitoreo
                  </p>
                </div>

                <div className="px-6 pb-6">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-11 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-semibold"
                        disabled={isFinishing}
                      >
                        {isFinishing
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Send className="mr-2 h-4 w-4" />}
                        Terminé mi examen — Finalizar Monitoreo
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmas que has terminado?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esto finalizará la sesión de vigilancia. Asegúrate de haber enviado tus respuestas en Blackboard primero.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleFinishExam} className="bg-red-600 hover:bg-red-700">
                          Sí, finalizar sesión
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Security reminder pill */}
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm">
                <ShieldCheck className="h-4 w-4 text-[#1A1D47] flex-shrink-0" />
                <p className="text-xs text-slate-500">
                  Esta sesión está siendo vigilada en tiempo real por el instructor. Tu audio y video son monitoreados.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl mx-auto p-4 text-center mt-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#1A1D47] mx-auto mb-4" />
            <p className="text-slate-500 font-semibold">Cargando la interfaz de verificación…</p>
          </div>
        )}
      </main>
    </div>
  );
}
