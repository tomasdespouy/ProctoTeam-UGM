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
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { 
  initAICoordinator, 
  startDetection, 
  stopDetection, 
  disposeAICoordinator,
  type AIAlert 
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
  onReady
}: StudentCamProps) {
  const [isConnected, setIsConnected]     = useState(false);
  const [hasVideo, setHasVideo]           = useState(false);
  const [hasAudio, setHasAudio]           = useState(false);
  const [hasScreen, setHasScreen]         = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);
  const [aiStatus, setAiStatus]           = useState<'loading' | 'active' | 'error' | 'disabled'>('loading');
  const [setupPhase, setSetupPhase]       = useState<SetupPhase>('camera');
  const [screenBlocked, setScreenBlocked] = useState(false);
  const [screenError, setScreenError]     = useState<string | null>(null);
  
  const videoRef          = useRef<HTMLVideoElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const screenStreamRef   = useRef<MediaStream | null>(null);
  const channelRef        = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const aiInitializedRef  = useRef(false);

  // Ref to always have the latest sendAlert without re-creating effects
  const sendAlertRef = useRef<(type: string, desc: string, sev: 'low' | 'medium' | 'high' | 'critical') => void>(
    () => {}
  );

  // ── captureSnapshot ───────────────────────────────────────────────────────
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

  // ── sendSnapshotWithReason ────────────────────────────────────────────────
  // Phase 3: snapshot captured locally. Broadcast transport added in Phase 4.
  const sendSnapshotWithReason = useCallback((_reason: string) => {
    captureSnapshot(); // keep local capture pipeline active for AI
  }, [captureSnapshot]);

  // ── sendAlert (persistent via HTTP POST → DB) ─────────────────────────────
  const sendAlert = useCallback((
    alertType: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    fetch('/api/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'alert',
        studentId,
        examId,
        description: `[${alertType}] ${description}`,
        severity,
      }),
    }).catch(err => console.error('[Alert] No se pudo persistir la alerta:', err));

    if (onAlert) onAlert(alertType, description, severity);
  }, [examId, studentId, onAlert]);

  // Keep ref in sync so async callbacks never capture a stale closure
  useEffect(() => { sendAlertRef.current = sendAlert; }, [sendAlert]);

  // ── sendAlertWithSnapshot ─────────────────────────────────────────────────
  const sendAlertWithSnapshot = useCallback((
    alertType: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    sendAlert(alertType, description, severity);
    sendSnapshotWithReason(`alert:${alertType}`);
  }, [sendAlert, sendSnapshotWithReason]);

  const handleAIAlert = useCallback((alert: AIAlert) => {
    sendAlert(alert.type, alert.description, alert.severity);
  }, [sendAlert]);

  const handleAISnapshot = useCallback((reason: string) => {
    sendSnapshotWithReason(`ai:${reason}`);
  }, [sendSnapshotWithReason]);

  const handleScreenShareEnded = useCallback(() => {
    setHasScreen(false);
    setScreenBlocked(true);
    sendAlertWithSnapshot('screen_share_ended', 'El estudiante dejó de compartir pantalla', 'critical');
  }, [sendAlertWithSnapshot]);

  // ── addScreenTrackToWebRTC ────────────────────────────────────────────────
  // Called when screen share starts after WebRTC is already established.
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
      type: 'broadcast',
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

  // ── startScreenShare ──────────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    setScreenError(null);
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });

      screenStreamRef.current = screenStream;
      setHasScreen(true);
      setScreenBlocked(false);

      const videoTrack = screenStream.getVideoTracks()[0];
      videoTrack.addEventListener('ended', handleScreenShareEnded);

      if (peerConnectionRef.current && channelRef.current) {
        await addScreenTrackToWebRTC(screenStream);
      }

      if (setupPhase === 'screen') {
        setSetupPhase('ready');
        onReady?.();
      }

      return true;
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        setScreenError('Debes seleccionar una pantalla para compartir. Haz clic en el botón e intenta de nuevo.');
      } else if (error.name === 'NotFoundError') {
        setScreenError('No se encontró ninguna pantalla para compartir.');
      } else {
        setScreenError(error.message || 'Error al compartir pantalla');
      }
      return false;
    }
  }, [handleScreenShareEnded, setupPhase, onReady, addScreenTrackToWebRTC]);

  const restoreScreenShare = useCallback(async () => {
    const success = await startScreenShare();
    if (success) setScreenBlocked(false);
  }, [startScreenShare]);

  // ── Camera + microphone init ──────────────────────────────────────────────
  useEffect(() => {
    const initCamera = async () => {
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

        videoTrack?.addEventListener('ended', () => {
          setHasVideo(false);
          sendAlertWithSnapshot('camera_disabled', 'La cámara fue deshabilitada', 'high');
        });
        audioTrack?.addEventListener('ended', () => {
          setHasAudio(false);
          sendAlertWithSnapshot('microphone_disabled', 'El micrófono fue deshabilitado', 'medium');
        });
      } catch (error: any) {
        setErrorMessage(error.message || 'No se pudo acceder a la cámara');
        sendAlert('camera_access_denied', 'Acceso a cámara denegado', 'critical');
      }
    };

    initCamera();

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [sendAlert, sendAlertWithSnapshot]);

  // ── AI init ───────────────────────────────────────────────────────────────
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

  // ── AI cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (aiInitializedRef.current) {
        stopDetection();
        disposeAICoordinator();
        aiInitializedRef.current = false;
      }
    };
  }, []);

  // ── Supabase Broadcast channel + WebRTC signaling ─────────────────────────
  useEffect(() => {
    if (setupPhase !== 'ready') return;

    const channel = supabase.channel(`exam-room-${examId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'webrtc-signaling' }, async ({ payload }: any) => {
        // Route: only process messages addressed to this student
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
            sendAlertRef.current('exam_closed', 'El examen ha sido cerrado por el instructor', 'low');
            break;
          }
        }
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionStatus('connected');

          // 1. Announce presence to instructor
          channel.send({
            type: 'broadcast',
            event: 'webrtc-signaling',
            payload: { type: 'student-joined', fromId: studentId, toId: 'instructor', studentName, participationId },
          });

          // 2. Set up RTCPeerConnection
          if (!streamRef.current) return;

          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          peerConnectionRef.current = pc;

          // Add camera + microphone tracks
          streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));

          // Add screen share tracks if already active
          if (screenStreamRef.current) {
            screenStreamRef.current.getVideoTracks().forEach(track =>
              pc.addTrack(track, screenStreamRef.current!)
            );
          }

          // Trickle ICE: send candidates as they are gathered
          pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
              channel.send({
                type: 'broadcast',
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

          // 3. Create and send offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          channel.send({
            type: 'broadcast',
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
  useEffect(() => {
    if (setupPhase !== 'ready') return;

    const handleVisibilityChange = () => {
      if (document.hidden) sendAlertWithSnapshot('tab_switch', 'El estudiante cambió de pestaña', 'high');
    };
    const handleBlur = () => {
      sendAlertWithSnapshot('window_blur', 'El estudiante salió de la ventana', 'medium');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sendAlertWithSnapshot, setupPhase]);

  // ── AI status badge ───────────────────────────────────────────────────────
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

  // ── Render: screen-blocked modal ──────────────────────────────────────────
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

  // ── Render: screen sharing setup ──────────────────────────────────────────
  if (setupPhase === 'screen') {
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
            <p className="text-center text-sm text-gray-300 mb-6 max-w-sm">
              Para continuar con el examen, debes compartir tu pantalla completa.
              Esto es obligatorio para garantizar la integridad del examen.
            </p>
            <Button onClick={startScreenShare} size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Monitor className="h-5 w-5 mr-2" />
              Compartir Pantalla
            </Button>
            {screenError && <p className="mt-4 text-red-400 text-sm text-center">{screenError}</p>}
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

  // ── Render: active proctoring ─────────────────────────────────────────────
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-black relative">
        {errorMessage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-red-900/50">
            <VideoOff className="h-12 w-12 mb-2" />
            <p className="text-sm text-center px-4">{errorMessage}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        <div className="absolute top-2 left-2 flex gap-2 flex-wrap">
          <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
            {isConnected
              ? <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
              : <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>}
          </Badge>
          {getAIStatusBadge()}
        </div>

        <div className="absolute top-2 right-2 flex gap-1">
          <Badge variant={hasVideo  ? 'default' : 'destructive'} className="text-xs">
            {hasVideo  ? <Video    className="h-3 w-3" /> : <VideoOff  className="h-3 w-3" />}
          </Badge>
          <Badge variant={hasAudio  ? 'default' : 'destructive'} className="text-xs">
            {hasAudio  ? <Mic      className="h-3 w-3" /> : <MicOff    className="h-3 w-3" />}
          </Badge>
          <Badge variant={hasScreen ? 'default' : 'destructive'} className="text-xs">
            {hasScreen ? <Monitor  className="h-3 w-3" /> : <MonitorOff className="h-3 w-3" />}
          </Badge>
        </div>

        <div className="absolute bottom-2 left-2">
          <Badge variant="secondary" className="text-xs bg-black/50 text-white">{studentName}</Badge>
        </div>

        <div className="absolute bottom-2 right-2">
          {connectionStatus === 'connected' ? (
            <Badge className="bg-green-600 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" /> Transmitiendo
            </Badge>
          ) : connectionStatus === 'connecting' ? (
            <Badge className="bg-yellow-600 text-xs">
              <AlertCircle className="h-3 w-3 mr-1 animate-pulse" /> Conectando...
            </Badge>
          ) : (
            <Badge className="bg-red-600 text-xs">
              <AlertCircle className="h-3 w-3 mr-1" /> Error de conexión
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estado de proctoring</span>
          <Badge variant={hasVideo && hasAudio && hasScreen && isConnected ? 'default' : 'destructive'}>
            {hasVideo && hasAudio && hasScreen && isConnected ? 'Activo' : 'Incompleto'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
