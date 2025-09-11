
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ExamHeader } from '@/components/student/exam-header';
import { ProctoringPanel } from '@/components/student/proctoring-panel';
import { ExamFooter } from '@/components/student/exam-footer';
import { RequirementsModal } from '@/components/student/requirements-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp, onSnapshot } from 'firebase/firestore';
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
    accessCode: string;
    instructorId: string;
    createdAt: Timestamp;
    status: 'pending' | 'active' | 'finished';
    blockedStudents?: { uid: string; reason: string; timestamp: Timestamp }[];
}

export default function StudentExamLivePage() {
  const { user, userProfile, loading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
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

  useEffect(() => {
    if (!examId || !user) return;
    
    const docRef = doc(db, 'examSessions', examId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if(docSnap.exists()){
            const data = docSnap.data() as ExamData;
            setExamData(data);
            
            if (isTerminated) return;

            const blockedInfo = data.blockedStudents?.find(s => s.uid === user.uid);
            
            if (blockedInfo) {
                setBlockReason(blockedInfo.reason || 'Razón desconocida.');
                setIsTerminated(true);
                setStep('finished');
                return;
            }

            if(data.status === 'finished') {
                setBlockReason('La sesión de examen ha sido finalizada por el instructor.');
                setIsTerminated(true);
                setStep('finished');
                return;
            }

        } else {
            console.error("No such document!");
            toast({
                variant: "destructive",
                title: "Examen no encontrado",
                description: "No se pudo encontrar la sesión del examen. Serás redirigido."
            });
            router.push('/student');
        }
    }, (error) => {
        console.error("Error listening to exam data:", error);
        toast({
            variant: "destructive",
            title: "Error de Conexión",
            description: "Se perdió la conexión con el servidor del examen."
        });
    });

    return () => unsubscribe();
  }, [examId, user, router, toast, isTerminated]);
  
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
                action: 'FINISH_STUDENT_SESSION',
                payload: { 
                    studentId: user.uid,
                    examId: examId,
                    studentName: userProfile?.nombre || 'Estudiante'
                }
            })
        });
        toast({
            title: 'Examen Finalizado',
            description: 'Tu sesión de monitoreo ha terminado. Gracias por tu participación.',
        });
        setIsTerminated(true);
        setStep('finished');
    } catch (error) {
        console.error("Error finishing exam:", error);
        toast({
            variant: "destructive",
            title: "Error al Finalizar",
            description: "No se pudo comunicar el fin del examen. Por favor, intenta de nuevo.",
        });
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
     if (blockReason) {
        return (
            <div className="flex flex-col min-h-screen bg-secondary items-center justify-center p-4">
              <Card className="shadow-lg border-destructive max-w-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-destructive flex items-center gap-2">
                        <XCircle /> Sesión Finalizada
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4 pt-6">
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Tu sesión de monitoreo ha terminado.</AlertTitle>
                        <AlertDescription>
                            Razón: {blockReason}
                        </AlertDescription>
                    </Alert>
                    <Button onClick={() => window.location.href = '/student'} className="w-full mt-4">
                        <LogOut className="mr-2 h-4 w-4" />
                        Volver al portal del estudiante
                    </Button>
                </CardContent>
            </Card>
          </div>
        );
     }
    return (
        <div className="flex flex-col min-h-screen bg-secondary items-center justify-center p-4">
             <Card className="shadow-lg border-green-500 max-w-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-green-600 flex items-center gap-2">
                        <CheckCircle /> ¡Examen Finalizado!
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4 pt-6">
                    <Alert variant="default" className="border-green-500">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <AlertTitle>Sesión de monitoreo terminada</AlertTitle>
                        <AlertDescription>
                           Has finalizado el examen exitosamente. Ya puedes cerrar esta ventana.
                        </AlertDescription>
                    </Alert>
                    <Button onClick={() => window.location.href = '/student'} className="w-full mt-4">
                        <LogOut className="mr-2 h-4 w-4" />
                        Volver al Portal del Estudiante
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!user || !userProfile) {
    return null; // AuthProvider handles redirect
  }

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
                <Card className="w-full max-w-2xl text-center shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline text-primary flex items-center justify-center gap-2">
                            <CheckCircle className="h-8 w-8" />
                            Monitoreo Activado
                        </CardTitle>
                        <CardDescription>
                            Tu sesión de monitoreo ha comenzado. Ahora puedes abrir tu examen.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>¡Instrucciones Importantes!</AlertTitle>
                            <AlertDescription>
                                <ol className="list-decimal list-inside space-y-2 text-left">
                                    <li className="font-semibold">
                                        Activa el modo de pantalla completa. Presiona la tecla <code className="font-mono p-1 bg-muted rounded">{fullscreenKey}</code>.
                                    </li>
                                    <li>Haz clic en el botón de abajo para abrir Blackboard en una <strong>nueva pestaña</strong>.</li>
                                    <li>Completa tu examen en esa nueva pestaña.</li>
                                    <li className="font-bold text-destructive">No cierres esta pestaña de monitoreo.</li>
                                    <li>El cambiar a otras pestañas o aplicaciones generará una alerta.</li>
                                </ol>
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                    <CardFooter className="flex-col gap-4">
                        <Button 
                            className="w-full"
                            onClick={() => window.open('https://ugm.blackboard.com/?new_loc=%2Fultra%2Fcourse', '_blank')}
                        >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Abrir Plataforma de Examen en Nueva Pestaña
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="w-full bg-green-600 hover:bg-green-700" disabled={isFinishing}>
                                    {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    He Terminado, Finalizar Monitoreo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro de que quieres finalizar?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción terminará tu sesión de monitoreo y no podrás volver a unirte. Asegúrate de haber enviado tu examen en la otra pestaña antes de confirmar.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleFinishExam} disabled={isFinishing} className="bg-green-600 hover:bg-green-700">
                                         {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Sí, he terminado
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                </Card>
            </div>
        ) : (
            <div className="w-full max-w-4xl mx-auto p-4">
                <Card className="shadow-lg animate-pulse">
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-[calc(100vh-300px)] w-full rounded-lg" />
                    </CardContent>
                </Card>
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
