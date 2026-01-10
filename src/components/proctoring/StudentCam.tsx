'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Wifi, 
  WifiOff,
  AlertCircle,
  CheckCircle,
  Brain
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { 
  initAICoordinator, 
  startDetection, 
  stopDetection, 
  disposeAICoordinator,
  type AIAlert 
} from '@/lib/ai';

interface StudentCamProps {
  examId: string;
  studentId: string;
  studentName: string;
  participationId: string;
  enableAI?: boolean;
  onAlert?: (alertType: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical') => void;
}

export function StudentCam({ 
  examId, 
  studentId, 
  studentName, 
  participationId,
  enableAI = true,
  onAlert 
}: StudentCamProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'loading' | 'active' | 'error' | 'disabled'>('loading');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const aiInitializedRef = useRef(false);

  const captureSnapshot = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    return canvas.toDataURL('image/jpeg', 0.4);
  }, []);

  const sendSnapshotWithReason = useCallback((reason: string) => {
    const snapshot = captureSnapshot();
    if (snapshot && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('student:snapshot', {
        examId,
        studentId,
        snapshot,
        reason,
        timestamp: new Date().toISOString(),
      });
    }
  }, [examId, studentId, captureSnapshot]);

  const sendAlert = useCallback((
    alertType: string, 
    description: string, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('alert:new', {
        examId,
        studentId,
        participationId,
        alertType,
        severity,
        description,
        timestamp: new Date().toISOString(),
      });
    }
    if (onAlert) {
      onAlert(alertType, description, severity);
    }
  }, [examId, studentId, participationId, onAlert]);

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

  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: true,
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        
        setHasVideo(videoTrack?.enabled ?? false);
        setHasAudio(audioTrack?.enabled ?? false);

        videoTrack?.addEventListener('ended', () => {
          setHasVideo(false);
          sendAlertWithSnapshot('camera_disabled', 'La cámara fue deshabilitada', 'high');
        });

        audioTrack?.addEventListener('ended', () => {
          setHasAudio(false);
          sendAlertWithSnapshot('microphone_disabled', 'El micrófono fue deshabilitado', 'medium');
        });

      } catch (error: any) {
        console.error('Error accessing camera:', error);
        setErrorMessage(error.message || 'No se pudo acceder a la cámara');
        sendAlert('camera_access_denied', 'Acceso a cámara denegado', 'critical');
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [sendAlert, sendAlertWithSnapshot]);

  useEffect(() => {
    if (!enableAI || !hasVideo || !videoRef.current || aiInitializedRef.current) return;

    const initAI = async () => {
      try {
        setAiStatus('loading');
        await initAICoordinator();
        
        if (videoRef.current) {
          startDetection(videoRef.current, {
            onAlert: handleAIAlert,
            onRequestSnapshot: handleAISnapshot,
          });
          aiInitializedRef.current = true;
          setAiStatus('active');
        }
      } catch (error) {
        console.error('Error initializing AI:', error);
        setAiStatus('error');
      }
    };

    const timer = setTimeout(initAI, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [enableAI, hasVideo, handleAIAlert, handleAISnapshot]);

  useEffect(() => {
    return () => {
      if (aiInitializedRef.current) {
        stopDetection();
        disposeAICoordinator();
        aiInitializedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    const socket = io({
      path: '/api/socket',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      
      socket.emit('student:join-exam', {
        examId,
        studentId,
        studentName,
        participationId,
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setConnectionStatus('connecting');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('failed');
    });

    socket.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(data.answer);
      }
    });

    socket.on('webrtc:ice-candidate', (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on('exam:closed', () => {
      sendAlert('exam_closed', 'El examen ha sido cerrado por el instructor', 'low');
    });

    socket.on('instructor:disconnected', () => {
    });

    socket.on('instructor:request-snapshot', () => {
      sendSnapshotWithReason('instructor_request');
    });

    socket.on('ai:request-snapshot', (data: { reason: string }) => {
      sendSnapshotWithReason(`ai:${data.reason}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [examId, studentId, studentName, participationId, sendAlert, sendSnapshotWithReason]);

  useEffect(() => {
    if (!isConnected || !streamRef.current || !socketRef.current) return;

    const initWebRTC = async () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      peerConnectionRef.current = pc;

      streamRef.current!.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc:ice-candidate', {
            examId,
            fromId: studentId,
            candidate: event.candidate,
            isInstructor: false,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current!.emit('webrtc:offer', {
        examId,
        fromStudentId: studentId,
        offer,
      });
    };

    initWebRTC();

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [isConnected, examId, studentId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendAlertWithSnapshot('tab_switch', 'El estudiante cambió de pestaña', 'high');
      }
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
  }, [sendAlertWithSnapshot]);

  const getAIStatusBadge = () => {
    if (!enableAI) return null;
    
    switch (aiStatus) {
      case 'loading':
        return (
          <Badge className="bg-yellow-600 text-xs">
            <Brain className="h-3 w-3 mr-1 animate-pulse" /> IA Cargando
          </Badge>
        );
      case 'active':
        return (
          <Badge className="bg-purple-600 text-xs">
            <Brain className="h-3 w-3 mr-1" /> IA Activa
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-600 text-xs">
            <Brain className="h-3 w-3 mr-1" /> IA Error
          </Badge>
        );
      default:
        return null;
    }
  };

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
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        <div className="absolute top-2 left-2 flex gap-2">
          <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
            {isConnected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
            )}
          </Badge>
          {getAIStatusBadge()}
        </div>

        <div className="absolute top-2 right-2 flex gap-1">
          <Badge variant={hasVideo ? 'default' : 'destructive'} className="text-xs">
            {hasVideo ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
          </Badge>
          <Badge variant={hasAudio ? 'default' : 'destructive'} className="text-xs">
            {hasAudio ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          </Badge>
        </div>

        <div className="absolute bottom-2 left-2">
          <Badge variant="secondary" className="text-xs bg-black/50 text-white">
            {studentName}
          </Badge>
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
          <Badge variant={hasVideo && hasAudio && isConnected ? 'default' : 'destructive'}>
            {hasVideo && hasAudio && isConnected ? 'Activo' : 'Incompleto'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
