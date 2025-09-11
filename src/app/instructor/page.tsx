
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/instructor/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentCard } from '@/components/instructor/student-card';
import { Users, Clock, AlertTriangle, CheckCircle, FileDown, WifiOff, PlusCircle, Phone, Loader2, Volume2, Info, XCircle, BarChart2, MessageSquareWarning, Bell, History, HelpCircle, BookOpen, LogOut } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from '@/components/ui/skeleton';
import type { StudentSession, Alert as AlertType } from '@/services/live-session.service';
import { UserNav } from '@/components/instructor/user-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { PortalLogo } from '@/components/portal-logo';
import { useToast } from "@/hooks/use-toast";
import { AlertChart, getChartData as getAlertChartData } from '@/components/instructor/alert-chart';
import { CompletionTimeChart, getChartData as getCompletionChartData } from '@/components/instructor/completion-time-chart';
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
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Layers } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

export interface FormattedAlert {
  id: string;
  time: string;
  timestamp: number;
  severity: 'critical' | 'warning' | 'info';
  studentId: string;
  studentName: string;
  description: string;
}

const AlertList = ({ alerts, noAlertsMessage = "No hay alertas que mostrar." }: { alerts: FormattedAlert[], noAlertsMessage?: string }) => {
    if (alerts.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                <p>{noAlertsMessage}</p>
            </div>
        );
    }

    const getAlertIcon = (alert: FormattedAlert) => {
        if (alert.description.startsWith('Solicitud de Ayuda')) {
            return <Phone className="h-5 w-5 text-destructive animate-pulse" />;
        }
        if (alert.description === 'Sonido sospechoso detectado') {
            return <Volume2 className="h-5 w-5 text-accent" />;
        }
        
        switch (alert.severity) {
            case 'critical':
                return <AlertTriangle className="h-5 w-5 text-destructive" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-accent" />;
            case 'info':
                return <Info className="h-5 w-5 text-primary" />;
            default:
                return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
        }
    };

    return (
        <ul className="space-y-2 h-64 overflow-y-auto pr-2">
            {alerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-3 p-2 rounded-md border text-sm hover:bg-secondary cursor-pointer">
                    <div className="flex-shrink-0 w-6 flex items-center justify-center pt-1">
                        {getAlertIcon(alert)}
                    </div>
                    <div className="flex-1">
                      <span className="font-mono text-xs text-muted-foreground">{alert.time}</span>
                      <p className="whitespace-pre-wrap"><span className="font-semibold">{alert.studentName}</span> - {alert.description}</p>
                    </div>
                </li>
            ))}
        </ul>
    );
};

export default function InstructorDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [liveStudents, setLiveStudents] = useState<StudentSession[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<FormattedAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const notifiedAlertsRef = useRef(new Set<string>());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingStats, setIsDownloadingStats] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionFinishTime, setSessionFinishTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const [isStoppingSession, setIsStoppingSession] = useState(false);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState('');
  const [isSendingBulkMessage, setIsSendingBulkMessage] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('');
  const [duration, setDuration] = useState<number | ''>(60);
  const [accessCode, setAccessCode] = useState('');
  const [isCreatingExam, setIsCreatingExam] = useState(false);

  const playSound = useCallback(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }, []);

  const handleStopAllSessions = async () => {
    if (!currentExamId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se puede finalizar la sesión sin un ID de examen.' });
        return;
    }
    
    setIsStoppingSession(true);

    try {
        const response = await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'TERMINATE_ALL_SESSIONS', 
                payload: { 
                    examId: currentExamId,
                } 
            })
        });

        if (!response.ok) {
            throw new Error('No se pudo finalizar la sesión.');
        }

        toast({
            title: "Sesión Finalizada",
            description: "La sesión de monitoreo ha terminado. El panel se reiniciará."
        });

        setSessionFinishTime(Date.now());
        
        setTimeout(() => window.location.reload(), 3000);

    } catch (error) {
        console.error("Error stopping all sessions:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Ocurrió un problema al finalizar la sesión.'
        });
        setIsStoppingSession(false);
    }
  };

  const handleDownloadLiveReport = () => {
    setIsDownloading(true);
    if (liveAlerts.length === 0) {
      toast({
        title: "Sin Alertas",
        description: "No hay alertas en vivo para exportar.",
      });
      setIsDownloading(false);
      return;
    }

    try {
        const csvRows: string[][] = [
          ['Hora', 'Estudiante', 'ID Estudiante', 'Severidad', 'Descripción']
        ];

        liveAlerts.forEach(alert => {
          csvRows.push([
            `"${alert.time}"`,
            `"${alert.studentName}"`,
            `"${alert.studentId}"`,
            `"${alert.severity}"`,
            `"${alert.description.replace(/"/g, '""')}"`
          ]);
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const date = new Date().toISOString().slice(0, 10);
        link.setAttribute("download", `reporte_vivo_alertas_${date}.csv`);
        document.body.appendChild(link);
        
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Reporte en Vivo Generado",
          description: "La descarga de tu reporte CSV ha comenzado.",
        });
    } catch (error) {
        console.error("Error downloading live report:", error);
        toast({
            variant: "destructive",
            title: "Error al Descargar",
            description: "No se pudo generar el reporte en vivo.",
        });
    } finally {
        setIsDownloading(false);
    }
  };

  const handleDownloadStatsReport = () => {
    setIsDownloadingStats(true);
    try {
        const alertData = getAlertChartData(liveAlerts);
        const completionData = getCompletionChartData(liveStudents);
        
        let csvContent = "Estadisticas de Alertas\n";
        csvContent += "Tipo de Alerta,Cantidad,Porcentaje\n";
        alertData.chartData.forEach(item => {
            csvContent += `"${item.name}",${item.count},${item.percentage}%\n`;
        });
        csvContent += `Total de Alertas,${alertData.totalAlerts}\n\n`;

        csvContent += "Estadisticas de Tiempos de Finalizacion (minutos)\n";
        csvContent += "Estudiante,Duracion\n";
        completionData.chartData.forEach(item => {
            csvContent += `"${item.name}",${item.duration}\n`;
        });
        csvContent += `\nPromedio,${completionData.stats.average}\n`;
        csvContent += `Mas Rapido,${completionData.stats.fastest}\n`;
        csvContent += `Mas Lento,${completionData.stats.slowest}\n`;

        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const date = new Date().toISOString().slice(0, 10);
        link.setAttribute("download", `reporte_vivo_estadisticas_${date}.csv`);
        document.body.appendChild(link);
        
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Reporte de Estadísticas Generado",
          description: "La descarga de tu reporte CSV ha comenzado.",
        });
    } catch (error) {
        console.error("Error downloading stats report:", error);
        toast({
            variant: "destructive",
            title: "Error al Descargar",
            description: "No se pudo generar el reporte de estadísticas.",
        });
    } finally {
        setIsDownloadingStats(false);
    }
  };

    const handleSendBulkMessage = async () => {
        if (!bulkMessage.trim()) return;
        setIsSendingBulkMessage(true);
        try {
            const response = await fetch('/api/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'SEND_BULK_MESSAGE',
                    payload: { message: bulkMessage.trim() }
                })
            });
            if (!response.ok) throw new Error('Falló el envío del mensaje masivo.');
            toast({ title: 'Éxito', description: 'El anuncio ha sido enviado a todos los estudiantes activos.' });
            setBulkMessage('');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el anuncio.' });
            console.error(error);
        } finally {
            setIsSendingBulkMessage(false);
        }
    };

    const generateAccessCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const handleOpenConfigModal = () => {
        setExamTitle('');
        setSubject('');
        setSection('');
        setDuration(60);
        setAccessCode(generateAccessCode());
        setIsConfigModalOpen(true);
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(accessCode);
        toast({
            title: "Código Copiado",
            description: "El código de acceso ha sido copiado al portapapeles.",
        });
    };

    const handleCreateExam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !examTitle || !subject || !section || !duration) return;

        setIsCreatingExam(true);
        try {
            const examSessionData = {
                title: examTitle,
                subject,
                section,
                duration,
                accessCode,
                instructorId: user.uid,
                students: [],
                createdAt: serverTimestamp(),
                status: 'pending'
            };

            await addDoc(collection(db, "examSessions"), examSessionData);

            toast({
                title: "Sala de Examen Creada",
                description: `La sala para "${examTitle}" está lista. El panel se actualizará automáticamente.`,
            });
            
            setIsConfigModalOpen(false);
            // Limpiar formulario
            setExamTitle('');
            setSubject('');
            setSection('');
            setDuration(60);
            setAccessCode('');

        } catch (error) {
            console.error("Error creating exam session: ", error);
            toast({
                variant: "destructive",
                title: "Error al crear la sala",
                description: "No se pudo guardar la configuración del examen en la base de datos.",
            });
        } finally {
            setIsCreatingExam(false);
        }
    };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/live', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('La conexión con el servidor de monitoreo falló.');
        }
        const data = await response.json();
        const students: StudentSession[] = data.students || [];
        const alerts: AlertType[] = data.alerts || [];

        alerts.forEach((alert) => {
          if (
            alert.description.startsWith('Solicitud de Ayuda:') &&
            !notifiedAlertsRef.current.has(alert.id)
          ) {
            const studentName = alert.studentName || 'Un estudiante';
            toast({
              variant: 'destructive',
              title: "¡Solicitud de Ayuda Urgente!",
              description: `${studentName} necesita soporte: "${alert.description.substring('Solicitud de Ayuda:'.length).trim()}"`,
              duration: 20000,
            });
            playSound();
            notifiedAlertsRef.current.add(alert.id);
          }
        });

        const activeStudentList = students.filter(s => s.status !== 'finished');

        if(activeStudentList.length > 0 && !isSessionStarted) {
            setIsSessionStarted(true);
            const firstStudent = activeStudentList[0];
            if (firstStudent.examId && !currentExamId) {
                setCurrentExamId(firstStudent.examId);
            }
        }
        
        if (activeStudentList.length > 0 && !sessionStartTime) {
            const firstStudentStartTime = activeStudentList
                .map(s => s.startTime)
                .filter(Boolean)
                .sort((a, b) => a! - b!)[0];
            if (firstStudentStartTime) {
                setSessionStartTime(firstStudentStartTime);
                setSessionFinishTime(null);
            }
        }
        
        setLiveStudents(students);
        
        const formattedAlerts = alerts.map((a: AlertType) => ({
            id: a.id,
            studentId: a.studentId,
            studentName: a.studentName,
            description: a.description,
            severity: a.severity,
            time: new Date(a.timestamp).toLocaleTimeString('es-CL'),
            timestamp: a.timestamp,
        })).sort((a, b) => b.timestamp - a.timestamp);

        setLiveAlerts(formattedAlerts);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        console.error(err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);

    return () => clearInterval(interval);
  }, [toast, playSound, sessionStartTime, isSessionStarted, sessionFinishTime, currentExamId]);
  
  useEffect(() => {
    if (!sessionStartTime) {
        setElapsedTime("00:00");
        return;
    }

    if (sessionFinishTime) {
        const diffInSeconds = Math.floor((sessionFinishTime - sessionStartTime) / 1000);
        const hours = Math.floor(diffInSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((diffInSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (diffInSeconds % 60).toString().padStart(2, '0');
        const finalTime = parseInt(hours) > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
        setElapsedTime(finalTime);
        return;
    }

    const timerInterval = setInterval(() => {
        const diffInSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
        const hours = Math.floor(diffInSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((diffInSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (diffInSeconds % 60).toString().padStart(2, '0');

        if (parseInt(hours) > 0) {
            setElapsedTime(`${hours}:${minutes}:${seconds}`);
        } else {
            setElapsedTime(`${minutes}:${seconds}`);
        }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [sessionStartTime, sessionFinishTime]);

  if (loading) {
    return (
        <div className="flex justify-center items-center h-screen bg-section">
          <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
        </div>
    );
  }

  if (!user) {
    return null;
  }
  
  const activeStudents = liveStudents.filter(s => s.status !== 'finished');
  
  const isSessionEverStarted = isSessionStarted || liveStudents.some(s => s.status === 'finished');

  const sortedActiveStudents = [...activeStudents].sort((a, b) => {
    const lastAlertTimestampA = a.alerts?.[0]?.timestamp ?? 0;
    const lastAlertTimestampB = b.alerts?.[0]?.timestamp ?? 0;

    if (lastAlertTimestampA !== lastAlertTimestampB) {
        return lastAlertTimestampB - lastAlertTimestampA;
    }
    
    return a.name.localeCompare(b.name);
  });
  
  const studentsWithAlerts = liveStudents.filter(s => s.status === 'alert');
  const finishedStudents = liveStudents.filter(s => s.status === 'finished');
  const criticalAlerts = liveAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = liveAlerts.filter(a => a.severity === 'warning');

  return (
    <div className="min-h-screen bg-section">
        <header style={{ backgroundColor: "#161F45" }} className="border-b border-white/20">
             <div className="container mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Image
                            src="/Logo lineas.png"
                            alt="Universidad Gabriela Mistral"
                            width={120}
                            height={40}
                            className="object-contain"
                        />
                        <div>
                          <h1 className="text-xl font-bold text-white">
                            <span className="text-[#00d4ff]">Procto</span>
                            <span className="text-white">Team</span>
                          </h1>
                          <p className="text-xs text-white/70">Panel de Vigilancia</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                                <WifiOff className="h-4 w-4" />
                                <span>{error}</span>
                            </div>
                        )}
                        
                        {/* Switch de tema */}
                        <ThemeToggle />

                        {/* Nombre del usuario */}
                        <span className="text-white text-sm font-medium">
                            {userProfile?.nombre || "Instructor"}
                        </span>


                        {/* Botón de cerrar sesión */}
                        <Button
                            className="bg-[#242F62] hover:bg-[#1a1d47] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium border-0"
                            onClick={async () => {
                                const { signOut } = await import("firebase/auth");
                                const { auth } = await import("@/lib/firebase");
                                await signOut(auth);
                                router.push("/");
                            }}
                        >
                            <LogOut className="w-4 h-4" />
                            Salir
                        </Button>
                    </div>
                </div>
            </div>
        </header>

        <main className="container mx-auto px-6 py-8 space-y-6">
            <div className="flex justify-between items-center gap-2 mb-4">
               {isSessionEverStarted ? (
                    <div className="flex items-center gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isStoppingSession}>
                                    {isStoppingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                    Detener Monitoreo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro de que quieres finalizar la sesión?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción finalizará el examen para todos los estudiantes activos y no se puede deshacer. ¿Deseas descargar los reportes antes de finalizar?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleStopAllSessions} disabled={isStoppingSession} className="bg-destructive hover:bg-destructive/90">
                                        {isStoppingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Finalizar sin Descargar
                                    </AlertDialogAction>
                                    <AlertDialogAction onClick={() => {
                                        handleDownloadLiveReport();
                                        handleDownloadStatsReport();
                                        handleStopAllSessions();
                                    }} disabled={isStoppingSession} className="bg-[#00d4ff] hover:bg-[#00b8e6] text-[#1a1d47]">
                                        {isStoppingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Descargar y Finalizar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" disabled={!isSessionEverStarted} className="border-border text-foreground hover:bg-muted dark:border-white/30 dark:text-white dark:hover:bg-white/10">
                                    <MessageSquareWarning className="mr-2 h-4 w-4" />
                                    Enviar Anuncio a Todos
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Enviar Anuncio Masivo</DialogTitle>
                                    <DialogDescription>
                                        Este mensaje será enviado como una notificación a todos los estudiantes activos en la sesión.
                                    </DialogDescription>
                                </DialogHeader>
                                <Textarea 
                                    value={bulkMessage}
                                    onChange={(e) => setBulkMessage(e.target.value)}
                                    placeholder="Ej: Recuerden que quedan 15 minutos de examen."
                                    rows={3}
                                />
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                    <Button onClick={handleSendBulkMessage} disabled={isSendingBulkMessage || !bulkMessage.trim()}>
                                        {isSendingBulkMessage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enviar Anuncio
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                            <DialogTrigger asChild>
                                <Button 
                                    className="bg-card hover:bg-muted/50 text-foreground border border-border"
                                    onClick={handleOpenConfigModal}
                                >
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Empezar Monitoreo
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl">
                                <form onSubmit={handleCreateExam}>
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2 text-[#515774] dark:text-white">
                                            <Layers className="h-6 w-6 text-primary" />
                                            Nueva Sala de Monitoreo
                                        </DialogTitle>
                                        <DialogDescription className="dark:text-gray-300">
                                            Define los detalles del examen para generar una sala de monitoreo única para tus estudiantes.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-6 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="modal-exam-title" className="text-[#515774] dark:text-white font-medium">
                                                Título del Examen
                                            </Label>
                                            <Input
                                                id="modal-exam-title"
                                                value={examTitle}
                                                onChange={(e) => setExamTitle(e.target.value)}
                                                placeholder="Ej: Examen Final de Matemáticas"
                                                required
                                                className="bg-gray-50 border-[#CCCFDD] text-[#515774] focus:border-[#00d4ff] focus:ring-[#00d4ff]"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="modal-subject" className="text-[#515774] dark:text-white font-medium">
                                                    Asignatura
                                                </Label>
                                                <Input
                                                    id="modal-subject"
                                                    value={subject}
                                                    onChange={(e) => setSubject(e.target.value)}
                                                    placeholder="Ej: Matemáticas"
                                                    required
                                                    className="bg-gray-50 border-[#CCCFDD] text-[#515774] focus:border-[#00d4ff] focus:ring-[#00d4ff]"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="modal-section" className="text-[#515774] dark:text-white font-medium">
                                                    Sección
                                                </Label>
                                                <Input
                                                    id="modal-section"
                                                    value={section}
                                                    onChange={(e) => setSection(e.target.value)}
                                                    placeholder="Ej: A-01"
                                                    required
                                                    className="bg-gray-50 border-[#CCCFDD] text-[#515774] focus:border-[#00d4ff] focus:ring-[#00d4ff]"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="modal-duration" className="text-[#515774] dark:text-white font-medium">
                                                Duración (minutos)
                                            </Label>
                                            <Input
                                                id="modal-duration"
                                                type="number"
                                                value={duration}
                                                onChange={(e) => setDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                                required
                                                min="10"
                                                max="240"
                                                className="bg-gray-50 border-[#CCCFDD] text-[#515774] focus:border-[#00d4ff] focus:ring-[#00d4ff]"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="modal-access-code" className="text-[#515774] dark:text-white font-medium">
                                                Código de Acceso para Estudiantes
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    id="modal-access-code"
                                                    value={accessCode}
                                                    readOnly
                                                    className="font-mono text-lg bg-muted border-[#CCCFDD] text-[#515774]"
                                                />
                                                <Button type="button" variant="ghost" size="icon" onClick={handleCopyCode} aria-label="Copiar código">
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground dark:text-gray-300">
                                                Los estudiantes usarán este código para unirse a la sesión de monitoreo correcta.
                                            </p>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="ghost" type="button">Cancelar</Button>
                                        </DialogClose>
                                        <Button 
                                            type="submit" 
                                            disabled={isCreatingExam || !examTitle || !subject || !section || !duration}
                                            className="bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold"
                                        >
                                            {isCreatingExam ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Creando...
                                                </>
                                            ) : (
                                                <>
                                                    <PlusCircle className="mr-2 h-4 w-4" />
                                                    Crear Sala
                                                </>
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                        <Button asChild className="bg-card hover:bg-muted/50 text-foreground border border-border">
                            <Link href="/instructor/live-monitor">
                                <Users className="mr-2 h-4 w-4" />
                                Monitor en vivo
                            </Link>
                        </Button>
                        <Button asChild className="bg-card hover:bg-muted/50 text-foreground border border-border">
                            <Link href="/instructor/historic">
                                <History className="mr-2 h-4 w-4" />
                                Histórico
                            </Link>
                        </Button>
                    </div>
                )}
                
                {/* Bot\u00f3n de Ayuda - siempre visible del lado derecho */}
                <Button
                    className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 text-sm font-semibold"
                    onClick={() => router.push("/instructor/help")}
                >
                    <HelpCircle className="w-4 h-4" />
                    Ayuda
                </Button>
            </div>

            <section>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card style={{ backgroundColor: "#00BBFF" }} className="backdrop-blur-md border border-white/20 text-white shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-white">Estudiantes Activos</CardTitle>
                            <Users className="h-4 w-4 text-white" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{activeStudents.length}</div>
                            <p className="text-xs text-white/80">Estudiantes en línea</p>
                        </CardContent>
                    </Card>
                    <Card style={{ backgroundColor: "#0095FF" }} className="backdrop-blur-md border border-white/20 text-white shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-white">Tiempo de Monitoreo</CardTitle>
                            <Clock className="h-4 w-4 text-white" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{elapsedTime}</div>
                             <p className="text-xs text-white/70">{sessionFinishTime ? "Sesión finalizada" : (isSessionStarted ? "Sesión en progreso" : "Esperando inicio")}</p>
                        </CardContent>
                    </Card>
                     <Card style={{ backgroundColor: "#4F5CC0" }} className="backdrop-blur-md border border-white/20 text-white shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-white">Estudiantes Finalizados</CardTitle>
                            <CheckCircle className="h-4 w-4 text-white" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{finishedStudents.length}</div>
                             <p className="text-xs text-white/80">de {liveStudents.length} en total</p>
                        </CardContent>
                    </Card>
                    <Card style={{ backgroundColor: "#394281" }} className="backdrop-blur-md border border-white/20 text-white shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-white">Estudiantes con Alertas</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-white" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{studentsWithAlerts.length}</div>
                            <p className="text-xs text-white/70">{liveAlerts.length} alertas totales</p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section>
                <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3"]} className="w-full rounded-lg overflow-hidden shadow-lg bg-panel">
                    <AccordionItem value="item-1" className="border-b border-border">
                        <AccordionTrigger className="text-xl font-bold px-6 py-4 hover:bg-container transition-colors text-foreground">
                            Estadísticas de la Sesión
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <AlertChart alerts={liveAlerts} />
                                <CompletionTimeChart students={liveStudents} />
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2" className="border-b border-border">
                        <AccordionTrigger className="text-xl font-bold px-6 py-4 hover:bg-container transition-colors text-foreground">Monitor de Estudiantes</AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                           {activeStudents.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {sortedActiveStudents.map(student => (
                                        <StudentCard key={student.id} student={student} />
                                    ))}
                                </div>
                           ) : (
                                <div className="text-center py-10" style={{ color: "#242F62" }}>
                                    <p>Esperando a que los estudiantes comiencen la sesión de monitoreo...</p>
                                </div>
                           )}
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3" className="border-b-0">
                        <AccordionTrigger className="text-xl font-bold px-6 py-4 hover:bg-container transition-colors text-foreground">Panel de Alertas</AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                           <Card className="bg-card border border-border shadow-lg rounded-lg">
                                <Tabs defaultValue="all">
                                    <CardHeader>
                                        <div className="flex items-center justify-between flex-wrap gap-4">
                                            <TabsList className="bg-muted rounded-lg">
                                                <TabsTrigger value="all" className="text-foreground">Todos</TabsTrigger>
                                                <TabsTrigger value="critical" className="text-foreground">Críticas</TabsTrigger>
                                                <TabsTrigger value="warning" className="text-foreground">Advertencias</TabsTrigger>
                                            </TabsList>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" onClick={handleDownloadLiveReport} disabled={isDownloading} className="border-border rounded-lg bg-card text-foreground hover:bg-card/80">
                                                    {isDownloading ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <FileDown className="mr-2 h-4 w-4" />
                                                    )}
                                                    Exportar Alertas
                                                </Button>
                                                <Button variant="outline" onClick={handleDownloadStatsReport} disabled={isDownloadingStats} className="border-border rounded-lg bg-card text-foreground hover:bg-card/80">
                                                    {isDownloadingStats ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <BarChart2 className="mr-2 h-4 w-4" />
                                                    )}
                                                    Exportar Estadísticas
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <TabsContent value="all">
                                            <AlertList alerts={liveAlerts} />
                                        </TabsContent>
                                        <TabsContent value="critical">
                                            <AlertList alerts={criticalAlerts} noAlertsMessage="No hay alertas críticas que mostrar." />
                                        </TabsContent>
                                        <TabsContent value="warning">
                                            <AlertList alerts={warningAlerts} noAlertsMessage="No hay advertencias que mostrar." />
                                        </TabsContent>
                                    </CardContent>
                                </Tabs>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>
        </main>
    </div>
  );
}
