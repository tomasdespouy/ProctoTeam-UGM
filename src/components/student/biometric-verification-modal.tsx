
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Check, Loader2, RefreshCw, AlertTriangle, User, BadgeInfo } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { verifyStudentIdentity } from '@/ai/flows/verify-student-identity';

interface BiometricVerificationModalProps {
  isOpen: boolean;
  onVerificationSuccess: () => void;
  studentId: string;
  studentName: string;
}

type VerificationStep = 'idCard' | 'face';

export function BiometricVerificationModal({ isOpen, onVerificationSuccess, studentId, studentName }: BiometricVerificationModalProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [idCardPhoto, setIdCardPhoto] = useState<string | null>(null);
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<VerificationStep>('idCard');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      // Reset state when modal opens
      setCurrentStep('idCard');
      setIdCardPhoto(null);
      setFacePhoto(null);
      setVerificationError(null);
      setIsLoading(false);
    } else {
      // Cleanup camera stream when modal closes
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  }, [isOpen, startCamera]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg');
        if (currentStep === 'idCard') {
          setIdCardPhoto(dataUri);
          // Automatically move to the next step
          setTimeout(() => setCurrentStep('face'), 500); 
        } else {
          setFacePhoto(dataUri);
        }
      }
    }
  };

  const resetStep = () => {
    if (currentStep === 'idCard') {
        setIdCardPhoto(null);
    } else {
        setFacePhoto(null);
    }
    setVerificationError(null);
  };
  
  const handleFinalVerification = async () => {
    if (!idCardPhoto || !facePhoto) {
        setVerificationError("Faltan una o ambas fotos para la verificación.");
        return;
    }
    
    setIsLoading(true);
    setVerificationError(null);

    try {
        const result = await verifyStudentIdentity({ idCardPhoto, facePhoto });

        if (result.isMatch) {
            toast({
                title: "Verificación Exitosa",
                description: "Identidad confirmada. Ahora, por favor, lee los requisitos del examen.",
                variant: 'default',
            });
            onVerificationSuccess();
        } else {
            setVerificationError(`Verificación Fallida: ${result.reason}. Por favor, inténtalo de nuevo asegurándote de que ambas fotos sean claras y de la misma persona.`);
            // Reset for re-try
            setTimeout(() => {
                setCurrentStep('idCard');
                setIdCardPhoto(null);
                setFacePhoto(null);
            }, 3000);
        }
    } catch (error) {
        console.error("Biometric verification flow error:", error);
        setVerificationError("Ocurrió un error inesperado durante la verificación con el servidor de IA. Por favor, intenta de nuevo.");
    } finally {
        setIsLoading(false);
    }
  };

  const isPhotoTaken = currentStep === 'idCard' ? !!idCardPhoto : !!facePhoto;

  const renderContent = () => {
    const title = currentStep === 'idCard' 
        ? "Paso 1: Foto del Documento de Identidad"
        : "Paso 2: Foto de tu Rostro";
    
    const description = currentStep === 'idCard'
        ? "Sostén tu cédula de identidad o ID universitario frente a la cámara. Asegúrate de que sea legible y no tenga reflejos."
        : `Ahora, ${studentName}, tómate una foto de tu rostro. Asegúrate de que tu cara esté bien iluminada y centrada en el recuadro.`;
        
    const photoToDisplay = currentStep === 'idCard' ? idCardPhoto : facePhoto;

    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline text-primary">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative w-full aspect-video rounded-lg border bg-muted overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover transition-opacity ${isPhotoTaken ? 'opacity-0' : 'opacity-100'}`}
              autoPlay
              muted
              playsInline
            />
            {photoToDisplay && <img src={photoToDisplay} alt="Snapshot" className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity ${isPhotoTaken ? 'opacity-100' : 'opacity-0'}`} />}
            <canvas ref={canvasRef} className="hidden" />
            {!hasCameraPermission && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4">
                <Camera className="h-12 w-12 mb-4" />
                <p className="text-center font-semibold">Se requiere acceso a la cámara</p>
                <p className="text-center text-sm">Por favor, habilita los permisos en tu navegador.</p>
              </div>
            )}
          </div>
          
          {verificationError && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error de Verificación</AlertTitle>
                <AlertDescription>{verificationError}</AlertDescription>
            </Alert>
          )}

           {idCardPhoto && !facePhoto && (
             <Alert variant="default" className="border-primary">
                <BadgeInfo className="h-4 w-4" />
                <AlertTitle>Foto de Documento Capturada</AlertTitle>
                <AlertDescription>¡Excelente! Ahora procede a tomar la foto de tu rostro.</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
            {!isPhotoTaken ? (
                 <Button onClick={takePhoto} disabled={!hasCameraPermission || isLoading}>
                     <Camera className="mr-2 h-4 w-4" />
                     {currentStep === 'idCard' ? 'Tomar Foto del Documento' : 'Tomar Foto del Rostro'}
                </Button>
            ) : (
                <>
                {currentStep === 'face' && facePhoto && (
                    <Button onClick={handleFinalVerification} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Confirmar y Verificar Identidad
                    </Button>
                )}
                <Button onClick={resetStep} variant="outline" disabled={isLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Tomar de Nuevo
                </Button>
                </>
            )}
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
