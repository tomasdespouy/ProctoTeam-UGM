'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentCard } from '@/components/instructor/student-card';
import { Users, Clock, AlertTriangle, CheckCircle, WifiOff, PlusCircle, Phone, Loader2, Volume2, Info, XCircle, MessageSquareWarning, LogOut, Copy, Layers, LayoutGrid } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { StudentSession, Alert as AlertType } from '@/services/live-session.service';
import { ThemeToggle } from '@/components/theme-toggle';
import { useToast } from "@/hooks/use-toast";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';

// Interfaz para alertas formateadas
export interface FormattedAlert {
  id: string;
  time: string;
  timestamp: number;
  severity: 'critical' | 'warning' | 'info';
  studentId: string;
  studentName: string;
  description: string;
}

// Componente de Lista de Alertas
const AlertList = ({ alerts, noAlertsMessage = "No hay alertas que mostrar." }: { alerts: FormattedAlert[], noAlertsMessage?: string }) => {
    if (alerts.length === 0) {
        return <div className="text-center py-10 text-muted-foreground"><p>{noAlertsMessage}</p></div>;
    }

    const getAlertIcon = (alert: FormattedAlert) => {
        if (alert.description.startsWith('Solicitud de Ayuda')) return <Phone className="h-5 w-5 text-destructive animate-pulse" />;
        if (alert.description === 'Sonido sospechoso detectado') return <Volume2 className="h-5 w-5 text-accent" />;
        switch (alert.severity) {
            case 'critical': return <AlertTriangle className="h-5 w-5 text-destructive" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-accent" />;
            case 'info': return <Info className="h-5 w-5 text-primary" />;
            default: return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
        }
    };

    return (
        <ul className="space-y-2 h-64 overflow-y-auto pr-2">
            {alerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-3 p-2 rounded-md border text-sm hover:bg-secondary cursor-pointer">
                    <div className="flex-shrink-0 w-6 flex items-center justify-center pt-1">{getAlertIcon(alert)}</div>
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

  // Estado
  const [liveStudents, setLiveStudents] = useState<StudentSession[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<FormattedAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const notifiedAlertsRef = useRef(new Set<string>());

  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionFinishTime, setSessionFinishTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const [isStoppingSession, setIsStoppingSession] = useState(false);

  // ID del examen actual
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [currentExamCode, setCurrentExamCode] = useState<string | null>(null);

  const [bulkMessage, setBulkMessage] = useState('');
  const [isSendingBulkMessage, setIsSendingBulkMessage] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Formulario Crear Examen
  const [examTitle, setExamTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('');
  const [duration, setDuration] = useState<number | ''>(60);
  const [accessCode, setAccessCode] = useState('');
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Sonido de notificación
  const playSound = useCallback(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
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

  // Simulación de chequeo inicial
  useEffect(() => { setIsCheckingSession(false); }, []);

  // Finalizar sesión global
  const handleStopAllSessions = async () => {
    if (!currentExamId) return;
    setIsStoppingSession(true);
    try {
        const response = await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'TERMINATE_ALL_SESSIONS', payload: { examId: currentExamId } })
        });
        if (!response.ok) throw new Error('Error al finalizar.');
        toast({ title: "Sesión Finalizada", description: "El examen ha sido cerrado." });
        setSessionFinishTime(Date.now());
        setTimeout(() => {
            setCurrentExamId(null); setCurrentExamCode(null); setLiveStudents([]); setLiveAlerts([]); setIsStoppingSession(false);
        }, 2000);
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Problema al finalizar sesión.' });
        setIsStoppingSession(false);
    }
  };

  // POLLING INTELIGENTE
  useEffect(() => {
    if (!currentExamId) return;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/live?examId=${currentExamId}`, { cache: 'no-store' });

        if (!response.ok) {
            if (response.status === 400) throw new Error('ID de examen inválido');
            throw new Error('Conexión perdida');
        }

        const data = await response.json();
        const students: StudentSession[] = data.students || [];
        const alerts: AlertType[] = data.alerts || [];

        // Notificar alertas nuevas
        alerts.forEach((alert) => {
          if (alert.description.startsWith('Solicitud de Ayuda:') && !notifiedAlertsRef.current.has(alert.id)) {
            toast({ variant: 'destructive', title: "¡Ayuda Solicitada!", description: `${alert.studentName}: ${alert.description}`, duration: 20000 });
            playSound();
            notifiedAlertsRef.current.add(alert.id);
          }
        });

        // Configurar tiempo
        if (students.length > 0 && !sessionStartTime) {
             const firstStart = students.map(s => new Date(s.startedAt).getTime()).filter(t => !isNaN(t)).sort((a, b) => a - b)[0];
             if (firstStart) setSessionStartTime(firstStart);
        }

        setLiveStudents(students);

        const formattedAlerts = alerts.map((a: AlertType) => ({
            id: a.id,
            studentId: a.studentId,
            studentName: a.studentName || 'Estudiante',
            description: a.description,
            severity: a.severity,
            time: new Date(a.timestamp).toLocaleTimeString('es-CL'),
            timestamp: new Date(a.timestamp).getTime(),
        })).sort((a, b) => b.timestamp - a.timestamp);

        setLiveAlerts(formattedAlerts);
        setError(null);
      } catch (err: any) { setError(err.message); }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [currentExamId, toast, playSound, sessionStartTime]);

  // Timer UI
  useEffect(() => {
    if (!sessionStartTime || !currentExamId) { setElapsedTime("00:00"); return; }
    const timerInterval = setInterval(() => {
        const now = Date.now();
        const end = sessionFinishTime || now;
        const diff = Math.max(0, Math.floor((end - sessionStartTime) / 1000));
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(parseInt(h) > 0 ? `${h}:${m}:${s}` : `${m}:${s}`);
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [sessionStartTime, sessionFinishTime, currentExamId]);

  const generateAccessCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
  };

  const handleOpenConfigModal = () => {
        setExamTitle(''); setSubject(''); setSection(''); setDuration(60);
        setAccessCode(generateAccessCode());
        setIsConfigModalOpen(true);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsCreatingExam(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/exam-sessions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ title: examTitle, subject, section, duration, accessCode }),
            });

            if (!response.ok) throw new Error('Error al crear la sesión');

            const data = await response.json();
            setCurrentExamId(data.id); 
            setCurrentExamCode(data.accessCode);

            toast({ title: "Sala Creada", description: "El monitoreo comenzará automáticamente." });
            setIsConfigModalOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo crear el examen." });
        } finally { setIsCreatingExam(false); }
  };

  const handleSendBulkMessage = async () => {
      if (!currentExamId || !bulkMessage.trim()) return;
      setIsSendingBulkMessage(true);
      try {
          await fetch('/api/live', {
              method: 'POST',
              body: JSON.stringify({ action: 'SEND_BULK_MESSAGE', payload: { examId: currentExamId, message: bulkMessage.trim() } })
          });
          toast({ title: 'Enviado', description: 'Mensaje enviado a todos.' });
          setBulkMessage('');
      } catch (e) { toast({ variant: 'destructive', title: 'Error', description: 'Fallo el envío.' }); }
      finally { setIsSendingBulkMessage(false); }
  };

  if (loading || isCheckingSession) return <div className="flex justify-center items-center h-screen bg-[#161F45]"><Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" /></div>;
  if (!user) return null;

  const activeStudents = liveStudents.filter(s => s.status !== 'submitted' && s.status !== 'blocked');
  const finishedStudents = liveStudents.filter(s => s.status === 'submitted' || s.status === 'blocked');
  const criticalAlerts = liveAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = liveAlerts.filter(a => a.severity === 'warning');

  return (
    <div className="min-h-screen bg-section">
        <header style={{ backgroundColor: "#161F45" }} className="border-b border-white/20">
             <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Image src="/Logo lineas.png" alt="UGM" width={120} height={40} className="object-contain" />
                    <div>
                      <h1 className="text-xl font-bold text-white"><span className="text-[#00d4ff]">Procto</span>Team</h1>
                      {currentExamCode && <span className="text-xs bg-[#00d4ff] text-[#161F45] px-2 py-0.5 rounded font-bold ml-2">CÓDIGO: {currentExamCode}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {error && <span className="text-red-400 text-sm flex gap-1 items-center"><WifiOff className="w-4"/> {error}</span>}
                    <ThemeToggle />
                    <span className="text-white text-sm hidden md:block">{userProfile?.nombre}</span>
                    <Button variant="ghost" className="text-white hover:bg-white/10" onClick={async () => { 
                        const { signOut } = await import("@/lib/azure-auth"); await signOut(); router.push("/"); 
                    }}><LogOut className="w-4 h-4 mr-2"/>Salir</Button>
                </div>
            </div>
        </header>

        <main className="container mx-auto px-6 py-8 space-y-6">
            <div className="flex justify-between items-center gap-2 mb-4">
               {currentExamId ? (
                    <div className="flex items-center gap-2">
                         <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded border border-green-500/20 text-sm font-bold flex items-center animate-pulse">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            Monitoreando: {examTitle || "Examen Activo"}
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isStoppingSession}>
                                    {isStoppingSession ? <Loader2 className="mr-2 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>} Detener
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Finalizar Examen</AlertDialogTitle><AlertDialogDescription>Esto cerrará la sesión para todos.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleStopAllSessions} className="bg-destructive">Finalizar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                         <Dialog>
                            <DialogTrigger asChild><Button variant="outline"><MessageSquareWarning className="mr-2 h-4 w-4"/> Anuncio</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Enviar Anuncio</DialogTitle></DialogHeader>
                                <Textarea value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} placeholder="Mensaje para todos..." />
                                <DialogFooter><Button onClick={handleSendBulkMessage} disabled={isSendingBulkMessage}>Enviar</Button></DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* BOTÓN AL MONITOR MASIVO */}
                        <Button 
                            variant="outline" 
                            className="bg-[#161F45] text-white hover:bg-[#161F45]/90 border-[#00d4ff]"
                            onClick={() => router.push(`/instructor/live-monitor?examId=${currentExamId}`)}
                        >
                            <LayoutGrid className="mr-2 h-4 w-4 text-[#00d4ff]"/> Monitor Masivo
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 w-full justify-center py-10 flex-col">
                        <div className="text-center mb-4">
                            <h2 className="text-2xl font-bold text-white mb-2">Bienvenido al Panel de Control</h2>
                            <p className="text-gray-400">No tienes ninguna sesión activa. Crea una para comenzar.</p>
                        </div>
                        <div className="flex gap-4">
                            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-[#00d4ff] hover:bg-[#00b8e6] text-[#161F45] text-lg px-8 py-6" onClick={handleOpenConfigModal}>
                                        <PlusCircle className="mr-2 h-6 w-6" /> Crear Nueva Sala
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <form onSubmit={handleCreateExam}>
                                        <DialogHeader><DialogTitle>Configurar Examen</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2"><Label>Título</Label><Input value={examTitle} onChange={e=>setExamTitle(e.target.value)} required/></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2"><Label>Asignatura</Label><Input value={subject} onChange={e=>setSubject(e.target.value)} required/></div>
                                                <div className="space-y-2"><Label>Sección</Label><Input value={section} onChange={e=>setSection(e.target.value)} required/></div>
                                            </div>
                                            <div className="space-y-2"><Label>Duración (min)</Label><Input type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))} required/></div>
                                            <div className="space-y-2"><Label>Código</Label><div className="flex gap-2"><Input value={accessCode} readOnly className="font-mono bg-muted"/><Button type="button" size="icon" variant="ghost" onClick={()=>{navigator.clipboard.writeText(accessCode)}}><Copy className="h-4 w-4"/></Button></div></div>
                                        </div>
                                        <DialogFooter><Button type="submit" disabled={isCreatingExam}>{isCreatingExam && <Loader2 className="mr-2 animate-spin"/>} Crear</Button></DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-6" onClick={() => router.push("/instructor/historic")}>
                                <Layers className="mr-2 h-6 w-6" /> Ver Histórico
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {currentExamId && (
                <>
                <section>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card style={{ backgroundColor: "#00BBFF" }} className="backdrop-blur-md border border-white/20 text-white shadow-lg">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-white">Activos</CardTitle><Users className="h-4 w-4 text-white" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-white">{activeStudents.length}</div></CardContent>
                        </Card>
                        <Card style={{ backgroundColor: "#0095FF" }} className="backdrop-blur-md border border-white/20 text-white shadow-lg">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-white">Tiempo</CardTitle><Clock className="h-4 w-4 text-white" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-white">{elapsedTime}</div></CardContent>
                        </Card>
                        <Card style={{ backgroundColor: "#4F5CC0" }} className="backdrop-blur-md border border-white/20 text-white shadow-lg">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-white">Finalizados</CardTitle><CheckCircle className="h-4 w-4 text-white" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-white">{finishedStudents.length}</div></CardContent>
                        </Card>
                         <Card style={{ backgroundColor: "#394281" }} className="backdrop-blur-md border border-white/20 text-white shadow-lg">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-white">Alertas</CardTitle><AlertTriangle className="h-4 w-4 text-white" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-white">{liveAlerts.length}</div></CardContent>
                        </Card>
                    </div>
                </section>
                <section>
                    <Accordion type="multiple" defaultValue={["item-2", "item-3"]} className="w-full rounded-lg overflow-hidden shadow-lg bg-panel">
                        <AccordionItem value="item-2" className="border-b border-border">
                            <AccordionTrigger className="text-xl font-bold px-6 py-4 hover:bg-container transition-colors text-foreground">Monitor de Estudiantes</AccordionTrigger>
                            <AccordionContent className="px-6 pb-6">
                               {activeStudents.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {activeStudents.map(student => <StudentCard key={student.id} student={student} />)}
                                    </div>
                               ) : (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <p>Esperando estudiantes...</p>
                                        <p className="text-sm mt-2">Comparte el código: <span className="font-mono font-bold">{currentExamCode}</span></p>
                                    </div>
                               )}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3" className="border-b-0">
                            <AccordionTrigger className="text-xl font-bold px-6 py-4 hover:bg-container transition-colors text-foreground">Alertas en Vivo</AccordionTrigger>
                            <AccordionContent className="px-6 pb-6">
                               <Card className="bg-card border border-border shadow-lg rounded-lg">
                                    <Tabs defaultValue="all">
                                        <CardHeader><TabsList><TabsTrigger value="all">Todas</TabsTrigger><TabsTrigger value="critical">Críticas</TabsTrigger><TabsTrigger value="warning">Advertencias</TabsTrigger></TabsList></CardHeader>
                                        <CardContent>
                                            <TabsContent value="all"><AlertList alerts={liveAlerts} /></TabsContent>
                                            <TabsContent value="critical"><AlertList alerts={criticalAlerts} /></TabsContent>
                                            <TabsContent value="warning"><AlertList alerts={warningAlerts} /></TabsContent>
                                        </CardContent>
                                    </Tabs>
                                </Card>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </section>
                </>
            )}
        </main>
    </div>
  );
}