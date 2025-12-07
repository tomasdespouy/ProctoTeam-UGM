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

// --- NUEVO COMPONENTE DE CARGA ATRACTIVO ---
const ProfessionalLoader = () => (
    <div className="flex flex-col min-h-screen items-center justify-center p-8 bg-[#161F45] text-white">
        <Loader2 className="h-16 w-16 animate-spin text-white mb-6" />
        <h1 className="text-2xl font-bold mb-2">Preparando Entorno Seguro</h1>
        <p className="text-sm text-gray-400">Verificando conexión y cargando datos del examen...</p>
        <Skeleton className="h-4 w-64 mt-8 bg-gray-600/50" />
    </div>
);
// ------------------------------------------

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

  // --- CARGA DE DATOS Y POLLING ---
  useEffect(() => {
    // Esperar a que tengamos el ID y el usuario autenticado
    if (!examId || !user) return;

    // Usamos userProfile.uid como fuente principal (asumiendo que es el ID de la DB)
    const studentIdForCheck = userProfile?.uid || user.uid;
    if (!studentIdForCheck) return; // Validación de la identidad lista

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

    // Agregamos userProfile al dependency array para que el polling se inicie apenas tengamos el perfil
    return () => clearInterval(interval);
  }, [examId, user, userProfile, isTerminated, toast]); 

  const handleAcceptRequirements = () => {
    setStep('monitoring');
  };

  const handleFinishExam = async () => {
    // CORRECCIÓN: Usar userProfile.uid como fuente principal de verdad para el backend
    const studentIdToUse = userProfile?.uid || user.uid; 
    if (!studentIdToUse || !examId) return;

    setIsFinishing(true);
    try {
        await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'finish', 
                payload: { 
                    studentId: studentIdToUse,
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
    // REFINAMIENTO UX: Usar loader profesional
    return <ProfessionalLoader />;
  }

  if (step === 'finished') {
    // REFINAMIENTO UX: Pantalla de finalización más asertiva (Full Screen Modal)
     return (
        <div className="fixed inset-0 bg-[#161F45] flex items-center justify-center p-4 z-50">
             <Card className={`shadow-2xl max-w-lg w-full border-t-8 ${blockReason ? 'border-red-600' : 'border-green-500'}`}>
                <CardHeader className="bg-white p-6">
                    <CardTitle className={`font-bold flex items-center justify-center gap-3 text-2xl ${blockReason ? 'text-red-700' : 'text-green-600'}`}>
                        {blockReason ? <XCircle size={30} /> : <CheckCircle size={30} />} 
                        {blockReason ? 'Sesión Interrumpida' : 'Proceso de Monitoreo Finalizado'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-5 pt-8 pb-6">
                    <Alert variant={blockReason ? "destructive" : "default"} className="bg-gray-50 border-none text-left">
                        <AlertDescription className="text-base text-gray-700">
                           {blockReason || 'Has completado la sesión de monitoreo exitosamente. Ahora puedes enviar o verificar tus respuestas en la plataforma del examen.'}
                        </AlertDescription>
                    </Alert>
                    <Button onClick={() => window.location.href = '/student'} className="w-full h-12 mt-4 bg-[#161F45] hover:bg-[#0c1223]">
                        <LogOut className="mr-2 h-5 w-5" /> Volver al Portal de Estudiantes
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
                <Card className="w-full max-w-2xl text-center shadow-2xl border-0">
                    <CardHeader className="bg-[#161F45] text-white rounded-t-lg py-6">
                        <CardTitle className="text-2xl font-bold flex items-center justify-center gap-3">
                            {/* REVISIÓN DE TEXTO */}
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]"></div>
                            MONITOREO ACTIVO
                        </CardTitle>
                        <CardDescription className="text-gray-300">
                            {/* REVISIÓN DE TEXTO: Ajustado a la realidad de la implementación (snapshots y audio monitoreado) */}
                            Tu cámara y pantalla están activas. El audio es monitoreado. No cierres esta pestaña.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-8">

                        {/* REFINAMIENTO UX: Reglas Claras, nuevo título formal */}
                        <div className="p-4 rounded-lg text-left text-sm border border-yellow-300 bg-yellow-50 text-yellow-800">
                            {/* REVISIÓN DE TEXTO */}
                            <p className="font-bold flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4"/> REQUERIMIENTOS DE MONITOREO:</p>
                            <ul className="list-disc list-inside space-y-1 ml-1">
                                <li>Mantén la pantalla completa (<code className="bg-yellow-100 px-1 rounded font-mono text-xs text-yellow-900">{fullscreenKey}</code>).</li>
                                <li>No cambies de pestaña, ni minimices la ventana.</li>
                                <li>Mantente siempre visible y sin ayuda externa.</li>
                            </ul>
                        </div>

                        <div className="space-y-4">
                            {/* REFINAMIENTO UI: Botón con degradado (usando clases de Tailwind o estilos inyectados si es necesario) */}
                            {/* Usamos el gradiente inyectando clases de bg-gradient-to-r para el efecto deseado */}
                            <Button 
                                className="w-full h-12 text-lg font-bold shadow-md transition-colors text-white 
                                           bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600"
                                onClick={() => window.open('https://ugm.blackboard.com/?new_loc=%2Fultra%2Fcourse', '_blank')}
                            >
                                <ExternalLink className="mr-2 h-5 w-5" />
                                Abrir Plataforma de Examen (Blackboard)
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                * Se abrirá en una nueva pestaña. **No cierres** esta ventana de monitoreo.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-gray-100 rounded-b-lg border-t p-6">
                         {/* MEJORA UX: Botón de finalizar siempre en rojo (advertencia) */}
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full h-10 shadow-lg" disabled={isFinishing}>
                                    {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Terminé mi examen / Finalizar Monitoreo
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
                <Loader2 className="h-10 w-10 animate-spin text-[#161F45] mx-auto mb-4"/>
                <p className="text-muted-foreground font-semibold">Cargando la interfaz de verificación...</p>
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