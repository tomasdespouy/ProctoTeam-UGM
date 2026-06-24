"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Check, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { extractIdCardName } from '@/ai/flows/verify-student-identity';
import { useAuth } from '@/context/auth-context';

interface BiometricVerificationModalProps {
  isOpen: boolean;
  onVerificationSuccess: () => void;
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

export function BiometricVerificationModal({ isOpen, onVerificationSuccess, studentId, studentName, participationId }: BiometricVerificationModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [idCardPhoto, setIdCardPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── startCamera — con reintento automático (cámara ocupada/timeout es transitorio) ──
  const startCamera = useCallback(async () => {
    // Detener cualquier stream previo antes de (re)intentar.
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }

    const MAX = 3;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setHasCameraPermission(true);
        return;
      } catch (err: any) {
        lastErr = err;
        const name = err?.name ?? '';
        if (name === 'NotAllowedError' || name === 'SecurityError') break; // permiso denegado: no reintentar
        console.warn(`[Biometric] Cámara intento ${attempt}/${MAX} falló: ${name || err?.message}`);
        if (attempt < MAX) await new Promise(r => setTimeout(r, attempt * 800));
      }
    }
    console.error('Error accessing camera:', lastErr);
    setHasCameraPermission(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setIdCardPhoto(null);
      setResult(null);
      setError(null);
      setIsLoading(false);
    } else if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, [isOpen, startCamera]);

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUri = canvas.toDataURL('image/jpeg');
    setIdCardPhoto(dataUri);
    setIsLoading(true);
    setError(null);

    try {
      const res = await extractIdCardName({ idCardPhoto: dataUri, expectedName: studentName });
      if (!res.readable || !res.detectedName) {
        setError('No pudimos leer el documento. Asegúrate de que el nombre sea legible, sin reflejos ni desenfoque, e intenta de nuevo.');
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
  };

  const retake = () => {
    setIdCardPhoto(null);
    setResult(null);
    setError(null);
  };

  const confirm = async () => {
    // Guarda la foto (estudiante + documento) como evidencia. No bloquea si falla.
    setUploading(true);
    try {
      const token = user ? await user.getIdToken() : null;
      if (token && idCardPhoto) {
        await fetch('/api/exam/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ snapshot: idCardPhoto, participationId, alertType: 'identidad' }),
        });
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

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline text-primary">Verificación de Identidad</DialogTitle>
          <DialogDescription>
            Tómate una foto sosteniendo tu documento de identidad (cédula o carnet) junto a tu rostro, de modo que se vean ambos con claridad. Leeremos tu nombre del documento para que lo confirmes; la foto se guarda como evidencia.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative w-full aspect-video rounded-lg border bg-muted overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover transition-opacity ${idCardPhoto ? 'opacity-0' : 'opacity-100'}`}
              autoPlay
              muted
              playsInline
            />
            {idCardPhoto && (
              <img src={idCardPhoto} alt="Documento" className="absolute top-0 left-0 w-full h-full object-cover" />
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
            <Button onClick={takePhoto} disabled={!hasCameraPermission || isLoading}>
              <Camera className="mr-2 h-4 w-4" />
              Tomar Foto del Documento
            </Button>
          ) : result ? (
            <>
              <Button onClick={confirm} disabled={uploading} className="bg-green-600 hover:bg-green-700">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirmar — soy yo
              </Button>
              <Button onClick={retake} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Volver a tomar
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
