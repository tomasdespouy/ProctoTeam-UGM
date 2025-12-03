"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Phone, Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import type { ExamStep } from '@/app/student/exam/[examId]/page';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

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

  const setupInitiated = useRef(false);

  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Iniciando sistema de monitoreo...');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [isRequestingHelp, setIsRequestingHelp] = useState(false);
  const [monitoringStartTime, setMonitoringStartTime] = useState<number | null>(null);
  const [helpMessage, setHelpMessage] = useState('');
  const [isImmune, setIsImmune] = useState(false);
  const [showPreview, setShowPreview] = useState(true); // Nuevo: Controlar visibilidad del espejo
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
        stream?.getTracks().forEach(track => track.stop());
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
    setupInitiated.current = false;
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

  // --- OPTIMIZACIÓN DE IMAGEN RESILIENTE ---
  const takeSnapshot = useCallback((): string | null => {
    const MAX_WIDTH = 320; 
    const canvas = document.createElement('canvas');
    const cameraVideo = videoRef.current;
    const screenVideo = screenVideoRef.current;

    // LOG DE DEPURACIÓN: Estado de los videos
    if (!cameraVideo || !screenVideo) {
      console.warn('[takeSnapshot] Refs no disponibles:', { cameraVideo: !!cameraVideo, screenVideo: !!screenVideo });
      return null;
    }
    
    console.log('[takeSnapshot] Estado videos:', {
      cameraReadyState: cameraVideo.readyState,
      cameraWidth: cameraVideo.videoWidth,
      screenReadyState: screenVideo.readyState,
      screenWidth: screenVideo.videoWidth,
    });

    // Verificamos individualmente si están listos
    const screenReady = screenVideo.readyState >= 2 && screenVideo.videoWidth > 0;
    const cameraReady = cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0;

    // Si NINGUNO está listo, no podemos enviar nada
    if (!screenReady && !cameraReady) {
      console.warn('[takeSnapshot] Ningún video listo para captura');
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false; 

    // Configurar dimensiones basadas en la pantalla o fallback a 4:3
    let width = 320;
    let height = 240;

    if (screenReady && screenVideo) {
        const screenAspectRatio = screenVideo.videoWidth / screenVideo.videoHeight;
        width = Math.min(screenVideo.videoWidth, MAX_WIDTH);
        height = width / screenAspectRatio;
    }

    canvas.width = width;
    canvas.height = height;

    // 1. Dibujar Fondo (Pantalla o Negro si falló)
    if (screenReady && screenVideo) {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback visual si la pantalla falló pero la cámara no
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.fillText("Esperando pantalla...", 10, 20);
    }

    // 2. Dibujar PIP (Cámara)
    if (cameraReady && cameraVideo) {
        const cameraAspectRatio = cameraVideo.videoWidth / cameraVideo.videoHeight;
        const pipWidth = canvas.width / 4; 
        const pipHeight = pipWidth / cameraAspectRatio;
        const pipX = canvas.width - pipWidth - 5;
        const pipY = canvas.height - pipHeight - 5;

        ctx.strokeStyle = '#ef4444'; 
        ctx.lineWidth = 2;
        ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);
        ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
    }

    return canvas.toDataURL('image/jpeg', 0.4);
  }, []);

  // ... (Resto de funciones: terminateSession, events, etc. se mantienen igual)
  const terminateSessionAndBlock = useCallback(async (reason: string, eventType: string, severity: 'critical' | 'warning' = 'critical') => {
    if (isTerminated || !user) return;
    const imgSrc = takeSnapshot();
    await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'alert',
            payload: { examId, studentId: user.uid, studentName: userProfile?.nombre, description: eventType, severity, evidenceUrl: imgSrc || '' },
        }),
    }).catch(console.error);
    try {
      await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', payload: { studentId: user.uid, examId, reason } }),
      });
    } catch (error) { console.error(error); }
    onTerminate(reason);
  }, [user, examId, userProfile, isTerminated, takeSnapshot, onTerminate]);

  const handleProctoringEvent = useCallback(async (event: {eventType: string, eventDetails: string, severity?: 'critical' | 'warning' | 'info'}) => {
    if (!user || !userProfile || isTerminated || step !== 'monitoring') return;
    const now = Date.now();
    if (monitoringStartTime && (now - monitoringStartTime < 60000)) return; 
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
          payload: { examId, studentId: user.uid, studentName: userProfile.nombre, description: event.eventType, severity: event.severity || 'warning', evidenceUrl: imgSrc || '' },
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

  // IA y Audio (Simplificados para brevedad, mantener lógica original)
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
      for (let i = 0; i < retries; i++) { try { return await importFn(); } catch (e) { await new Promise(r => setTimeout(r, 1000)); } }
      throw new Error("Failed to load model");
    };
    try {
        setLoadingMessage('Cargando IA...');
        const [tf, cocoSsd] = await Promise.all([ loadWithRetry(() => import('@tensorflow/tfjs')), loadWithRetry(() => import('@tensorflow-models/coco-ssd')) ]);
        await tf.setBackend('webgl');
        modelRef.current = await cocoSsd.load();
        if (personDetectionIntervalId.current) clearInterval(personDetectionIntervalId.current);
        personDetectionIntervalId.current = setInterval(detectPersons, 7000);
    } catch (error: any) {
        console.warn("IA no disponible:", error);
        toast({ title: 'Aviso', description: 'Monitoreo básico activo.', duration: 5000 });
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
        const [camStream, screenStream] = await Promise.all([
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        ]);
        if (!videoRef.current || !screenVideoRef.current || isTerminated) {
            console.warn("Component unmounted/terminated. Clean up.");
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
        if (videoRef.current && screenVideoRef.current) {
            await videoRef.current.play();
            await screenVideoRef.current.play();
        }
        initializeAudioAnalysis(camStream);
        loadMLModelAndStartDetection();
        setIsMonitoringActive(true);
        setMonitoringStartTime(Date.now()); 
    } catch (err: any) {
        console.error('Error setupMedia:', err);
        let errorMessage = `Error: ${err.message}`;
        if (err.name === 'NotAllowedError') errorMessage = 'Permiso denegado. Revisa tu navegador.';
        setMediaError(errorMessage);
        setupInitiated.current = false; 
        onTerminate(errorMessage); 
    } finally { setIsLoading(false); }
  }, [terminateSessionAndBlock, initializeAudioAnalysis, loadMLModelAndStartDetection, onTerminate, isTerminated]);

  useEffect(() => {
    if (step === 'monitoring' && !isMonitoringActive && !setupInitiated.current && !mediaError && !isTerminated) {
        setupInitiated.current = true; 
        setupMedia();
    }
  }, [step, isMonitoringActive, mediaError, setupMedia, isTerminated]);

  // --- HEARTBEAT ---
  useEffect(() => {
    if (step !== 'monitoring' || !isMonitoringActive || !user || !userProfile || isTerminated) return;
    setTimeout(async () => {
        await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', payload: { examId, studentId: user.uid, name: userProfile.nombre, email: user.email } }) });
    }, 1000);
    const imageUpdateInterval = setInterval(async () => {
        // Intentar tomar foto (ahora devuelve algo aunque sea incompleto)
        const imgSrc = takeSnapshot();
        if (user && !isTerminated) {
            try {
                const res = await fetch('/api/live', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'heartbeat', payload: { examId, studentId: user.uid, snapshot: imgSrc } }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data?.messages?.length > 0) {
                        data.data.messages.forEach((msg: string) => { grantImmunity(); toast({ title: 'Mensaje del Supervisor', description: msg }); });
                    }
                }
            } catch (error) { console.warn("Heartbeat skip", error); }
        }
    }, 5000);
    return () => clearInterval(imageUpdateInterval);
  }, [step, isMonitoringActive, user, userProfile, takeSnapshot, toast, examId, isTerminated, grantImmunity]);

  useEffect(() => {
    if (step !== 'monitoring' || !isMonitoringActive || isTerminated) return;
    const handleVisibility = () => { if (document.hidden && !isImmune) handleProctoringEvent({ eventType: 'Cambio de pestaña', eventDetails: 'Minimizó o cambió ventana', severity: 'critical' }); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [step, isMonitoringActive, handleProctoringEvent, isTerminated, isImmune]);

  // --- UI RENDER (Espejo Visible) ---
  // IMPORTANTE: Usamos CSS para ocultar, NO desmontamos del DOM para mantener streams activos
  const videoStyle = { width: '100%', height: '100%', objectFit: 'cover' as 'cover' };
  const cameraVideoStyle = { 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover' as 'cover',
    transform: 'scaleX(-1)' // Efecto espejo natural para la cámara
  };

  if (isLoading && step === 'monitoring') return <div className="fixed inset-0 bg-background/80 flex flex-col items-center justify-center z-50"><Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground">{loadingMessage}</p></div>;
  if (mediaError) return <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4"><Card className="border-destructive max-w-lg"><CardHeader><CardTitle className="text-destructive">Error de Monitoreo</CardTitle></CardHeader><CardContent><p>{mediaError}</p><Button onClick={() => window.location.reload()} className="w-full mt-4">Reintentar</Button></CardContent></Card></div>;

  return (
    <>
      {/* Contenedor del Espejo - SIEMPRE en DOM, ocultamos con CSS */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '280px', zIndex: 50 }} className="bg-black/90 border border-white/20 rounded-lg shadow-2xl overflow-hidden backdrop-blur-sm transition-all">

          {/* Cabecera del Espejo */}
          <div className="flex justify-between items-center p-2 bg-[#161F45] text-white text-xs">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/> Grabando</span>
              <button onClick={() => setShowPreview(!showPreview)} className="hover:text-blue-300">
                  {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
          </div>

          {/* 
            VIDEOS DEL ESPEJO - CRÍTICO: 
            - Altura FIJA (h-40) SIEMPRE para mantener streams activos
            - Solo usamos opacity-0 y pointer-events-none para ocultar visualmente
            - NUNCA h-0 porque puede interrumpir los streams de video
          */}
          <div 
            className={`relative h-40 transition-opacity duration-300 ${
              showPreview 
                ? 'opacity-100' 
                : 'opacity-0 pointer-events-none'
            }`}
          >
              {/* Pantalla (Fondo) */}
              <video 
                ref={screenVideoRef} 
                autoPlay 
                muted 
                playsInline 
                style={videoStyle} 
                className="absolute inset-0 bg-gray-900" 
              />

              {/* Cámara (PIP con efecto espejo) */}
              <div className="absolute bottom-2 right-2 w-1/4 aspect-video border-2 border-red-500 shadow-lg bg-black overflow-hidden">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    style={cameraVideoStyle} 
                  />
              </div>
          </div>
      </div>

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