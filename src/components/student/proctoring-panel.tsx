"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Phone } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import type { ExamStep } from '@/app/student/exam/[examId]/page';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

interface ProctoringPanelProps {
  step: ExamStep;
  examName: string;
  examId: string;
  examSubject: string;
  examSection: string;
  isTerminated: boolean;
  onTerminate: (reason: string) => void;
  criticalAlertCount: number;
  setCriticalAlertCount: (count: number) => void;
}

export function ProctoringPanel({ step, examName, examId, examSubject, examSection, isTerminated, onTerminate, criticalAlertCount, setCriticalAlertCount }: ProctoringPanelProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const modelRef = useRef<any | null>(null);

  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Iniciando sistema de monitoreo...');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [isRequestingHelp, setIsRequestingHelp] = useState(false);
  const [monitoringStartTime, setMonitoringStartTime] = useState<number | null>(null);
  const [helpMessage, setHelpMessage] = useState('');
  const [isImmune, setIsImmune] = useState(false);
  const immunityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const lastAlertTimestamp = useRef<{[key: string]: number}>({});
  const personDetectionIntervalId = useRef<NodeJS.Timeout | null>(null);
  const audioAnalysisNode = useRef<ScriptProcessorNode | null>(null);

  const cleanupStreams = useCallback(() => {
    if (personDetectionIntervalId.current) {
        clearInterval(personDetectionIntervalId.current);
        personDetectionIntervalId.current = null;
    }
    if (audioAnalysisNode.current) {
        audioAnalysisNode.current.disconnect();
        audioAnalysisNode.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close().catch(console.error);
        audioContextRef.current = null;
    }

    const stopStream = (stream: MediaStream | null) => {
        stream?.getTracks().forEach(track => {
            track.stop();
        });
    };

    if (videoRef.current?.srcObject) {
        stopStream(videoRef.current.srcObject as MediaStream);
        videoRef.current.srcObject = null;
    }
    if (screenVideoRef.current?.srcObject) {
        stopStream(screenVideoRef.current.srcObject as MediaStream);
        screenVideoRef.current.srcObject = null;
    }
    setIsMonitoringActive(false);
  }, []);

  useEffect(() => {
     if (isTerminated && isMonitoringActive) {
        cleanupStreams();
     }
  }, [isTerminated, isMonitoringActive, cleanupStreams]);

  const grantImmunity = useCallback(() => {
    if (immunityTimerRef.current) clearTimeout(immunityTimerRef.current);
    setIsImmune(true);
    immunityTimerRef.current = setTimeout(() => setIsImmune(false), 15000); 
  }, []);

  useEffect(() => {
    if (step === 'monitoring' && 'Notification' in window) {
        if (Notification.permission !== 'denied') Notification.requestPermission().then(setNotificationPermission);
        else setNotificationPermission(Notification.permission);
    }
    return () => {
       cleanupStreams();
       if (immunityTimerRef.current) clearTimeout(immunityTimerRef.current);
    };
  }, [step, cleanupStreams]);

  // Sonidos (Omitidos para brevedad, se mantienen igual si estaban definidos o vacíos)
  const playAlertSound = useCallback(() => {}, []); 
  const playNotificationSound = useCallback(() => {}, []);

  // --- OPTIMIZACIÓN DE IMAGEN ---
  const takeSnapshot = useCallback((): string | null => {
    // Reducimos a 320px. Esto baja el peso de ~100KB a ~5KB.
    // Suficiente para que el profesor vea que el alumno está ahí.
    const MAX_WIDTH = 320; 

    const canvas = document.createElement('canvas');
    const cameraVideo = videoRef.current;
    const screenVideo = screenVideoRef.current;

    if (!screenVideo || screenVideo.readyState < 2 || !cameraVideo || cameraVideo.readyState < 2) return null;

    const screenAspectRatio = screenVideo.videoWidth / screenVideo.videoHeight;
    canvas.width = Math.min(screenVideo.videoWidth, MAX_WIDTH);
    canvas.height = canvas.width / screenAspectRatio;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Optimización de renderizado
    ctx.imageSmoothingEnabled = false; 

    // 1. Dibujar pantalla (Fondo)
    ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

    // 2. Dibujar cámara (Picture-in-Picture)
    const cameraAspectRatio = cameraVideo.videoWidth / cameraVideo.videoHeight;
    const pipWidth = canvas.width / 4; // 25% del ancho
    const pipHeight = pipWidth / cameraAspectRatio;
    const pipX = canvas.width - pipWidth - 5;
    const pipY = canvas.height - pipHeight - 5;

    // Borde visual para separar cámara de pantalla
    ctx.strokeStyle = '#ef4444'; // Red-500
    ctx.lineWidth = 2;
    ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);

    ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);

    // Calidad 0.4 (JPEG) es el balance perfecto entre visibilidad y velocidad de red
    return canvas.toDataURL('image/jpeg', 0.4);
  }, []);

  const terminateSessionAndBlock = useCallback(async (reason: string, eventType: string, severity: 'critical' | 'warning' = 'critical') => {
    if (isTerminated || !user) return;
    const imgSrc = takeSnapshot();

    await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'alert',
            payload: {
                examId, studentId: user.uid, studentName: userProfile?.nombre,
                description: eventType, severity, evidenceUrl: imgSrc || ''
            },
        }),
    }).catch(console.error);

    try {
      await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'finish', 
            payload: { studentId: user.uid, examId, reason } 
        }),
      });
    } catch (error) { console.error(error); }
    onTerminate(reason);
  }, [user, examId, userProfile, isTerminated, takeSnapshot, onTerminate]);

  const handleProctoringEvent = useCallback(async (event: {eventType: string, eventDetails: string, severity?: 'critical' | 'warning' | 'info'}) => {
    if (!user || !userProfile || isTerminated || step !== 'monitoring') return;
    const now = Date.now();

    if (monitoringStartTime && (now - monitoringStartTime < 60000)) return; // Grace period

    const COOLDOWN = event.severity === 'critical' ? 0 : 10000;
    if (now - (lastAlertTimestamp.current[event.eventType] || 0) < COOLDOWN) return;
    lastAlertTimestamp.current[event.eventType] = now;

    if (event.severity === 'critical' && !event.eventType.startsWith('Solicitud de Ayuda')) {
        const newCount = criticalAlertCount + 1;
        setCriticalAlertCount(newCount);
        grantImmunity();
        toast({ variant: 'destructive', title: '¡Falta Grave Detectada!', description: `${event.eventType}`, duration: 10000 });
    }

    const imgSrc = takeSnapshot();
    await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'alert',
          payload: {
            examId, // ID IMPORTANTE
            studentId: user.uid,
            studentName: userProfile.nombre,
            description: event.eventType,
            severity: event.severity || 'warning',
            evidenceUrl: imgSrc || '',
          },
        }),
    }).catch(error => console.error("Error al enviar alerta:", error));
  }, [user, userProfile, takeSnapshot, examId, isTerminated, step, monitoringStartTime, criticalAlertCount, toast, setCriticalAlertCount, grantImmunity]);

  const handleRequestHelp = useCallback(async () => {
    if (!user || !userProfile || isRequestingHelp || !helpMessage.trim()) return;
    setIsRequestingHelp(true);
    await handleProctoringEvent({ eventType: 'Solicitud de Ayuda', eventDetails: helpMessage, severity: 'critical' });
    toast({ title: "Solicitud Enviada", description: "Tu solicitud ha sido enviada." });
    setHelpMessage(''); 
    setTimeout(() => setIsRequestingHelp(false), 15000);
  }, [user, userProfile, isRequestingHelp, helpMessage, handleProctoringEvent, toast]);

  const detectPersons = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || videoRef.current.readyState < 2 || isTerminated) return;
    try {
        const predictions = await modelRef.current.detect(videoRef.current);
        const personCount = predictions.filter((p: any) => p.class === 'person').length;
        if (personCount === 0) handleProctoringEvent({ eventType: 'Estudiante ausente', eventDetails: 'No se detectó rostro.', severity: 'critical' });
        else if (personCount > 1) handleProctoringEvent({ eventType: 'Múltiples personas', eventDetails: `${personCount} personas detectadas.`, severity: 'critical' });
    } catch(error) { console.error("Error AI detection", error); }
  }, [handleProctoringEvent, isTerminated]);

  const loadMLModelAndStartDetection = useCallback(async () => {
    if (isTerminated) return;
    const loadWithRetry = async (importFn: () => Promise<any>, retries = 2) => {
      for (let i = 0; i < retries; i++) {
        try { return await importFn(); } catch (e) { await new Promise(r => setTimeout(r, 1000)); }
      }
      throw new Error("Failed to load model");
    };

    try {
        setLoadingMessage('Cargando IA...');
        const [tf, cocoSsd] = await Promise.all([
            loadWithRetry(() => import('@tensorflow/tfjs')),
            loadWithRetry(() => import('@tensorflow-models/coco-ssd'))
        ]);
        await tf.setBackend('webgl');
        modelRef.current = await cocoSsd.load();
        if (personDetectionIntervalId.current) clearInterval(personDetectionIntervalId.current);
        personDetectionIntervalId.current = setInterval(detectPersons, 7000);
    } catch (error: any) {
        console.warn("IA no disponible (Red/Firewall):", error);
        toast({ title: 'Aviso', description: 'Monitoreo básico activo (IA desactivada por red).', duration: 5000 });
        // No bloqueamos el examen, permitimos continuar sin IA local
    }
  }, [detectPersons, toast, isTerminated]);

  const initializeAudioAnalysis = useCallback((stream: MediaStream) => {
    if (!stream.getAudioTracks().length || isTerminated) return;
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(2048, 1, 1);
        audioAnalysisNode.current = processor;

        let speakingCount = 0;
        const SPEAKING_THRESHOLD = 0.04;
        const CONSECUTIVE_SAMPLES = 3;

        processor.onaudioprocess = (e) => {
            if (isTerminated) return;
            const input = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < input.length; ++i) sum += input[i] * input[i];
            const rms = Math.sqrt(sum / input.length);
            if (rms > SPEAKING_THRESHOLD) {
                speakingCount++;
                if (speakingCount >= CONSECUTIVE_SAMPLES) {
                    handleProctoringEvent({ eventType: 'Sonido sospechoso', eventDetails: 'Habla o ruido fuerte.', severity: 'warning' });
                    speakingCount = 0;
                }
            } else speakingCount = 0;
        };
        source.connect(processor);
        processor.connect(audioContext.destination);
    } catch (e) { console.warn("Audio analysis failed", e); }
  }, [handleProctoringEvent, isTerminated]);

  const setupMedia = useCallback(async () => {
    setIsSetupInProgress(true);
    setIsLoading(true);
    setMediaError(null);

    const waitForVideoReady = (videoElement: HTMLVideoElement): Promise<void> => {
        return new Promise((resolve) => {
            if (videoElement.readyState >= 2) return resolve();
            videoElement.onloadeddata = () => resolve();
            setTimeout(() => resolve(), 5000); 
        });
    };

    try {
        setLoadingMessage('Solicitando permisos...');
        if (!videoRef.current || !screenVideoRef.current) throw new Error("DOM Error");

        const [camStream, screenStream] = await Promise.all([
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        ]);

        if (isTerminated) {
            camStream.getTracks().forEach(t => t.stop());
            screenStream.getTracks().forEach(t => t.stop());
            return;
        }

        videoRef.current.srcObject = camStream;
        screenVideoRef.current.srcObject = screenStream;

        screenStream.getVideoTracks()[0].onended = async () => {
             await terminateSessionAndBlock('Has detenido la compartición de pantalla.', 'Compartir pantalla detenido');
        };

        await Promise.all([ waitForVideoReady(videoRef.current), waitForVideoReady(screenVideoRef.current) ]);
        await videoRef.current.play();
        await screenVideoRef.current.play();

        initializeAudioAnalysis(camStream);

        // Carga no bloqueante de la IA
        loadMLModelAndStartDetection();

        setIsMonitoringActive(true);
        setMonitoringStartTime(Date.now()); 

    } catch (err: any) {
        console.error('Error setupMedia:', err);
        let errorMessage = `Error: ${err.message}`;
        if (err.name === 'NotAllowedError') errorMessage = 'Permiso denegado. Revisa tu navegador.';
        setMediaError(errorMessage);
        onTerminate(errorMessage); 
    } finally {
        setIsLoading(false);
        setIsSetupInProgress(false);
    }
  }, [terminateSessionAndBlock, initializeAudioAnalysis, loadMLModelAndStartDetection, onTerminate, isTerminated]);

  useEffect(() => {
    if (step === 'monitoring' && !isMonitoringActive && !isSetupInProgress && !mediaError && !isTerminated) {
        setupMedia();
    }
  }, [step, isMonitoringActive, mediaError, setupMedia, isTerminated, isSetupInProgress]);

  useEffect(() => {
    if (step !== 'monitoring' || !isMonitoringActive || !user || !userProfile || isTerminated) return;

    setTimeout(async () => {
        await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'join', 
                payload: { examId, studentId: user.uid, name: userProfile.nombre, email: user.email }
            }),
        });
    }, 1000);

    const imageUpdateInterval = setInterval(async () => {
        const imgSrc = takeSnapshot();
        if (imgSrc && user && !isTerminated) {
            try {
                const res = await fetch('/api/live', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'heartbeat', 
                        payload: { 
                            examId, // ✅ AHORA SÍ ENVIAMOS EL ID
                            studentId: user.uid, 
                            snapshot: imgSrc 
                        } 
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.data?.messages?.length > 0) {
                        data.data.messages.forEach((msg: string) => {
                            grantImmunity();
                            toast({ title: 'Mensaje del Supervisor', description: msg });
                        });
                    }
                }
            } catch (error) { console.warn("Heartbeat skip", error); }
        }
    }, 5000);

    return () => clearInterval(imageUpdateInterval);
  }, [step, isMonitoringActive, user, userProfile, takeSnapshot, toast, examId, isTerminated, grantImmunity]);

  useEffect(() => {
    if (step !== 'monitoring' || !isMonitoringActive || isTerminated) return;
    const handleVisibility = () => {
      if (document.hidden && !isImmune) handleProctoringEvent({ eventType: 'Cambio de pestaña', eventDetails: 'Minimizó o cambió ventana', severity: 'critical' });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [step, isMonitoringActive, handleProctoringEvent, isTerminated, isImmune]);

  const hiddenStyle = { position: 'absolute' as 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0 };

  if (isLoading && step === 'monitoring') return (
    <div className="fixed inset-0 bg-background/80 flex flex-col items-center justify-center z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{loadingMessage}</p>
    </div>
  );

  if (mediaError) return (
     <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
        <Card className="border-destructive max-w-lg"><CardHeader><CardTitle className="text-destructive">Error de Monitoreo</CardTitle></CardHeader><CardContent><p>{mediaError}</p><Button onClick={() => window.location.reload()} className="w-full mt-4">Reintentar</Button></CardContent></Card>
    </div>
  );

  return (
    <>
      <video ref={videoRef} id="camera-video" style={hiddenStyle} autoPlay muted playsInline />
      <video ref={screenVideoRef} id="screen-video" style={hiddenStyle} autoPlay muted playsInline />
       {isMonitoringActive && !isTerminated && (
        <div className="fixed bottom-16 left-4 z-50">
            <Dialog>
                <DialogTrigger asChild><Button variant="destructive" className="shadow-lg"><Phone className="mr-2 h-4 w-4" />Ayuda</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Solicitar Ayuda</DialogTitle></DialogHeader>
                    <Textarea value={helpMessage} onChange={(e) => setHelpMessage(e.target.value)} placeholder="Describe tu problema..." rows={4}/>
                    <DialogFooter><Button onClick={handleRequestHelp} disabled={isRequestingHelp || !helpMessage.trim()}>Enviar</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      )}
    </>
  );
}