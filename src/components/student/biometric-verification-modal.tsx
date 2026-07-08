"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Check, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { extractIdCardName } from '@/ai/flows/verify-student-identity';
import { useAuth } from '@/context/auth-context';
import { StepProgress } from './step-progress';

interface BiometricVerificationModalProps {
  isOpen: boolean;
  onVerificationSuccess: () => void;
  examId: string;
  studentId: string;
  studentName: string;
  participationId: string;
}

type ExtractionResult = {
  detectedName: string;
  documentNumber: string;
  matchesExpected: boolean;
  readable: boolean;
  notes: string;
};

// ─── Geometría del marco de la Cédula (TESTEO — ajustable) ─────────────────────
const CI_ASPECT = 1.585;        // ancho / alto de la cédula (85.6 × 54 mm)
const FRAME_WIDTH_FRAC = 0.80;  // ancho del marco como fracción del ancho del video

// Zonas que SÍ se revelan, normalizadas 0..1 DENTRO del marco de la cédula.
const REVEAL_ZONES: { x: number; y: number; w: number; h: number; label: string }[] = [
  { x: 0.05, y: 0.28, w: 0.29, h: 0.66, label: 'Foto'   },
  { x: 0.37, y: 0.12, w: 0.60, h: 0.33, label: 'Nombre' },
];

function frameHeightFrac(videoAspect: number): number {
  return Math.min(0.94, FRAME_WIDTH_FRAC * videoAspect / CI_ASPECT);
}

export function BiometricVerificationModal({ isOpen, onVerificationSuccess, examId, studentId, studentName, participationId }: BiometricVerificationModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zoneVideos = useRef<(HTMLVideoElement | null)[]>([]);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [idCardPhoto, setIdCardPhoto] = useState<string | null>(null); // ← ya enmascarada
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoAspect, setVideoAspect] = useState(4 / 3);

  // Adjunta el stream a todos los <video> (fondo difuminado + ventanas nítidas).
  const attachStream = useCallback(() => {
    const s = streamRef.current;
    if (videoRef.current && videoRef.current.srcObject !== s) videoRef.current.srcObject = s;
    zoneVideos.current.forEach(v => { if (v && v.srcObject !== s) v.srcObject = s; });
  }, []);

  const startCamera = useCallback(async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    const MAX = 3;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } } });
        streamRef.current = stream;
        attachStream();
        setHasCameraPermission(true);
        return;
      } catch (err: any) {
        lastErr = err;
        const name = err?.name ?? '';
        if (name === 'NotAllowedError' || name === 'SecurityError') break;
        console.warn(`[Biometric] Cámara intento ${attempt}/${MAX} falló: ${name || err?.message}`);
        if (attempt < MAX) await new Promise(r => setTimeout(r, attempt * 800));
      }
    }
    console.error('Error accessing camera:', lastErr);
    setHasCameraPermission(false);
  }, [attachStream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setIdCardPhoto(null);
      setResult(null);
      setError(null);
      setIsLoading(false);
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [isOpen, startCamera]);

  const takePhoto = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    const W = video.videoWidth, H = video.videoHeight;
    const fwFrac = FRAME_WIDTH_FRAC;
    const fhFrac = frameHeightFrac(W / H);
    const fx = ((1 - fwFrac) / 2) * W;
    const fy = ((1 - fhFrac) / 2) * H;
    const fw = fwFrac * W;
    const fh = fhFrac * H;

    // 1) Recorte completo del marco → SOLO para el OCR (no se guarda).
    canvas.width = fw;
    canvas.height = fh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, fx, fy, fw, fh, 0, 0, fw, fh);
    const fullCrop = canvas.toDataURL('image/jpeg', 0.85);

    // 2) Versión ENMASCARADA (solo foto + nombre) → ESTA es la que se guarda.
    const mask = document.createElement('canvas');
    mask.width = fw;
    mask.height = fh;
    const mctx = mask.getContext('2d');
    if (mctx) {
      mctx.fillStyle = '#ffffff';
      mctx.fillRect(0, 0, fw, fh);
      for (const z of REVEAL_ZONES) {
        const sx = fx + z.x * fw, sy = fy + z.y * fh, sw = z.w * fw, sh = z.h * fh;
        const dx = z.x * fw, dy = z.y * fh, dw = z.w * fw, dh = z.h * fh;
        try { mctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh); } catch { /* frame inestable */ }
      }
    }
    const maskedCrop = mask.toDataURL('image/jpeg', 0.85);

    setIdCardPhoto(maskedCrop);
    setIsLoading(true);
    setError(null);

    try {
      const res = await extractIdCardName({ idCardPhoto: fullCrop, expectedName: studentName });
      if (!res.readable || !res.detectedName) {
        setError('No pudimos leer el documento. Alinea la cédula dentro del marco, sin reflejos ni desenfoque, e intenta de nuevo.');
        setIdCardPhoto(null);
      } else {
        setResult(res);
      }
    } catch {
      setError('Ocurrió un error al procesar el documento. Por favor, intenta de nuevo.');
      setIdCardPhoto(null);
    } finally {
      setIsLoading(false);
    }
  }, [studentName]);

  const retake = () => {
    setIdCardPhoto(null);
    setResult(null);
    setError(null);
  };

  const confirm = async () => {
    setUploading(true);
    try {
      const token = user ? await user.getIdToken() : null;
      if (token && idCardPhoto) {
        const evRes = await fetch('/api/exam/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ snapshot: idCardPhoto, participationId, alertType: 'identidad' }),
        });
        const evData = await evRes.json().catch(() => ({}));
        const evidenceUrl: string | undefined = evData?.publicUrl;

        if (examId && studentId) {
          const matches = result?.matchesExpected ?? true;
          const detected = result?.detectedName ? `"${result.detectedName}"` : '(no leído)';
          const description = matches
            ? `Verificación de identidad OK — documento ${detected}`
            : `Verificación de identidad: el documento ${detected} NO coincide con el nombre registrado (${studentName})`;

          await fetch('/api/live', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: 'alert',
              payload: { examId, studentId, description, severity: matches ? 'info' : 'warning', evidenceUrl },
            }),
          });
        }
      }
    } catch (err) {
      console.error('[Identidad] No se pudo guardar la evidencia de identidad:', err);
    } finally {
      setUploading(false);
    }
    toast({
      title: 'Identidad confirmada',
      description: 'Gracias. Ahora, por favor, continúa con los requisitos del examen.',
    });
    onVerificationSuccess();
  };

  // ── Geometría del marco / zonas (en %) ─────────────────────────────────────
  const fhFrac    = frameHeightFrac(videoAspect);
  const frameLeft = (1 - FRAME_WIDTH_FRAC) / 2;
  const frameTop  = (1 - fhFrac) / 2;
  const frameStyle = {
    left:   `${frameLeft * 100}%`,
    top:    `${frameTop * 100}%`,
    width:  `${FRAME_WIDTH_FRAC * 100}%`,
    height: `${fhFrac * 100}%`,
  } as React.CSSProperties;

  const liveOverlay = !idCardPhoto && hasCameraPermission && !isLoading;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <StepProgress current={2} />
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline text-primary">Verificación de Identidad</DialogTitle>
          <DialogDescription>
            Coloca tu <strong>cédula</strong> dentro del marco. Solo se ven (y se guardan) las zonas <strong>verdes</strong> — tu <strong>foto y nombre</strong>; el resto queda difuminado. Cuando esté bien alineada, presiona <strong>Capturar</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className="relative w-full rounded-lg border bg-muted overflow-hidden"
            style={{ aspectRatio: videoAspect }}
          >
            {/* Fondo: video DIFUMINADO (la captura sigue leyendo el frame nítido) */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover transition-opacity ${idCardPhoto ? 'opacity-0' : 'opacity-100'}`}
              style={{ filter: idCardPhoto ? 'none' : 'blur(7px) brightness(0.88)' }}
              autoPlay muted playsInline
              onLoadedMetadata={() => {
                const v = videoRef.current;
                if (v?.videoWidth) setVideoAspect(v.videoWidth / v.videoHeight);
              }}
            />

            {/* Ventanas NÍTIDAS: una copia del video recortada a cada zona verde */}
            {liveOverlay && REVEAL_ZONES.map((z, i) => {
              const ax = frameLeft + z.x * FRAME_WIDTH_FRAC;
              const ay = frameTop + z.y * fhFrac;
              const aw = z.w * FRAME_WIDTH_FRAC;
              const ah = z.h * fhFrac;
              const inset = `inset(${ay * 100}% ${(1 - ax - aw) * 100}% ${(1 - ay - ah) * 100}% ${ax * 100}%)`;
              return (
                <video
                  key={`zone-${i}`}
                  ref={el => { zoneVideos.current[i] = el; if (el && streamRef.current) el.srcObject = streamRef.current; }}
                  autoPlay muted playsInline
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ clipPath: inset, WebkitClipPath: inset as any }}
                />
              );
            })}

            {/* Marco punteado + bordes verdes + etiquetas */}
            {liveOverlay && (
              <div className="absolute pointer-events-none" style={frameStyle}>
                <div className="absolute inset-0 border-2 border-dashed border-cyan-300 rounded-md" />
                {REVEAL_ZONES.map(z => (
                  <div
                    key={z.label}
                    className="absolute border-2 border-emerald-400 rounded-sm"
                    style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` }}
                  >
                    <span className="absolute -top-0.5 left-0 text-[8px] font-bold text-white bg-emerald-600/90 px-1 rounded-br">
                      {z.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Instrucción */}
            {liveOverlay && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                  Coloca tu cédula dentro del marco y presiona Capturar
                </span>
              </div>
            )}

            {idCardPhoto && (
              <img src={idCardPhoto} alt="Cédula (enmascarada)" className="absolute top-0 left-0 w-full h-full object-contain bg-white" />
            )}
            <canvas ref={canvasRef} className="hidden" />

            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                <Loader2 className="h-10 w-10 animate-spin mb-3" />
                <p className="text-sm">Leyendo el documento…</p>
              </div>
            )}

            {!hasCameraPermission && !idCardPhoto && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4">
                <Camera className="h-12 w-12 mb-4" />
                <p className="text-center font-semibold">No se pudo iniciar la cámara</p>
                <p className="text-center text-sm mb-3">Puede estar en uso por otra app o pestaña (cierra Zoom/Teams/otras pestañas) o faltan permisos del navegador.</p>
                <Button variant="secondary" size="sm" onClick={startCamera}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
                </Button>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No se pudo leer el documento</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert variant={result.matchesExpected ? 'default' : 'destructive'} className={result.matchesExpected ? 'border-primary' : ''}>
              <Check className="h-4 w-4" />
              <AlertTitle>Nombre detectado en el documento</AlertTitle>
              <AlertDescription>
                <p className="font-semibold text-base">{result.detectedName}</p>
                {!result.matchesExpected && (
                  <p className="mt-1 text-sm">
                    No coincide con tu nombre registrado (<span className="font-medium">{studentName}</span>).
                    Si fue un error de lectura, vuelve a tomar la foto; si tu documento es correcto, confirma de todas formas.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
          {!idCardPhoto ? (
            <Button variant="outline" onClick={takePhoto} disabled={!hasCameraPermission || isLoading}>
              <Camera className="mr-2 h-4 w-4" />
              Capturar
            </Button>
          ) : result ? (
            <>
              <Button onClick={confirm} disabled={uploading} className="bg-green-600 hover:bg-green-700">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirmar — soy yo
              </Button>
              <Button onClick={retake} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Volver a capturar
              </Button>
            </>
          ) : (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
