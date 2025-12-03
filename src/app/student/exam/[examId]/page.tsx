"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ExamHeader } from '@/components/student/exam-header';
import { ProctoringPanel } from '@/components/student/proctoring-panel';
import { ExamFooter } from '@/components/student/exam-footer';
import { RequirementsModal } from '@/components/student/requirements-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { XCircle, AlertTriangle, LogOut, CheckCircle, ExternalLink, Send, Loader2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import { DocumentTitleHandler } from '@/components/student/document-title-handler';

export type ExamStep = 'requirements' | 'monitoring' | 'finished';

interface ExamData {
    title: string;
    subject: string;
    section: string;
    duration: number;
    status: 'pending' | 'active' | 'finished';
}

export default function StudentExamLivePage() {
  const { user, userProfile, loading } = useAuth();
  const params = useParams();
  // Aseguramos que examId sea string y manejamos posibles arrays
  const examId = Array.isArray(params.examId) ? params.examId[0] : params.examId;

  const [step, setStep] = useState<ExamStep>('requirements');
  const [examData, setExamData] = useState<ExamData | null>(null);
  const { toast } = useToast();
  const [blockReason, setBlockReason] = useState('');
  const [fullscreenKey, setFullscreenKey] = useState('F11');
  const [isFinishing, setIsFinishing] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.navigator.userAgent.includes('Mac')) {
        setFullscreenKey('Cmd + Ctrl + F');
    }
  }, []);

  // --- CARGA DE DATOS Y POLLING (CORREGIDO) ---
  useEffect(() => {
    // Esperar a que tengamos el ID y el usuario autenticado
    if (!examId || !user) return;

    const fetchExamStatus = async () => {
        try {
            // 1. OBTENER TOKEN DE SEGURIDAD (CRÍTICO)
            const token = await user.getIdToken();
            if (!token) {
                console.warn("No se pudo obtener el token de autenticación");
                return;
            }

            // 2. HACER PETICIÓN CON HEADERS
            const response = await fetch(`/api/exam-sessions/${examId}`, {
                headers: {
                    'Authorization': `Bearer ${token}` // ✅ Llave maestra
                }
            });

            if (!response.ok) {
                if (response.status === 404) throw new Error("Examen no encontrado o acceso no autorizado.");
                if (response.status === 401) throw new Error("Tu sesión ha expirado. Por favor recarga.");
                throw new Error("Error de conexión con el servidor.");
            }

            const data = await response.json();
            setExamData(data.exam);

            // 3. VERIFICAR ESTADO DEL ESTUDIANTE
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
            console.error("Error polling exam data:", error);
            // Solo mostramos toast si es un error fatal, no por fallos de red momentáneos
            if (error.message.includes('no encontrado') || error.message.includes('bloqueado')) {
                 toast({ 
                     variant: "destructive", 
                     title: "Error de Acceso", 
                     description: error.message 
                 });
            }
        }
    };

    // Carga inicial
    fetchExamStatus();

    // Polling cada 5 segundos para mantener sincronía
    const interval = setInterval(fetchExamStatus, 5000);

    return () => clearInterval(interval);
  }, [examId, user, isTerminated, toast]);

  const handleAcceptRequirements = () => {
    setStep('monitoring');
  };

  const handleFinishExam = async () => {
    if (!user || !examId) return;
    setIsFinishing(true);
    try {
        await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'finish', 
                payload: { 
                    studentId: user.uid,
                    examId: examId,
                }
            })
        });
        toast({
            title: 'Examen Finalizado',
            description: 'Tu sesión de monitoreo ha terminado.',
        });
        setIsTerminated(true);
        setStep('finished');
    } catch (error) {
        console.error("Error finishing exam:", error);
        toast({ variant: "destructive", title: "Error", description: "Intenta de nuevo." });
    } finally {
        setIsFinishing(false);
    }
  };

  const examStarted = step === 'monitoring';

  if (loading || !examData) {
    return (
      <div className="flex flex-col min-h-screen bg-secondary p-4">
          <Skeleton className="h-16 w-full mb-4" />
          <div className="flex-grow flex container mx-auto gap-6 justify-center">
            <Skeleton className="h-[calc(100vh-150px)] w-full max-w-4xl" />
          </div>
      </div>
    );
  }

  if (step === 'finished') {
     return (
        <div className="flex flex-col min-h-screen bg-secondary items-center justify-center p-4">
             <Card className={`shadow-lg max-w-lg border-t-4 ${blockReason ? 'border-red-500' : 'border-green-500'}`}>
                <CardHeader>
                    <CardTitle className={`font-headline flex items-center gap-2 ${blockReason ? 'text-red-600' : 'text-green-600'}`}>
                        {blockReason ? <XCircle /> : <CheckCircle />} 
                        {blockReason ? 'Sesión Interrumpida' : 'Examen Finalizado'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4 pt-6">
                    <Alert variant={blockReason ? "destructive" : "default"}>
                        {blockReason ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        <AlertTitle>{blockReason ? 'Acceso Revocado' : '¡Todo listo!'}</AlertTitle>
                        <AlertDescription>
                           {blockReason || 'Has finalizado el monitoreo exitosamente. Ya puedes cerrar esta ventana.'}
                        </AlertDescription>
                    </Alert>
                    <Button onClick={() => window.location.href = '/student'} className="w-full mt-4">
                        <LogOut className="mr-2 h-4 w-4" /> Volver al Portal
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!user || !userProfile) return null;

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      <DocumentTitleHandler criticalAlertCount={criticalAlertCount} />
      <RequirementsModal 
        isOpen={step === 'requirements'} 
        onAcceptRequirements={handleAcceptRequirements} 
      />

      <ExamHeader examStarted={examStarted} examData={examData} />

      <main className="flex-grow flex items-center justify-center mt-16 mb-10 px-4">
        {step === 'monitoring' ? (
            <div className="w-full flex-grow flex items-center justify-center">
                <Card className="w-full max-w-2xl text-center shadow-lg border-0">
                    <CardHeader className="bg-[#161F45] text-white rounded-t-lg py-6">
                        <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]"></div>
                            Monitoreo Activo
                        </CardTitle>
                        <CardDescription className="text-blue-200">
                            La cámara y el micrófono están transmitiendo al supervisor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-8">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left text-sm text-yellow-800">
                            <p className="font-bold flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4"/> Reglas de Oro:</p>
                            <ul className="list-disc list-inside space-y-1 ml-1">
                                <li>Mantén la pantalla completa (<code className="bg-yellow-100 px-1 rounded">{fullscreenKey}</code>).</li>
                                <li>No cambies de pestaña ni minimices el navegador.</li>
                                <li>Mantente siempre frente a la cámara.</li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <Button 
                                className="w-full h-12 text-lg bg-[#00d4ff] hover:bg-[#00b8e6] text-[#161F45] font-bold"
                                onClick={() => window.open('https://ugm.blackboard.com/?new_loc=%2Fultra%2Fcourse', '_blank')}
                            >
                                <ExternalLink className="mr-2 h-5 w-5" />
                                Ir a Blackboard (Nueva Pestaña)
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                * Se abrirá en una nueva pestaña. No cierres esta ventana de monitoreo.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-gray-50 rounded-b-lg border-t p-6">
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full" disabled={isFinishing}>
                                    {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Terminé mi examen
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
                    </CardFooter>
                </Card>
            </div>
        ) : (
            <div className="w-full max-w-4xl mx-auto p-4 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4"/>
                <p className="text-muted-foreground">Preparando entorno seguro...</p>
            </div>
        )}
      </main>

      <ProctoringPanel 
        isTerminated={isTerminated} 
        onTerminate={(reason) => {
            setBlockReason(reason);
            setIsTerminated(true);
            setStep('finished');
        }}
        step={step} 
        examName={examData?.title ?? ''} 
        examId={examId}
        examSubject={examData?.subject ?? ''}
        examSection={examData?.section ?? ''}
        criticalAlertCount={criticalAlertCount}
        setCriticalAlertCount={setCriticalAlertCount}
      />

      <ExamFooter />
    </div>
  );
}