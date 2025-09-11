
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Phone } from 'lucide-react';
// AI evaluation moved to backend API
// import { evaluateProctoringAlert } from '@/ai/flows/evaluate-proctoring-alert';
import { useToast } from "@/hooks/use-toast"
// Dynamic imports for TensorFlow to avoid large initial bundle
// import * as tf from '@tensorflow/tfjs';
// import * as cocoSsd from '@tensorflow-models/coco-ssd';
import type { ExamStep } from '@/app/student/exam/[examId]/page';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';

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
  const router = useRouter();

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
    console.log("All monitoring streams and processes have been cleaned up.");
  }, []);

  useEffect(() => {
     if (isTerminated && isMonitoringActive) {
        cleanupStreams();
     }
  }, [isTerminated, isMonitoringActive, cleanupStreams]);

  const grantImmunity = useCallback(() => {
    if (immunityTimerRef.current) {
        clearTimeout(immunityTimerRef.current);
    }
    setIsImmune(true);
    immunityTimerRef.current = setTimeout(() => {
        setIsImmune(false);
    }, 15000); // 15 seconds immunity
  }, []);

  useEffect(() => {
    if (step === 'monitoring' && 'Notification' in window) {
        if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(setNotificationPermission);
        } else {
            setNotificationPermission(Notification.permission);
        }
    }
    // Cleanup on component unmount
    return () => {
       cleanupStreams();
        if (immunityTimerRef.current) {
            clearTimeout(immunityTimerRef.current);
        }
    };
  }, [step, cleanupStreams]);

  const playAlertSound = useCallback(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(987, audioContext.currentTime); // B5
    oscillator.frequency.setValueAtTime(1318, audioContext.currentTime + 0.1); // E6
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }, []);

  const playNotificationSound = useCallback(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }, []);

  const takeSnapshot = useCallback((): string | null => {
    const MAX_WIDTH = 1280; // Max width for the snapshot to reduce payload size
    const canvas = document.createElement('canvas');
    const cameraVideo = videoRef.current;
    const screenVideo = screenVideoRef.current;
  
    if (!screenVideo || screenVideo.readyState < 2 || !cameraVideo || cameraVideo.readyState < 2) {
      return 'https://placehold.co/800x600.png'; // Fallback
    }
  
    const screenAspectRatio = screenVideo.videoWidth / screenVideo.videoHeight;
    canvas.width = Math.min(screenVideo.videoWidth, MAX_WIDTH);
    canvas.height = canvas.width / screenAspectRatio;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
  
    // Draw screen capture (scaled down)
    ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
    
    // Draw camera Picture-in-Picture
    const cameraAspectRatio = cameraVideo.videoWidth / cameraVideo.videoHeight;
    const pipWidth = canvas.width / 5; // 20% of the canvas width
    const pipHeight = pipWidth / cameraAspectRatio;
    const pipX = canvas.width - pipWidth - 10;
    const pipY = canvas.height - pipHeight - 10;
    ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);

    return canvas.toDataURL('image/jpeg', 0.5);
  }, []);

  const terminateSessionAndBlock = useCallback(async (reason: string, eventType: string, severity: 'critical' | 'warning' = 'critical') => {
    if (isTerminated || !user) return;
  
    const imgSrc = takeSnapshot();

    await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'ADD_ALERT',
            payload: {
                examId: examId,
                studentId: user.uid,
                studentName: userProfile?.nombre,
                description: eventType,
                severity,
                imgSrc: imgSrc || 'https://placehold.co/256x192.png',
            },
        }),
    }).catch(console.error);
  
    try {
      await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BLOCK_STUDENT', payload: { studentId: user.uid, examId: examId, reason } }),
      });
    } catch (error) {
      console.error("Error al bloquear al estudiante:", error);
    }
    onTerminate(reason);
  }, [user, examId, userProfile, isTerminated, takeSnapshot, onTerminate]);

  const handleProctoringEvent = useCallback(async (event: {eventType: string, eventDetails: string, severity?: 'critical' | 'warning' | 'info'}) => {
    if (!user || !userProfile || isTerminated || step !== 'monitoring') return;
    const now = Date.now();
    
    // Grace period of 1 minute (60,000 milliseconds) at the start
    if (monitoringStartTime && (now - monitoringStartTime < 60000)) {
        console.log(`Grace period active. Ignoring event: ${event.eventType}`);
        return;
    }
    
    const COOLDOWN = event.severity === 'critical' ? 0 : 10000;
    if (now - (lastAlertTimestamp.current[event.eventType] || 0) < COOLDOWN) return;
    lastAlertTimestamp.current[event.eventType] = now;

    if (event.severity === 'critical' && !event.eventType.startsWith('Solicitud de Ayuda')) {
        playAlertSound();
        const newCount = criticalAlertCount + 1;
        setCriticalAlertCount(newCount);
        grantImmunity();
        
        const toastDescription = `${event.eventType}. Has cometido ${newCount} falta(s) grave(s).`;
        toast({
            variant: 'destructive',
            title: '¡Falta Grave Detectada!',
            description: toastDescription,
            duration: 10000,
        });

        if (notificationPermission === 'granted') {
             new Notification('¡Falta Grave en Examen!', { body: toastDescription, icon: '/logo.png', tag: 'proctor-alert' });
        }
    }

    // AI evaluation is now handled by the backend API
      
    const imgSrc = takeSnapshot();
    await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_ALERT',
          payload: {
            examId: examId,
            studentId: user.uid,
            studentName: userProfile.nombre,
            description: event.eventType,
            severity: event.severity || 'warning',
            imgSrc: imgSrc || 'https://placehold.co/256x192.png',
          },
        }),
    }).catch(error => console.error("Error al enviar alerta:", error));
  }, [user, userProfile, takeSnapshot, examName, examId, isTerminated, step, monitoringStartTime, criticalAlertCount, toast, notificationPermission, playAlertSound, setCriticalAlertCount, grantImmunity]);
  
  const handleRequestHelp = useCallback(async () => {
    if (!user || !userProfile || isRequestingHelp || !helpMessage.trim()) return;

    setIsRequestingHelp(true);

    await handleProctoringEvent({
        eventType: 'Solicitud de Ayuda',
        eventDetails: `El estudiante ha solicitado ayuda técnica con el mensaje: "${helpMessage.trim()}"`,
        severity: 'critical' // Help request is critical but doesn't count towards expulsion
    });

    toast({
        title: "Solicitud Enviada",
        description: "Tu solicitud de ayuda ha sido enviada al supervisor. Por favor, espera.",
    });

    setHelpMessage(''); // Clear message after sending

    setTimeout(() => {
        setIsRequestingHelp(false);
    }, 15000); // 15-second cooldown
  }, [user, userProfile, isRequestingHelp, helpMessage, handleProctoringEvent, toast]);

  const detectPersons = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || videoRef.current.readyState < 2 || isTerminated) return;
    
    try {
        const predictions = await modelRef.current.detect(videoRef.current);
        const personCount = predictions.filter((p: any) => p.class === 'person').length;

        if (personCount === 0) {
            handleProctoringEvent({ eventType: 'Estudiante ausente', eventDetails: 'No se detectó ninguna persona frente a la cámara.', severity: 'critical' });
        } else if (personCount > 1) {
            handleProctoringEvent({ eventType: 'Múltiples personas detectadas', eventDetails: `Se detectaron ${personCount} personas en la cámara.`, severity: 'critical' });
        }
    } catch(error) {
        console.error("Error en detección de personas:", error);
    }
  }, [handleProctoringEvent, isTerminated]);

  const loadMLModelAndStartDetection = useCallback(async () => {
    if (isTerminated) return;
    
    // Retry mechanism for chunk loading errors
    const loadWithRetry = async (importFn: () => Promise<any>, retries = 3): Promise<any> => {
      for (let i = 0; i < retries; i++) {
        try {
          return await importFn();
        } catch (error: any) {
          console.log(`Attempt ${i + 1} failed:`, error.message);
          if (i === retries - 1) throw error;
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    };

    try {
        setLoadingMessage('Cargando modelo de IA...');
        
        // Load TensorFlow.js and COCO-SSD with retry mechanism
        const [tf, cocoSsd] = await Promise.all([
            loadWithRetry(() => import('@tensorflow/tfjs')),
            loadWithRetry(() => import('@tensorflow-models/coco-ssd'))
        ]);
        
        await tf.setBackend('webgl');
        modelRef.current = await cocoSsd.load();
        setLoadingMessage('Modelo de IA cargado.');
        if (personDetectionIntervalId.current) clearInterval(personDetectionIntervalId.current);
        personDetectionIntervalId.current = setInterval(detectPersons, 7000);
    } catch (error: any) {
        console.error("Error al cargar el modelo de IA:", error);
        
        // More specific error handling
        const isChunkError = error.message?.includes('Loading chunk') || error.message?.includes('ChunkLoadError');
        
        toast({
            variant: 'destructive',
            title: isChunkError ? 'Error de red' : 'Error de IA',
            description: isChunkError 
              ? 'Problema de conectividad. La vigilancia de la cámara estará desactivada.' 
              : 'No se pudo cargar el modelo de detección. La vigilancia de la cámara estará desactivada.'
        });
    }
  }, [detectPersons, toast, isTerminated]);

  const initializeAudioAnalysis = useCallback((stream: MediaStream) => {
    if (!stream.getAudioTracks().length || isTerminated) {
        if (!stream.getAudioTracks().length) console.warn("No se proporcionó una pista de audio para análisis.");
        return;
    }
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      for (let i = 0; i < input.length; ++i) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / input.length);

      if (rms > SPEAKING_THRESHOLD) {
        speakingCount++;
        if (speakingCount >= CONSECUTIVE_SAMPLES) {
            handleProctoringEvent({ eventType: 'Sonido sospechoso detectado', eventDetails: 'Se detectó un posible habla o ruido fuerte.', severity: 'warning' });
            speakingCount = 0;
        }
      } else {
        speakingCount = 0;
      }
    };
    source.connect(processor);
    processor.connect(audioContext.destination);

  }, [handleProctoringEvent, isTerminated]);
  
  const setupMedia = useCallback(async () => {
    setIsSetupInProgress(true);
    setIsLoading(true);
    setMediaError(null);

    const waitForVideoReady = (videoElement: HTMLVideoElement): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (videoElement.readyState >= 2) return resolve();
            videoElement.onloadeddata = () => resolve();
            videoElement.onerror = () => reject(new Error(`Error al cargar el stream de video para ${videoElement.id}.`));
            setTimeout(() => reject(new Error(`Timeout al cargar video para ${videoElement.id}.`)), 10000);
        });
    };

    try {
        setLoadingMessage('Solicitando permisos de cámara, micrófono y pantalla...');
        if (!videoRef.current || !screenVideoRef.current) {
            throw new Error("Los elementos de video no están montados en el DOM.");
        }
        
        const [camAndMicStream, screenStream] = await Promise.all([
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        ]);
        
        if (isTerminated) {
            camAndMicStream.getTracks().forEach(t => t.stop());
            screenStream.getTracks().forEach(t => t.stop());
            return;
        }

        const screenTrack = screenStream.getVideoTracks()[0];
        const screenSettings = screenTrack.getSettings();

        if (screenSettings.displaySurface !== 'monitor') {
            await terminateSessionAndBlock(
                'No compartiste la pantalla completa como se requiere. Para apelar, contacta con la coordinación académica de tu escuela.',
                'Compartir pantalla incorrecto',
                'critical'
            );
            return;
        }
        
        videoRef.current.srcObject = camAndMicStream;
        screenVideoRef.current.srcObject = screenStream;

        screenTrack.onended = async () => {
             await terminateSessionAndBlock(
                'Has detenido la compartición de pantalla. Para apelar, contacta con la coordinación académica de tu escuela.',
                'Compartir pantalla detenido'
             );
        };
        
        setLoadingMessage('Esperando carga de videos...');
        await Promise.all([ waitForVideoReady(videoRef.current), waitForVideoReady(screenVideoRef.current) ]);

        await videoRef.current.play();
        await screenVideoRef.current.play();

        setLoadingMessage('Inicializando análisis de audio...');
        initializeAudioAnalysis(camAndMicStream);
        
        await loadMLModelAndStartDetection();
        
        setIsMonitoringActive(true);
        setMonitoringStartTime(Date.now()); // Start grace period timer

    } catch (err: any) {
        console.error('Error durante setupMedia:', err);
        let errorMessage = `Error inesperado: ${err.message}.`;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
             errorMessage = 'Permiso denegado. Revisa la configuración de tu navegador y recarga la página para intentarlo de nuevo.';
        } else if (err.name === 'NotFoundError') {
             errorMessage = 'No se encontró un dispositivo compatible (cámara, micrófono o pantalla).';
        }
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
        const imgSrc = takeSnapshot();
        await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            action: 'REGISTER_STUDENT',
            payload: { id: user.uid, name: userProfile.nombre, email: user.email || 'sin-email', imgSrc: imgSrc || 'https://placehold.co/256x192.png', examId, subject: examSubject, section: examSection },
            }),
        });
    }, 3000);
    
    const imageUpdateInterval = setInterval(async () => {
        const imgSrc = takeSnapshot();
        if (imgSrc && user && !isTerminated) {
            fetch('/api/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE_IMAGE', payload: { studentId: user.uid, imgSrc } }),
            })
            .then(res => res.json())
            .then(data => {
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach((msg: string) => {
                        grantImmunity();
                        toast({ variant: 'default', title: 'Mensaje del Supervisor', description: msg, duration: 10000 });
                        playNotificationSound();
                        if (notificationPermission === 'granted') new Notification('Mensaje del Supervisor', { body: msg, icon: '/logo.png', tag: 'proctor-message' });
                    });
                }
            }).catch(console.error);
        }
    }, 5000);

    return () => clearInterval(imageUpdateInterval);
  }, [step, isMonitoringActive, user, userProfile, takeSnapshot, toast, notificationPermission, playNotificationSound, examId, examSubject, examSection, isTerminated, grantImmunity]);


  useEffect(() => {
    if (step !== 'monitoring' || !isMonitoringActive || isTerminated) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isImmune) {
        handleProctoringEvent({ eventType: 'Cambio de pestaña', eventDetails: 'El estudiante ha cambiado de pestaña o minimizado la ventana.', severity: 'critical' });
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        handleProctoringEvent({
            eventType: 'Intento de usar menú contextual',
            eventDetails: 'El estudiante intentó abrir el menú contextual (clic derecho).',
            severity: 'warning'
        });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [step, isMonitoringActive, handleProctoringEvent, isTerminated, isImmune]);


  const hiddenVideoStyles: React.CSSProperties = { position: 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0 };
  
  const renderUI = () => {
    if (isTerminated && !mediaError) {
        // The parent page will handle showing the final screen.
        // This component's only job is to clean up.
        return null;
    }
      
    if (isLoading && step === 'monitoring') {
        return (
            <div className="fixed inset-0 bg-background/80 flex flex-col items-center justify-center z-50">
                <Card className="shadow-lg h-auto">
                    <CardHeader><CardTitle className="font-headline text-primary">Configurando Monitoreo...</CardTitle><CardDescription>Por favor, acepta los permisos en tu navegador para continuar.</CardDescription></CardHeader>
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-muted-foreground">{loadingMessage}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (mediaError) {
        return (
             <div className="fixed inset-0 bg-background/80 flex flex-col items-center justify-center z-50 p-4">
                <Card className="shadow-lg border-destructive h-auto max-w-lg">
                    <CardHeader><CardTitle className="font-headline text-destructive flex items-center gap-2"><AlertTriangle /> Error Crítico de Monitoreo</CardTitle></CardHeader>
                    <CardContent className="pt-6">
                        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>No se pudo iniciar el monitoreo</AlertTitle><AlertDescription>{mediaError}</AlertDescription></Alert>
                        <Button onClick={() => window.location.reload()} className="w-full mt-4">Recargar Página e Intentar de Nuevo</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    // If monitoring is active, render nothing, as the component is now "headless" in the UI.
    return null;
  };

  return (
    <>
      <video ref={videoRef} id="camera-video" style={hiddenVideoStyles} autoPlay muted playsInline />
      <video ref={screenVideoRef} id="screen-video" style={hiddenVideoStyles} autoPlay muted playsInline />
       {isMonitoringActive && !isTerminated && (
        <div className="fixed bottom-16 left-4 z-50">
            <Dialog>
                <DialogTrigger asChild>
                    <Button 
                        variant="destructive"
                        className="shadow-lg"
                    >
                        <Phone className="mr-2 h-4 w-4" />
                        Soporte técnico
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Solicitar Ayuda Técnica</DialogTitle>
                        <DialogDescription>
                            Describe tu problema a continuación. El supervisor recibirá tu mensaje. No podrás enviar otro mensaje hasta dentro de 15 segundos.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea 
                        value={helpMessage}
                        onChange={(e) => setHelpMessage(e.target.value)}
                        placeholder="Ej: No puedo ver las preguntas del examen."
                        rows={4}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button 
                            onClick={handleRequestHelp} 
                            disabled={isRequestingHelp || !helpMessage.trim()}
                        >
                            {isRequestingHelp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Enviar Solicitud
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      )}
      {renderUI()}
    </>
  );
}
