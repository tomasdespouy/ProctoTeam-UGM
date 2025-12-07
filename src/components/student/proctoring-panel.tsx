"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, UserProfile } from '@/context/auth-context';
import { AccountInfo } from '@azure/msal-browser';
import { Button } from '@/components/ui/button';
import { Loader2, Phone, Eye, EyeOff, Send } from 'lucide-react'; 
import { useToast } from "@/hooks/use-toast"
import type { ExamStep } from '@/app/student/exam/[examId]/page';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UTILIDAD: Extracción robusta de Student ID (Base de la Defensa en Profundidad)
 * ═══════════════════════════════════════════════════════════════════════════
 */
function getStudentId(
  userProfile: UserProfile | null, 
  account: AccountInfo | null
): string | null {
  // 1. Fuente principal: userProfile.uid (desde PostgreSQL)
  if (userProfile?.uid && typeof userProfile.uid === 'string') {
    return userProfile.uid;
  }

  // 2. Fallback: userProfile.id
  if (userProfile?.id && typeof userProfile.id === 'string') {
    return userProfile.id;
  }

  // 3. Fallback: Azure AD localAccountId (oid claim)
  if (account?.localAccountId && typeof account.localAccountId === 'string') {
    return account.localAccountId;
  }

  // 4. Último recurso: Azure AD homeAccountId (formato: oid.tenantId)
  if (account?.homeAccountId && typeof account.homeAccountId === 'string') {
    // homeAccountId tiene formato "oid.tenantId", extraemos solo el oid
    const oid = account.homeAccountId.split('.')[0];
    if (oid) return oid;
  }

  console.warn('⚠️ [getStudentId] No se pudo extraer ID del estudiante de ninguna fuente');
  return null;
}

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

  // Refs de Video y Lógica
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const modelRef = useRef<any | null>(null);
  const isMounted = useRef(false); // NUEVO: Para controlar ciclo de vida seguro

  const setupInitiated = useRef(false);

  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Iniciando sistema de monitoreo...');
  const [mediaError, setMediaError] = useState<string | null>(null);

  // --- ESTADOS DE RESILIENCIA ---
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const MAX_RECOVERY_ATTEMPTS = 5;
  // ------------------------------

  const [isRequestingHelp, setIsRequestingHelp] = useState(false);
  const [monitoringStartTime, setMonitoringStartTime] = useState<number | null>(null);
  const [helpMessage, setHelpMessage] = useState('');
  const [isImmune, setIsImmune] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const immunityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const lastAlertTimestamp = useRef<{[key: string]: number}>({});
  const personDetectionIntervalId = useRef<NodeJS.Timeout | null>(null);

  // NOTA: Se mantiene la estructura para la deuda técnica, pero ya no se usa para análisis.
  const audioAnalysisNode = useRef<ScriptProcessorNode | null>(null);

  // --- CONTROL DE MONTAJE ---
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
    // Solo reseteamos estado si el componente sigue montado
    if (isMounted.current) {
        setIsMonitoringActive(false);
        // [RESILIENCIA] Detenemos la recuperación si limpiamos completamente
        setIsRecovering(false);
        setRecoveryAttempts(0);
    }
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
        if (Notification.permission !== 'denied') Notification.requestPermission();
    }
    return () => {
       cleanupStreams();
       if (immunityTimerRef.current) clearTimeout(immunityTimerRef.current);
    };
  }, [step, cleanupStreams]);

  // --- TAKE SNAPSHOT OMITTED ---
  const takeSnapshot = useCallback((): string | null => {
    const MAX_WIDTH = 320; 
    const canvas = document.createElement('canvas');
    const cameraVideo = videoRef.current;
    const screenVideo = screenVideoRef.current;

    if (!cameraVideo || !screenVideo) return null;

    // Verificación simplificada para evitar logs excesivos
    const screenReady = screenVideo.readyState >= 2 && screenVideo.videoWidth > 0;
    const cameraReady = cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0;

    if (!screenReady && !cameraReady) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false; 

    let width = 320;
    let height = 240;

    if (screenReady) {
        const screenAspectRatio = screenVideo.videoWidth / screenVideo.videoHeight;
        width = Math.min(screenVideo.videoWidth, MAX_WIDTH);
        height = width / screenAspectRatio;
    }

    canvas.width = width;
    canvas.height = height;

    if (screenReady) {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (cameraReady) {
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

  // --- API HANDLERS OMITTED ---
  const terminateSessionAndBlock = useCallback(async (reason: string, eventType: string, severity: 'critical' | 'warning' = 'critical', attemptRecovery = false) => {

    // [CRÍTICO DE RESILIENCIA]: Si la razón es de pérdida de stream y se permite la recuperación, NO terminamos el examen.
    if (attemptRecovery) {
        console.warn(`⚠️ [Recovery] Stream perdido por ${eventType}. Iniciando ciclo de recuperación...`);
        cleanupStreams();
        setIsRecovering(true);
        // La finalización forzada del examen (onTerminate) ocurre solo si MAX_ATTEMPTS se agota.
        return; 
    }

    // --- Lógica de Finalización Forzada (Si se agotan los intentos o es una acción del instructor) ---
    if (isTerminated || !user) return;

    // Extraer studentId de forma robusta
    const studentId = getStudentId(userProfile, user.account);
    if (!studentId) {
      console.warn('⚠️ [terminateSessionAndBlock] Abortado: No se pudo obtener studentId');
      return;
    }

    const imgSrc = takeSnapshot();

    // Fire and forget alerts to avoid blocking UI
    fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'alert',
            studentId,
            examId,
            payload: { examId, studentId, studentName: userProfile?.nombre, description: eventType, severity, evidenceUrl: imgSrc || '' },
        }),
    }).catch(console.error);

    try {
      await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', studentId, examId, payload: { studentId, examId, reason } }),
      });
    } catch (error) { console.error(error); }
    onTerminate(reason);
  }, [user, examId, userProfile, isTerminated, takeSnapshot, onTerminate, cleanupStreams]);

  const handleProctoringEvent = useCallback(async (event: {eventType: string, eventDetails: string, severity?: 'critical' | 'warning' | 'info'}) => {
    if (!user || !userProfile || isTerminated || step !== 'monitoring') return;

    // Extraer studentId de forma robusta
    const studentId = getStudentId(userProfile, user.account);
    if (!studentId) {
      console.warn('⚠️ [handleProctoringEvent] Abortado: No se pudo obtener studentId');
      return;
    }

    const now = Date.now();
    // Cooldown inicial de 60s
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
    // DEFENSE IN DEPTH: studentId redundante en nivel superior
    await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'alert',
          studentId,
          examId,
          payload: { examId, studentId, studentName: userProfile.nombre, description: event.eventType, severity: event.severity || 'warning', evidenceUrl: imgSrc || '' },
        }),
    }).catch(error => console.error("Error al enviar alerta:", error));
  }, [user, userProfile, takeSnapshot, examId, isTerminated, step, monitoringStartTime, criticalAlertCount, toast, setCriticalAlertCount, grantImmunity]);

  const handleRequestHelp = useCallback(async () => {
    // Usar getStudentId para validar en lugar de depender solo de userProfile
    const studentId = getStudentId(userProfile, user?.account ?? null);
    if (!studentId || isRequestingHelp || !helpMessage.trim()) {
      if (!studentId) console.warn('⚠️ [handleRequestHelp] Abortado: No se pudo obtener studentId');
      return;
    }
    setIsRequestingHelp(true);
    await handleProctoringEvent({ eventType: 'Solicitud de Ayuda', eventDetails: helpMessage, severity: 'critical' });
    toast({ title: "Solicitud Enviada", description: "Tu solicitud ha sido enviada." });
    setHelpMessage(''); 
    setTimeout(() => setIsRequestingHelp(false), 15000);
  }, [user, userProfile, isRequestingHelp, helpMessage, handleProctoringEvent, toast]);

  // --- IA HELPERS (Reincorporados) ---
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
        setLoadingMessage('Configurando IA...');
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
    // [CRÍTICO] Se ha deshabilitado el análisis de audio por falta de soporte en el backend.
    console.warn("🚫 Audio analysis is intentionally disabled as per backend requirements.");
    return;
  }, []);

  // --- SETUP PRINCIPAL ---
  const setupMedia = useCallback(async (isRecoveryAttempt = false) => {
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
        setLoadingMessage(isRecoveryAttempt 
          ? `Intento de reconexión #${recoveryAttempts + 1}...` 
          : 'Solicitando permisos...');

        const [camStream, screenStream] = await Promise.all([
          // [CRÍTICO]: NO AUDIO. Solo cámara.
          navigator.mediaDevices.getUserMedia({ video: true, audio: false }), 
          // [CRÍTICO]: NO AUDIO. Solo pantalla.
          navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        ]);

        // VERIFICACIÓN CORREGIDA: Usamos isMounted y verificamos refs
        if (!isMounted.current || isTerminated) {
            console.log("Setup interrumpido, componente desmontado o terminado.");
            camStream.getTracks().forEach(t => t.stop());
            screenStream.getTracks().forEach(t => t.stop());
            return;
        }

        // Si la reconexión es exitosa, reiniciamos el estado de recovery
        if (isRecoveryAttempt) {
            setIsRecovering(false);
            setRecoveryAttempts(0);
            toast({ title: '¡Conexión Restablecida!', description: 'El monitoreo continúa.', duration: 3000 });
        }


        // Si por alguna razón extraña los refs son null (no deberían serlo con el arreglo del render), lanzamos error controlado
        if (!videoRef.current || !screenVideoRef.current) {
            throw new Error("Error interno: Elementos de video no inicializados.");
        }

        videoRef.current.srcObject = camStream;
        screenVideoRef.current.srcObject = screenStream;

        // [RESILIENCIA] Si el stream de pantalla se termina, iniciamos la recuperación.
        screenStream.getVideoTracks()[0].onended = async () => {
             await terminateSessionAndBlock('Pérdida de stream de pantalla.', 'Pérdida de Stream', 'warning', true);
        };

        await Promise.all([ waitForVideoReady(videoRef.current), waitForVideoReady(screenVideoRef.current) ]);

        if (videoRef.current && screenVideoRef.current) {
            await videoRef.current.play();
            await screenVideoRef.current.play();
        }

        // La función initializeAudioAnalysis ahora está vacía/deshabilitada
        initializeAudioAnalysis(screenStream); 

        // Cargamos IA en segundo plano para no bloquear tanto
        loadMLModelAndStartDetection(); 

        setIsMonitoringActive(true);
        setMonitoringStartTime(Date.now()); 
    } catch (err: any) {
        console.error('Error setupMedia:', err);

        // [RESILIENCIA] Si estamos en modo recuperación, incrementamos intentos y reintentamos.
        if (isRecoveryAttempt) {
            setRecoveryAttempts(prev => prev + 1);
            return; 
        }

        // Si es la carga inicial y falla, bloqueamos
        let errorMessage = `Error: ${err.message}`;
        if (err.name === 'NotAllowedError') errorMessage = 'Permiso denegado. Debes permitir cámara y pantalla.';
        setMediaError(errorMessage);
        setupInitiated.current = false; 
        onTerminate(errorMessage); 
    } finally { 
        // Solo quitamos el loader si no estamos en un ciclo de recuperación activo
        if (isMounted.current && !isRecovering) setIsLoading(false); 
    }
  }, [terminateSessionAndBlock, initializeAudioAnalysis, loadMLModelAndStartDetection, onTerminate, isTerminated, recoveryAttempts, isRecovering]);

  useEffect(() => {
    if (step === 'monitoring' && !isMonitoringActive && !setupInitiated.current && !mediaError && !isTerminated) {
        setupInitiated.current = true; 
        setupMedia();
    }
  }, [step, isMonitoringActive, mediaError, setupMedia, isTerminated]);

  // --- EFECTO DE RESILIENCIA: CICLO DE RECUPERACIÓN (BACKOFF EXPONENCIAL) ---
  useEffect(() => {
    if (!isRecovering || isTerminated || recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        // Si se agotan los intentos, forzamos la terminación del examen
        if (isRecovering && recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            terminateSessionAndBlock(`Máximo de ${MAX_RECOVERY_ATTEMPTS} intentos de reconexión agotados.`, 'Límite de reconexión agotado', 'critical', false);
        }
        return;
    }

    // Calcula el tiempo de espera: 5s * (intento + 1) ^ 1.5, máximo 60s.
    const delay = Math.min(
      5000 * Math.pow(1.5, recoveryAttempts), 
      60000
    );

    console.log(`⏳ Esperando ${delay / 1000}s para el intento #${recoveryAttempts + 1}`);

    const timer = setTimeout(() => {
        // Intentamos re-ejecutar setupMedia en modo recuperación
        setupMedia(true); 
    }, delay);

    return () => clearTimeout(timer);

  }, [isRecovering, recoveryAttempts, isTerminated, setupMedia, terminateSessionAndBlock]);
  // ---------------------------------------------------------------------------


  // --- HEARTBEAT LOGIC (Reincorporado) ---
  useEffect(() => {
    if (step !== 'monitoring' || !isMonitoringActive || !user || !userProfile || isTerminated) return;

    // Extraer studentId de forma robusta
    const studentId = getStudentId(userProfile, user.account);
    if (!studentId) return;

    // Heartbeat inicial
    fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', studentId, examId, payload: { studentId, name: userProfile.nombre, email: user.email } }) }).catch(console.error);

    const imageUpdateInterval = setInterval(async () => {
        const imgSrc = takeSnapshot();
        if (user && !isTerminated && imgSrc) { 
            try {
                const res = await fetch('/api/live', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'heartbeat', studentId, examId, payload: { studentId, snapshot: imgSrc } }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data?.messages?.length > 0) {
                        data.data.messages.forEach((msg: string) => { grantImmunity(); toast({ title: 'Mensaje del Supervisor', description: msg }); });
                    }
                }
            } catch (error) { 
                // [RESILIENCIA]: Si el heartbeat falla (red), no hacemos nada; el ciclo de recovery se encargará de los streams.
                console.warn("Heartbeat skip/error", error); 
            }
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

  // --- RENDERIZADO CORREGIDO ---
  // Si hay error fatal, mostramos tarjeta y nada más
  if (mediaError) return <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4"><Card className="border-destructive max-w-lg"><CardHeader><CardTitle className="text-destructive">Error de Monitoreo</CardTitle></CardHeader><CardContent><p>{mediaError}</p><Button onClick={() => window.location.reload()} className="w-full mt-4">Reintentar</Button></CardContent></Card></div>;

  const videoStyle = { width: '100%', height: '100%', objectFit: 'cover' as 'cover' };
  const cameraVideoStyle = { width: '100%', height: '100%', objectFit: 'cover' as 'cover', transform: 'scaleX(-1)' };

  return (
    <>
      {/* OVERLAY DE CARGA (Para no desmontar los videos debajo) */}
      {isLoading && step === 'monitoring' && (
        <div className="fixed inset-0 bg-background/90 flex flex-col items-center justify-center z-[60]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{loadingMessage}</p>
        </div>
      )}

      {/* ESPEJO FLOTANTE (Superior derecha, z-index alto) */}
      <div style={{ position: 'fixed', top: '80px', right: '20px', width: '280px', zIndex: 50 }} className="bg-black/90 border border-white/20 rounded-lg shadow-2xl overflow-hidden backdrop-blur-sm transition-all">
          <div className="flex justify-between items-center p-2 bg-[#161F45] text-white text-xs">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/> Grabando</span>
              <button onClick={() => setShowPreview(!showPreview)} className="hover:text-blue-300">
                  {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
          </div>

          <div className={`relative h-40 transition-opacity duration-300 ${showPreview ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <video 
                ref={screenVideoRef} 
                autoPlay 
                muted 
                playsInline 
                style={videoStyle} 
                className="absolute inset-0 bg-gray-900" 
              />
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
              <div className="fixed bottom-16 left-4 z-[90]"> 
                  <Dialog>
                      <DialogTrigger asChild>
                        {/* [CORRECCIÓN DE DISEÑO]: Botón Ayuda en índigo/info */}
                        <Button 
                          variant="default" 
                          className="shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                        >
                            <Phone className="mr-2 h-4 w-4" />
                            Ayuda
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                              <Phone className="h-5 w-5 text-indigo-600" />
                              Solicitar Ayuda al Supervisor
                            </DialogTitle>
                            <DialogDescription>
                              Describe el problema que estás experimentando. Un supervisor revisará tu solicitud lo antes posible a través del chat interno de la plataforma.
                            </DialogDescription>
                          </DialogHeader>
                          <Textarea 
                            value={helpMessage} 
                            onChange={(e) => setHelpMessage(e.target.value)} 
                            placeholder="Ej: Mi pantalla se puso negra o tengo un problema con una pregunta del examen..." 
                            rows={5}
                            className="resize-none"
                          />
                          <DialogFooter>
                            <Button 
                              onClick={handleRequestHelp} 
                              disabled={isRequestingHelp || !helpMessage.trim()}
                              className="bg-indigo-600 hover:bg-indigo-700"
                            >
                              {isRequestingHelp ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                  <Send className="mr-2 h-4 w-4" />
                              )}
                              Enviar Solicitud
                            </Button>
                          </DialogFooter>
                      </DialogContent>
                  </Dialog>
              </div>
            )}
          </>
        );
      }