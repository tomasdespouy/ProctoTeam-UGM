'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Brain,
  Monitor,
  MonitorOff,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { getIceServers } from '@/lib/ice-servers';
import { useAuth } from '@/context/auth-context';
import {
  initAICoordinator,
  startDetection,
  stopDetection,
  disposeAICoordinator,
  type AIAlert,
  type AICoordinatorCallbacks,
} from '@/lib/ai';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentCamProps {
  examId: string;
  studentId: string;
  studentName: string;
  participationId: string;
  enableAI?: boolean;
  onAlert?: (alertType: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical') => void;
  onReady?: () => void;
}

type SetupPhase = 'camera' | 'screen' | 'ready';

// ─── Component ────────────────────────────────────────────────────────────────

export function StudentCam({
  examId,
  studentId,
  studentName,
  participationId,
  enableAI = true,
  onAlert,
  onReady,
}: StudentCamProps) {
  // ── Auth — needed to attach Bearer token to /api/exam/evidence ────────────
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [isConnected,      setIsConnected]      = useState(false);
  const [hasVideo,         setHasVideo]         = useState(false);
  const [hasAudio,         setHasAudio]         = useState(false);
  const [hasScreen,        setHasScreen]        = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [errorMessage,     setErrorMessage]     = useState<string | null>(null);
  const [aiStatus,         setAiStatus]         = useState<'loading' | 'active' | 'error' | 'disabled'>('loading');
  const [setupPhase,       setSetupPhase]       = useState<SetupPhase>('camera');
  const [screenBlocked,    setScreenBlocked]    = useState(false);
  const [screenError,      setScreenError]      = useState<string | null>(null);
  /** True while draining in-flight ops after 'exam-closed' broadcast. */
  const [isSyncing,        setIsSyncing]        = useState(false);

  // ── Media / WebRTC refs ────────────────────────────────────────────────────
  const videoRef          = useRef<HTMLVideoElement>(null); // ← camera (webcam) — AI always reads this
  const screenVideoRef    = useRef<HTMLVideoElement>(null); // ← screen share (PiP background)
  const streamRef         = useRef<MediaStream | null>(null);
  const screenStreamRef   = useRef<MediaStream | null>(null);
  const channelRef        = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const aiInitializedRef  = useRef(false);

  // ── Grabación (MediaRecorder) refs ─────────────────────────────────────────
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunkIndexRef     = useRef(0);

  // ── Stable-value refs ──────────────────────────────────────────────────────
  // These let async/event callbacks always access the latest values without
  // being listed as useEffect/useCallback dependencies (which would cause
  // stale-closure chains and unwanted cleanups).

  /** Gate: camera hardware is requested exactly once on mount. */
  const hasCameraInitRef = useRef(false);

  /** Mirror of setupPhase state — readable from async callbacks without deps. */
  const setupPhaseRef = useRef<SetupPhase>('camera');

  /** Mirror of onReady prop — readable from async callbacks without deps. */
  const onReadyRef = useRef<(() => void) | undefined>(onReady);

  // ── Graceful Shutdown refs (Nivel 2) ──────────────────────────────────────
  /** Counts in-flight uploadSnapshot + sendAlertWithSnapshot fetch calls.
   *  Incremented at the START of each operation, decremented in finally{}.
   *  The exam-closed handler polls this until it reaches 0 (or timeout). */
  const pendingOpsRef = useRef(0);

  /** Set to true when an 'exam-closed' broadcast is received.
   *  uploadSnapshot checks this so new operations can log a warning. */
  const examClosingRef = useRef(false);

  /**
   * Latest sendAlert implementation. Kept in a ref so that async event
   * listeners and WebRTC callbacks always call the most-recent version without
   * having to list it as a dep (which would re-create effects).
   */
  const sendAlertRef = useRef<(
    type: string,
    desc: string,
    sev: 'low' | 'medium' | 'high' | 'critical'
  ) => void>(() => {});

  /**
   * Stale-closure fix for AI callbacks:
   * startDetection captures callbacks once at call time (setInterval closure).
   * If handleAIAlert or handleAISnapshot are recreated later (because their
   * deps changed), the interval would keep calling the stale versions.
   * By passing stable wrapper functions that always delegate to this ref,
   * the coordinator always calls the latest implementation.
   */
  const aiCallbacksRef = useRef<AICoordinatorCallbacks>({
    onAlert:          () => {},
    onRequestSnapshot: () => {},
  });

  // Keep mirrors in sync on every render (cheap — no effect teardown/setup).
  useEffect(() => { setupPhaseRef.current = setupPhase; }, [setupPhase]);
  useEffect(() => { onReadyRef.current    = onReady; },    [onReady]);
  // NOTE: aiCallbacksRef sync useEffect is declared AFTER handleAIAlert /
  // handleAISnapshot to avoid a Temporal Dead Zone crash (const TDZ).

  // ── Re-apply streams whenever <video> elements mount (phase transitions) ────
  // • videoRef      → camera  (webcam)   — AI always reads this element
  // • screenVideoRef→ screen share       — shown as PiP background in 'ready'
  // Both assignments run on every phase change so neither element ever loses
  // its srcObject when React replaces the DOM node during a phase transition.
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
    if (screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [setupPhase]);

  // ── sendAlert ──────────────────────────────────────────────────────────────
  // Recreates when examId, studentId, or onAlert changes — that is expected.
  // Consumers that must not trigger re-creates call sendAlertRef.current instead.
  const sendAlert = useCallback((
    alertType: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ) => {
    fetch('/api/live', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:      'alert',
        studentId,
        examId,
        description: `[${alertType}] ${description}`,
        severity,
      }),
    })
      .then(async res => {
        if (!res.ok) {
          const body = await res.text().catch(() => res.statusText);
          console.error(`[Alert] ⛔ API rechazó la alerta — HTTP ${res.status}:`, body);
        } else {
          console.debug(`[Alert] ✅ Alerta persistida: [${alertType}] severity=${severity}`);
        }
      })
      .catch(err => console.error('[Alert] 🔌 Error de red al persistir alerta:', err));

    if (onAlert) onAlert(alertType, description, severity);
  }, [examId, studentId, onAlert]);

  // Keep ref in sync — this useEffect is cheap and harmless.
  useEffect(() => { sendAlertRef.current = sendAlert; }, [sendAlert]);

  // ── captureSnapshot ────────────────────────────────────────────────────────
  // Composite evidence frame: screen share (640×360) as background +
  // webcam PiP (160×120) pinned to the top-right corner.
  // Falls back gracefully when either source is missing.
  // Depends only on refs → always stable (empty dep array).
  const captureSnapshot = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Layer 1 — Screen share as background
    if (screenVideoRef.current && screenStreamRef.current) {
      try { ctx.drawImage(screenVideoRef.current, 0, 0, 640, 360); } catch { /* ignore stale frame */ }
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#6b7280';
      ctx.font      = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pantalla no disponible', 320, 186);
    }

    // Layer 2 — Webcam PiP, top-right corner with red border
    if (videoRef.current && streamRef.current) {
      const pipW = 160, pipH = 120, margin = 8;
      const pipX = 640 - pipW - margin;
      const pipY = margin;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);
      try { ctx.drawImage(videoRef.current, pipX, pipY, pipW, pipH); } catch { /* ignore */ }
    }

    return canvas.toDataURL('image/jpeg', 0.5);
  }, []);

  // ── uploadSnapshot ─────────────────────────────────────────────────────────
  // Sends a Base64 JPEG to /api/exam/evidence (Supabase Storage).
  // Returns the public URL on success, null on any failure (non-blocking).
  //
  // Graceful Shutdown (Nivel 2): increments pendingOpsRef at entry and
  // decrements it in finally{} so the exam-closed drain loop can track it.
  const uploadSnapshot = useCallback(async (
    base64:    string,
    alertType: string,
  ): Promise<string | null> => {
    // Tarea 3 — abort immediately if the image is empty/missing
    if (!base64 || base64.length < 100) {
      console.error('[Evidence] ❌ captureSnapshot() devolvió un frame vacío — upload abortado.');
      return null;
    }

    // Graceful Shutdown: track this op so drain loop can wait for it
    pendingOpsRef.current += 1;
    if (examClosingRef.current) {
      console.warn(`[Evidence] ⏳ uploadSnapshot iniciado durante cierre de examen (ops pendientes: ${pendingOpsRef.current}). Completando antes de ceder.`);
    }

    try {
      // Tarea 1 — get auth token (same pattern as every other API call in the app)
      let token: string | null = null;
      try {
        token = user ? await user.getIdToken() : null;
      } catch (tokenErr) {
        console.error('[Evidence] ❌ No se pudo obtener el token de autenticación:', tokenErr);
      }

      if (!token) {
        console.error('[Evidence] ❌ Token nulo — el endpoint /api/exam/evidence devolverá 401. Revisa que la sesión esté activa.');
        return null;
      }

      const res = await fetch('/api/exam/evidence', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ snapshot: base64, participationId, alertType }),
      });

      // Tarea 1 — BUG 1: ya no fallo silencioso; leemos el body del error
      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        console.error(
          `[Evidence] ❌ HTTP ${res.status} desde /api/exam/evidence` +
          ` | alertType=${alertType} | participationId=${participationId}` +
          ` | body: ${errBody}`
        );
        return null;
      }

      const data = await res.json();
      const url = (data.publicUrl as string) ?? null;

      if (!url) {
        console.error('[Evidence] ⚠️ El endpoint respondió 2xx pero publicUrl está vacío:', data);
        return null;
      }

      console.debug(`[Evidence] ✅ Subida exitosa → ${url}`);
      return url;

    } catch (netErr) {
      // Tarea 1 — BUG 2: ya no catch silencioso
      console.error('[Evidence] ❌ Error de red al subir evidencia (fetch falló):', netErr);
      return null;
    } finally {
      // Always decrement — even on error — so drain loop never hangs
      pendingOpsRef.current -= 1;
    }
  }, [participationId, user]);

  // ── sendAlertWithSnapshot ──────────────────────────────────────────────────
  // • high / critical → composite capture → upload to Storage → alert + URL.
  // • low  / medium   → plain text alert only (no storage consumed).
  const sendAlertWithSnapshot = useCallback(async (
    alertType:   string,
    description: string,
    severity:    'low' | 'medium' | 'high' | 'critical' = 'medium',
  ) => {
    const needsEvidence = severity === 'high' || severity === 'critical';

    if (!needsEvidence) {
      sendAlert(alertType, description, severity);
      return;
    }

    const base64 = captureSnapshot();
    let evidenceUrl: string | undefined;

    if (base64) {
      const url = await uploadSnapshot(base64, alertType);
      if (url) evidenceUrl = url;
    }

    fetch('/api/live', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:      'alert',
        studentId,
        examId,
        description: `[${alertType}] ${description}`,
        severity,
        ...(evidenceUrl ? { evidenceUrl } : {}),
      }),
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          console.error(`[Alert+Evidence] ⛔ HTTP ${res.status}:`, text);
        } else {
          console.debug(`[Alert+Evidence] ✅ [${alertType}] severity=${severity}${evidenceUrl ? ' +evidence' : ' (upload failed)'}`);
        }
      })
      .catch(err => console.error('[Alert+Evidence] 🔌 Error de red:', err));

    if (onAlert) onAlert(alertType, description, severity);
  }, [examId, studentId, onAlert, sendAlert, captureSnapshot, uploadSnapshot]);

  // ── sendSnapshotWithReason (periodic AI snapshots) ─────────────────────────
  // Called by the AI coordinator's onRequestSnapshot for periodic frames.
  // Sends the composite Base64 as a heartbeat imgSrc to update
  // exam_participations.last_snapshot in the DB — no Supabase Storage used.
  const sendSnapshotWithReason = useCallback((reason: string) => {
    const base64 = captureSnapshot();
    if (!base64) return;
    fetch('/api/live', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'heartbeat', studentId, examId, imgSrc: base64 }),
    }).catch(err => console.debug('[Snapshot] Heartbeat error:', err));
    console.debug(`[Snapshot] Periodic frame sent — reason: ${reason}`);
  }, [examId, studentId, captureSnapshot]);

  // ── AI callbacks ────────────────────────────────────────────────────────────
  // handleAIAlert uses sendAlertWithSnapshot so high/critical detections
  // (celular, múltiples personas, etc.) automatically include photo evidence.
  const handleAIAlert = useCallback((alert: AIAlert) => {
    sendAlertWithSnapshot(alert.type, alert.description, alert.severity);
  }, [sendAlertWithSnapshot]);

  const handleAISnapshot = useCallback((reason: string) => {
    sendSnapshotWithReason(reason);
  }, [sendSnapshotWithReason]);

  // Keep AI callbacks ref in sync — declared HERE (after handleAIAlert /
  // handleAISnapshot) so the dependency array does not hit the TDZ.
  useEffect(() => {
    aiCallbacksRef.current = { onAlert: handleAIAlert, onRequestSnapshot: handleAISnapshot };
  }, [handleAIAlert, handleAISnapshot]);

  // ── addScreenTrackToWebRTC ─────────────────────────────────────────────────
  // Only dep is studentId (stable prop).
  const addScreenTrackToWebRTC = useCallback(async (screenStream: MediaStream) => {
    const pc      = peerConnectionRef.current;
    const channel = channelRef.current;
    if (!pc || !channel) return;

    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) return;

    pc.addTrack(screenTrack, screenStream);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channel.send({
      type:  'broadcast',
      event: 'webrtc-signaling',
      payload: {
        type:            'offer',
        fromId:          studentId,
        toId:            'instructor',
        data:            { type: offer.type, sdp: offer.sdp },
        isRenegotiation: true,
      },
    });
  }, [studentId]);

  // ── startScreenShare ───────────────────────────────────────────────────────
  // FIX: reads setupPhaseRef and onReadyRef (instead of reactive state/prop)
  // so the callback is never recreated due to phase changes or prop reference
  // churn. Only truly-changing dep: addScreenTrackToWebRTC.
  const startScreenShare = useCallback(async () => {
    setScreenError(null);

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenError(
        'Tu navegador o entorno no permite compartir pantalla. ' +
        'Abre la aplicación en una pestaña directa del navegador (no en un iframe o vista previa).',
      );
      return false;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      setHasScreen(true);
      setScreenBlocked(false);

      // Use ref so this listener never captures a stale onAlert/onReady.
      const videoTrack = screenStream.getVideoTracks()[0];
      videoTrack.addEventListener('ended', () => {
        setHasScreen(false);
        setScreenBlocked(true);
        sendAlertRef.current('screen_share_ended', 'El estudiante dejó de compartir pantalla', 'critical');
      });

      if (peerConnectionRef.current && channelRef.current) {
        await addScreenTrackToWebRTC(screenStream);
      }

      // Read refs — no reactive deps needed here.
      if (setupPhaseRef.current === 'screen') {
        setSetupPhase('ready');
        onReadyRef.current?.();
      }

      return true;
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        setScreenError(
          'Permiso denegado. Debes seleccionar una fuente en el cuadro de diálogo y hacer clic en "Compartir". ' +
          'Si el cuadro no apareció, asegúrate de abrir la app en una pestaña del navegador (no en una vista previa).',
        );
      } else if (error.name === 'NotFoundError') {
        setScreenError('No se encontró ninguna pantalla disponible para compartir.');
      } else if (error.name === 'InvalidStateError') {
        setScreenError('Estado inválido. Por favor recarga la página e intenta de nuevo.');
      } else {
        setScreenError(
          (error.message || 'Error desconocido al compartir pantalla.') +
          ' Asegúrate de usar una pestaña directa del navegador con HTTPS.',
        );
      }
      return false;
    }
  }, [addScreenTrackToWebRTC]); // ← no setupPhase, no onReady, no handleScreenShareEnded

  const restoreScreenShare = useCallback(async () => {
    const success = await startScreenShare();
    if (success) setScreenBlocked(false);
  }, [startScreenShare]);

  // ── Camera + microphone init ───────────────────────────────────────────────
  // FIX: empty deps [] → runs exactly once on mount, cleans up only on unmount.
  // startCamera — pide cámara+micrófono con REINTENTO automático.
  // "Timeout starting video source" / NotReadableError suelen ser transitorios
  // (cámara ocupada por otra app/pestaña, o despertando): reintentamos con backoff.
  // NotAllowedError (permiso denegado) NO se reintenta. Puede invocarse manualmente
  // desde el botón "Reintentar".
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Tu navegador no permite acceder a la cámara.');
      sendAlertRef.current('camera_access_denied', 'API de cámara no disponible', 'critical');
      return;
    }

    // Limpia cualquier intento previo antes de reintentar.
    streamRef.current?.getTracks().forEach(t => t.stop());

    const constraints: MediaStreamConstraints = {
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: true,
    };
    const MAX = 3;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        setHasVideo(videoTrack?.enabled ?? false);
        setHasAudio(audioTrack?.enabled ?? false);
        setErrorMessage(null);
        setSetupPhase('screen');

        // Use sendAlertRef.current — never stale, never causes effect to re-run.
        videoTrack?.addEventListener('ended', () => {
          setHasVideo(false);
          sendAlertRef.current('camera_disabled', 'La cámara fue deshabilitada', 'high');
        });
        audioTrack?.addEventListener('ended', () => {
          setHasAudio(false);
          sendAlertRef.current('microphone_disabled', 'El micrófono fue deshabilitado', 'medium');
        });
        return; // éxito
      } catch (error: any) {
        lastErr = error;
        const name = error?.name ?? '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setErrorMessage('Permiso de cámara denegado. Habilítalo en el navegador y reintenta.');
          sendAlertRef.current('camera_access_denied', 'Acceso a cámara denegado', 'critical');
          return;
        }
        console.warn(`[Camera] Intento ${attempt}/${MAX} falló: ${name || error?.message}`);
        if (attempt < MAX) {
          setErrorMessage(`Reintentando acceso a la cámara (${attempt}/${MAX})…`);
          await new Promise(r => setTimeout(r, attempt * 900));
        }
      }
    }

    const busy = lastErr?.name === 'NotReadableError' || /timeout|video source/i.test(lastErr?.message ?? '');
    setErrorMessage(
      busy
        ? 'No se pudo iniciar la cámara: parece estar en uso por otra app o pestaña. Cierra Zoom/Teams/otras pestañas y reintenta.'
        : (lastErr?.message || 'No se pudo acceder a la cámara.')
    );
    sendAlertRef.current('camera_access_denied', 'Acceso a cámara denegado tras reintentos', 'critical');
  }, []);

  // hasCameraInitRef guards against React StrictMode double-invoke in dev.
  // All alert calls use sendAlertRef.current so they never go stale.
  useEffect(() => {
    if (hasCameraInitRef.current) return;
    hasCameraInitRef.current = true;

    startCamera();

    // Cleanup runs ONLY when the component truly unmounts, not on dep changes.
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [startCamera]); // startCamera es estable (useCallback [])

  // ── Grabación de la sesión (B-bajo: webcam + audio, bitrate bajo) ───────────
  // Graba el stream de la cámara en chunks (timeslice) y los sube a Supabase
  // Storage durante el examen (resiliente ante desconexiones). ~0.4 Mbps.
  const uploadChunk = useCallback(async (blob: Blob, index: number) => {
    pendingOpsRef.current += 1;
    try {
      const token = user ? await user.getIdToken() : null;
      if (!token) return;
      const form = new FormData();
      form.append('chunk', blob, `${index}.webm`);
      form.append('participationId', participationId);
      form.append('index', String(index));
      const res = await fetch('/api/exam/recording', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => res.statusText);
        console.error(`[Rec] chunk ${index} HTTP ${res.status}:`, t);
      }
    } catch (err) {
      console.error('[Rec] error subiendo chunk', err);
    } finally {
      pendingOpsRef.current -= 1;
    }
  }, [user, participationId]);

  const startRecording = useCallback((stream: MediaStream) => {
    if (mediaRecorderRef.current) return;
    if (typeof MediaRecorder === 'undefined') {
      console.warn('[Rec] MediaRecorder no soportado — sin grabación');
      return;
    }
    const candidates = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mimeType = candidates.find(t => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    });
    try {
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 400_000, // ~0.4 Mbps (B-bajo)
        audioBitsPerSecond: 32_000,
      });
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) void uploadChunk(ev.data, chunkIndexRef.current++);
      };
      recorder.onerror = (e) => console.error('[Rec] error del recorder', e);
      recorder.start(15000); // un chunk cada 15 s
      mediaRecorderRef.current = recorder;
      console.debug('[Rec] grabación iniciada', mimeType ?? '(default)');
    } catch (err) {
      console.error('[Rec] no se pudo iniciar la grabación', err);
    }
  }, [uploadChunk]);

  // Inicia la grabación una vez que la webcam está activa.
  useEffect(() => {
    if (hasVideo && streamRef.current && !mediaRecorderRef.current) {
      startRecording(streamRef.current);
    }
  }, [hasVideo, startRecording]);

  // Detiene la grabación al desmontar (flushea el último chunk).
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch { /* noop */ }
      mediaRecorderRef.current = null;
    };
  }, []);

  // ── AI init ────────────────────────────────────────────────────────────────
  // Tarea 3: Gate AI on setupPhase === 'ready' so that:
  //   (a) videoRef.current always refers to the live camera <video> in the DOM
  //   (b) the video element has had time to start playing (readyState ≥ 2)
  // readyState meanings: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA
  // We need ≥ 2 before passing to TF.js / MediaPipe (they need actual pixel data).
  useEffect(() => {
    if (!enableAI || !hasVideo || aiInitializedRef.current) return;
    if (setupPhase !== 'ready') return; // camera <video> only in DOM during 'ready'

    const initAI = async () => {
      // ── Guard: camera element must be mounted and have pixel data ──────────
      const cam = videoRef.current;
      if (!cam) {
        console.warn('[AI] videoRef.current is null — camera not in DOM yet');
        return;
      }
      if (cam.readyState < 2) {
        // Not ready yet — wait for the 'canplay' event then retry
        console.warn('[AI] Camera readyState', cam.readyState, '< 2 — waiting for canplay');
        const onCanPlay = () => {
          cam.removeEventListener('canplay', onCanPlay);
          setTimeout(initAI, 200); // small debounce after canplay
        };
        cam.addEventListener('canplay', onCanPlay);
        return;
      }

      try {
        setAiStatus('loading');
        await initAICoordinator();
        // Re-check ref after async gap (component may have unmounted)
        if (videoRef.current && videoRef.current.readyState >= 2) {
          const cam = videoRef.current;
          console.info(
            '[AI] Starting detection — videoWidth:', cam.videoWidth,
            '| videoHeight:', cam.videoHeight,
            '| width attr:', cam.width,
            '| readyState:', cam.readyState,
          );
          // Use aiCallbacksRef wrappers so the setInterval closure always
          // calls the latest handleAIAlert/handleAISnapshot even if they
          // were recreated after startDetection() was first called.
          startDetection(cam, {
            onAlert:           (alert)  => aiCallbacksRef.current.onAlert(alert),
            onRequestSnapshot: (reason) => aiCallbacksRef.current.onRequestSnapshot(reason),
          });
          aiInitializedRef.current = true;
          setAiStatus('active');
          console.info('[AI] Detection started — pointing at camera videoRef');
        }
      } catch (err) {
        console.error('[AI] initAICoordinator failed:', err);
        setAiStatus('error');
      }
    };

    const timer = setTimeout(initAI, 2000);
    return () => clearTimeout(timer);
  }, [enableAI, hasVideo, setupPhase, handleAIAlert, handleAISnapshot]);

  // ── AI cleanup on unmount ──────────────────────────────────────────────────
  // FIX (Bug #2): Call stopDetection() unconditionally, not gated by
  // aiInitializedRef. If initAICoordinator() threw mid-way, isRunning might
  // be in an inconsistent state. Unconditional cleanup guarantees the module
  // singleton is always reset on unmount, preventing a zombie isRunning=true
  // that would silently block the next startDetection() call after remount.
  useEffect(() => {
    return () => {
      stopDetection();
      if (aiInitializedRef.current) {
        disposeAICoordinator();
        aiInitializedRef.current = false;
      }
    };
  }, []);

  // ── Supabase Broadcast channel + WebRTC signaling ──────────────────────────
  useEffect(() => {
    if (setupPhase !== 'ready') return;

    const channel = supabase.channel(`exam-room-${examId}`);
    channelRef.current = channel;

    // Construye la conexión WebRTC del alumno (tracks + handlers ICE).
    const buildPeer = async () => {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      streamRef.current?.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));
      if (screenStreamRef.current) {
        screenStreamRef.current.getVideoTracks().forEach(track =>
          pc.addTrack(track, screenStreamRef.current!),
        );
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          channel.send({
            type: 'broadcast', event: 'webrtc-signaling',
            payload: { type: 'ice-candidate', fromId: studentId, toId: 'instructor', data: candidate.toJSON() },
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          console.warn('[StudentCam] ICE', pc.iceConnectionState, '— reintentando oferta');
          void sendOffer(true);
        }
      };

      return pc;
    };

    // (Re)envía una oferta al instructor. Crea el peer si no existe. Se reintenta
    // cuando el instructor anuncia "instructor-ready", de modo que el video
    // conecte aunque el instructor haya entrado DESPUÉS que el alumno (la causa
    // del video en negro: la oferta inicial se perdía sin nadie escuchando).
    const sendOffer = async (isRenegotiation = false) => {
      if (!streamRef.current) return;
      try {
        const pc = peerConnectionRef.current ?? (await buildPeer());
        const offer = await pc.createOffer(isRenegotiation ? { iceRestart: true } : {});
        await pc.setLocalDescription(offer);
        channel.send({
          type: 'broadcast', event: 'webrtc-signaling',
          payload: {
            type: 'offer', fromId: studentId, toId: 'instructor',
            data: { type: offer.type, sdp: offer.sdp },
            ...(isRenegotiation ? { isRenegotiation: true } : {}),
          },
        });
      } catch (err) {
        console.error('[StudentCam] Error enviando oferta:', err);
      }
    };

    channel
      .on('broadcast', { event: 'webrtc-signaling' }, async ({ payload }: any) => {
        // El instructor anuncia que está listo → (re)enviamos la oferta si aún
        // no estamos conectados. Resuelve la carrera de "quién entró primero".
        if (payload.type === 'instructor-ready') {
          const pc = peerConnectionRef.current;
          const st = pc?.iceConnectionState;
          const needsOffer = !pc || pc.signalingState === 'have-local-offer'
            || st === 'failed' || st === 'disconnected' || st === 'closed';
          if (needsOffer) await sendOffer(!!pc);
          return;
        }

        if (payload.toId !== studentId) return;

        const pc = peerConnectionRef.current;

        switch (payload.type) {
          case 'answer': {
            if (pc && pc.signalingState !== 'stable') {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            }
            break;
          }
          case 'ice-candidate': {
            if (pc) {
              await pc.addIceCandidate(new RTCIceCandidate(payload.data)).catch(() => {});
            }
            break;
          }
          case 'exam-closed': {
            // ── Graceful Shutdown — Nivel 2 ─────────────────────────────────
            // Mark that the exam is closing so new uploads can log a warning.
            examClosingRef.current = true;
            setIsSyncing(true);

            // Drain loop: wait up to DRAIN_TIMEOUT_MS for in-flight
            // uploadSnapshot / sendAlertWithSnapshot fetches to finish.
            // Each tick waits 100 ms; the safety ceiling avoids hanging forever.
            const DRAIN_TIMEOUT_MS = 5_000;
            const drainStart = Date.now();
            console.log('[GracefulShutdown] exam-closed recibido — esperando ops pendientes:', pendingOpsRef.current);

            while (pendingOpsRef.current > 0 && (Date.now() - drainStart) < DRAIN_TIMEOUT_MS) {
              await new Promise(r => setTimeout(r, 100));
            }

            if (pendingOpsRef.current > 0) {
              console.warn(`[GracefulShutdown] ⚠️ Timeout alcanzado (${DRAIN_TIMEOUT_MS}ms) con ${pendingOpsRef.current} ops aún pendientes. Procediendo de todas formas.`);
            } else {
              console.log(`[GracefulShutdown] ✅ Todas las operaciones drenadas en ${Date.now() - drainStart}ms.`);
            }

            setIsSyncing(false);

            // Always up-to-date via ref — no stale closure risk.
            sendAlertRef.current('exam_closed', 'El examen ha sido cerrado por el instructor', 'low');
            break;
          }

          // Instructor pidió renegociar (detectó fallo de ICE).
          case 'request-renegotiation': {
            await sendOffer(true);
            break;
          }
        }
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionStatus('connected');

          channel.send({
            type:  'broadcast',
            event: 'webrtc-signaling',
            payload: { type: 'student-joined', fromId: studentId, toId: 'instructor', studentName, participationId },
          });

          await sendOffer(false);

        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionStatus('failed');
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          setConnectionStatus('connecting');
        }
      });

    return () => {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [examId, studentId, studentName, participationId, setupPhase]);

  // ── Snapshot de respaldo periódico ─────────────────────────────────────────
  // Garantiza que el docente vea frames recientes aunque WebRTC no logre
  // conectar (redes tras NAT/firewall sin servidor TURN → video en negro).
  // Envía un heartbeat con imagen compuesta cada ~8s; ProctorView lo muestra
  // como `lastSnapshot` cuando no hay stream WebRTC.
  useEffect(() => {
    if (setupPhase !== 'ready') return;
    sendSnapshotWithReason('periodic-fallback'); // uno de inmediato
    const id = setInterval(() => sendSnapshotWithReason('periodic-fallback'), 8000);
    return () => clearInterval(id);
  }, [setupPhase, sendSnapshotWithReason]);

  // ── Tab switch / window blur alerts ───────────────────────────────────────
  // FIX: removed sendAlertWithSnapshot from deps — use sendAlertRef.current instead.
  useEffect(() => {
    if (setupPhase !== 'ready') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendAlertRef.current('tab_switch', 'El estudiante cambió de pestaña', 'high');
      }
    };
    const handleBlur = () => {
      sendAlertRef.current('window_blur', 'El estudiante salió de la ventana', 'medium');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [setupPhase]); // ← only setupPhase gates this; no sendAlert dep

  // ── AI status badge ────────────────────────────────────────────────────────
  const getAIStatusBadge = () => {
    if (!enableAI) return null;
    switch (aiStatus) {
      case 'loading':
        return <Badge className="bg-yellow-600 text-xs"><Brain className="h-3 w-3 mr-1 animate-pulse" /> IA Cargando</Badge>;
      case 'active':
        return <Badge className="bg-purple-600 text-xs"><Brain className="h-3 w-3 mr-1" /> IA Activa</Badge>;
      case 'error':
        return <Badge className="bg-red-600 text-xs"><Brain className="h-3 w-3 mr-1" /> IA Error</Badge>;
      default:
        return null;
    }
  };

  // ── Render: screen-blocked modal ───────────────────────────────────────────
  if (screenBlocked) {
    return (
      <div className="fixed inset-0 z-50 bg-red-900/95 flex items-center justify-center">
        <div className="max-w-md mx-auto p-8 text-center text-white">
          <AlertTriangle className="h-20 w-20 mx-auto mb-6 animate-pulse" />
          <h2 className="text-2xl font-bold mb-4">Conexión de Pantalla Perdida</h2>
          <p className="text-lg mb-6">
            Se ha perdido la conexión con tu pantalla compartida.
            Debes volver a compartir inmediatamente para continuar con el examen.
          </p>
          <Button onClick={restoreScreenShare} size="lg" className="bg-white text-red-900 hover:bg-gray-100">
            <Monitor className="h-5 w-5 mr-2" />
            Compartir Pantalla Nuevamente
          </Button>
          {screenError && <p className="mt-4 text-yellow-300 text-sm">{screenError}</p>}
        </div>
      </div>
    );
  }

  // ── Render: screen sharing setup ───────────────────────────────────────────
  if (setupPhase === 'screen') {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    const canShare   = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

    return (
      <Card className="overflow-hidden">
        <div className="aspect-video bg-black relative">
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-6">
            <Monitor className="h-16 w-16 mb-4" />
            <h3 className="text-xl font-bold mb-2">Compartir Pantalla Requerido</h3>
            <p className="text-center text-sm text-gray-300 mb-4 max-w-sm">
              Para continuar, debes compartir tu pantalla completa.
              Esto es obligatorio para garantizar la integridad del examen.
            </p>

            {(isInIframe || !canShare) && (
              <div className="mb-4 px-4 py-3 bg-yellow-600/80 rounded-lg text-yellow-100 text-xs text-center max-w-sm">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Para compartir pantalla abre la app en una{' '}
                <span className="font-bold underline">pestaña directa del navegador</span>{' '}
                (no en una vista previa o iframe).
              </div>
            )}

            <Button
              onClick={startScreenShare}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!canShare}
            >
              <Monitor className="h-5 w-5 mr-2" />
              Compartir Pantalla
            </Button>

            {screenError && (
              <div className="mt-4 px-4 py-3 bg-red-900/80 rounded-lg text-red-200 text-xs text-center max-w-sm">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                {screenError}
              </div>
            )}
          </div>
        </div>
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Paso 2 de 2: Compartir pantalla</span>
            <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" /> Cámara lista</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Render: camera permissions pending ────────────────────────────────────
  if (setupPhase === 'camera') {
    return (
      <Card className="overflow-hidden">
        <div className="aspect-video bg-black relative flex items-center justify-center">
          {errorMessage ? (
            <div className="text-white text-center px-4">
              <VideoOff className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm mb-3">{errorMessage}</p>
              <button
                onClick={() => startCamera()}
                className="px-4 py-1.5 text-sm rounded-md bg-white/10 hover:bg-white/20 border border-white/30 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="text-white text-center">
              <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
              <p>Solicitando acceso a cámara y micrófono...</p>
            </div>
          )}
        </div>
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Paso 1 de 2: Permisos de cámara</span>
            <Badge variant="secondary">Esperando...</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Render: active proctoring — Picture-in-Picture ────────────────────────
  // Background: screen share (screenVideoRef / screenStreamRef)
  // Floating PiP: webcam (videoRef / streamRef) — AI reads this element
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-black relative">

        {/* ── Graceful Shutdown overlay (Nivel 2) ── */}
        {/* Shown while draining in-flight evidence uploads after exam-closed.   */}
        {/* z-30 puts it above error overlay (z-20) and PiP camera (z-10).      */}
        {isSyncing && (
          <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center text-white text-center px-6">
            <div className="h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-5" />
            <p className="text-lg font-semibold leading-tight">
              Examen finalizado por el instructor
            </p>
            <p className="text-sm text-white/70 mt-2 leading-relaxed">
              Sincronizando reportes finales...
              <br />
              <span className="font-medium text-yellow-300">No cierres esta pestaña.</span>
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-red-900/50 z-20">
            <VideoOff className="h-12 w-12 mb-2" />
            <p className="text-sm text-center px-4">{errorMessage}</p>
          </div>
        )}

        {/* ── Main background: screen share ── */}
        <video
          ref={screenVideoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* ── PiP overlay: webcam (top-right) — AI target ── */}
        <video
          ref={videoRef}
          autoPlay playsInline muted
          width={320}
          height={240}
          className="absolute top-3 right-3 w-40 aspect-video rounded-lg shadow-xl border-2 border-white/20 object-cover z-10"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* ── Status badges — bottom-left ── */}
        <div className="absolute bottom-2 left-2 flex gap-1 z-10">
          <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
            {isConnected
              ? <><Wifi    className="h-3 w-3 mr-1" /> En vivo</>
              : <><WifiOff className="h-3 w-3 mr-1" /> Sin red</>}
          </Badge>
          {getAIStatusBadge()}
        </div>

        {/* ── Device icons — bottom-right ── */}
        <div className="absolute bottom-2 right-2 flex gap-1 z-10">
          <Badge variant={hasVideo  ? 'default' : 'destructive'} className="text-xs">
            {hasVideo  ? <Video      className="h-3 w-3" /> : <VideoOff   className="h-3 w-3" />}
          </Badge>
          <Badge variant={hasScreen ? 'default' : 'destructive'} className="text-xs">
            {hasScreen ? <Monitor    className="h-3 w-3" /> : <MonitorOff className="h-3 w-3" />}
          </Badge>
        </div>

        {/* ── Connection status — top-left ── */}
        <div className="absolute top-2 left-2 z-10">
          {connectionStatus === 'connected' ? (
            <Badge className="bg-green-600/90 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" /> Transmitiendo
            </Badge>
          ) : connectionStatus === 'connecting' ? (
            <Badge className="bg-yellow-600/90 text-xs">
              <AlertCircle className="h-3 w-3 mr-1 animate-pulse" /> Conectando...
            </Badge>
          ) : (
            <Badge className="bg-red-600/90 text-xs">
              <WifiOff className="h-3 w-3 mr-1" /> Sin conexión
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Monitoreo activo — {studentName}</span>
          <span className="flex items-center gap-2">
            {hasScreen && <span className="text-green-600 font-medium flex items-center gap-1"><Monitor className="h-3 w-3" /> Pantalla compartida</span>}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
