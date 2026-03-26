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
import {
  initAICoordinator,
  startDetection,
  stopDetection,
  disposeAICoordinator,
  type AIAlert,
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

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

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

  // ── Media / WebRTC refs ────────────────────────────────────────────────────
  const videoRef          = useRef<HTMLVideoElement>(null); // ← camera (webcam) — AI always reads this
  const screenVideoRef    = useRef<HTMLVideoElement>(null); // ← screen share (PiP background)
  const streamRef         = useRef<MediaStream | null>(null);
  const screenStreamRef   = useRef<MediaStream | null>(null);
  const channelRef        = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const aiInitializedRef  = useRef(false);

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

  // Keep mirrors in sync on every render (cheap — no effect teardown/setup).
  useEffect(() => { setupPhaseRef.current = setupPhase; }, [setupPhase]);
  useEffect(() => { onReadyRef.current    = onReady; },    [onReady]);

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
    }).catch(err => console.error('[Alert] No se pudo persistir la alerta:', err));

    if (onAlert) onAlert(alertType, description, severity);
  }, [examId, studentId, onAlert]);

  // Keep ref in sync — this useEffect is cheap and harmless.
  useEffect(() => { sendAlertRef.current = sendAlert; }, [sendAlert]);

  // ── captureSnapshot ────────────────────────────────────────────────────────
  // Depends only on refs → always stable.
  const captureSnapshot = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width  = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    return canvas.toDataURL('image/jpeg', 0.4);
  }, []);

  // ── sendAlertWithSnapshot ──────────────────────────────────────────────────
  const sendSnapshotWithReason = useCallback((_reason: string) => {
    captureSnapshot();
  }, [captureSnapshot]);

  const sendAlertWithSnapshot = useCallback((
    alertType: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ) => {
    sendAlert(alertType, description, severity);
    sendSnapshotWithReason(`alert:${alertType}`);
  }, [sendAlert, sendSnapshotWithReason]);

  // ── AI callbacks — depend on sendAlert (OK, stable with memoized onAlert) ──
  const handleAIAlert = useCallback((alert: AIAlert) => {
    sendAlert(alert.type, alert.description, alert.severity);
  }, [sendAlert]);

  const handleAISnapshot = useCallback((reason: string) => {
    sendSnapshotWithReason(`ai:${reason}`);
  }, [sendSnapshotWithReason]);

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
  // hasCameraInitRef guards against React StrictMode double-invoke in dev.
  // All alert calls use sendAlertRef.current so they never go stale.
  useEffect(() => {
    if (hasCameraInitRef.current) return;
    hasCameraInitRef.current = true;

    const initCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('Tu navegador no permite acceder a la cámara.');
        sendAlertRef.current('camera_access_denied', 'API de cámara no disponible', 'critical');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true,
        });

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        setHasVideo(videoTrack?.enabled ?? false);
        setHasAudio(audioTrack?.enabled ?? false);
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
      } catch (error: any) {
        setErrorMessage(error.message || 'No se pudo acceder a la cámara');
        sendAlertRef.current('camera_access_denied', 'Acceso a cámara denegado', 'critical');
      }
    };

    initCamera();

    // Cleanup runs ONLY when the component truly unmounts, not on dep changes.
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []); // ← intentionally empty: mount/unmount only

  // ── AI init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enableAI || !hasVideo || !videoRef.current || aiInitializedRef.current) return;

    const initAI = async () => {
      try {
        setAiStatus('loading');
        await initAICoordinator();
        if (videoRef.current) {
          startDetection(videoRef.current, { onAlert: handleAIAlert, onRequestSnapshot: handleAISnapshot });
          aiInitializedRef.current = true;
          setAiStatus('active');
        }
      } catch {
        setAiStatus('error');
      }
    };

    const timer = setTimeout(initAI, 2000);
    return () => clearTimeout(timer);
  }, [enableAI, hasVideo, handleAIAlert, handleAISnapshot]);

  // ── AI cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (aiInitializedRef.current) {
        stopDetection();
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

    channel
      .on('broadcast', { event: 'webrtc-signaling' }, async ({ payload }: any) => {
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
            // Always up-to-date via ref — no stale closure risk.
            sendAlertRef.current('exam_closed', 'El examen ha sido cerrado por el instructor', 'low');
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

          if (!streamRef.current) return;

          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          peerConnectionRef.current = pc;

          streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));

          if (screenStreamRef.current) {
            screenStreamRef.current.getVideoTracks().forEach(track =>
              pc.addTrack(track, screenStreamRef.current!),
            );
          }

          pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
              channel.send({
                type:  'broadcast',
                event: 'webrtc-signaling',
                payload: {
                  type:   'ice-candidate',
                  fromId: studentId,
                  toId:   'instructor',
                  data:   candidate.toJSON(),
                },
              });
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          channel.send({
            type:  'broadcast',
            event: 'webrtc-signaling',
            payload: {
              type:   'offer',
              fromId: studentId,
              toId:   'instructor',
              data:   { type: offer.type, sdp: offer.sdp },
            },
          });

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
              <p className="text-sm">{errorMessage}</p>
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
          <Badge variant={hasAudio  ? 'default' : 'destructive'} className="text-xs">
            {hasAudio  ? <Mic        className="h-3 w-3" /> : <MicOff     className="h-3 w-3" />}
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
