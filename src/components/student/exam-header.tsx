"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/azure-auth';
import { useAuth } from '@/context/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { LogOut, Clock } from 'lucide-react';
import { ThemeToggle } from '../theme-toggle';
import Image from 'next/image';


interface ExamData {
    title: string;
    duration: number;
    accessCode: string;
    instructorId: string;
    createdAt: string | Date;
    status: 'pending' | 'active' | 'finished';
    // [CORRECCIÓN FRONTEND]: Se asume que esta propiedad viene ahora de la API
    startedAt?: string; 
}
interface ExamHeaderProps {
  examStarted: boolean;
  examData: any | null; // Usamos 'any' o las interfaces definidas
}

export function ExamHeader({ examStarted, examData }: ExamHeaderProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  // [CORRECCIÓN FRONTEND]: Se inicializa el tiempo restante basado en el tiempo transcurrido desde startedAt
  useEffect(() => {
      if (!examData?.startedAt || timeLeft !== null) return;

      const totalDurationSeconds = examData.duration * 60;
      const startTime = new Date(examData.startedAt).getTime();
      const nowTime = new Date().getTime();
      const elapsedSeconds = Math.floor((nowTime - startTime) / 1000);

      const remainingSeconds = totalDurationSeconds - elapsedSeconds;

      // Si ya pasó el tiempo o el examen no ha empezado formalmente, inicializar con el valor calculado
      setTimeLeft(remainingSeconds);

  }, [examData, timeLeft]);


  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (examStarted && timeLeft !== null && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prevTime) => (prevTime !== null ? prevTime - 1 : null));
      }, 1000);
    }
    // Si el tiempo llega a cero o menos, el examen debe marcarse como terminado (aunque esto lo controla la página principal)
    if (timeLeft !== null && timeLeft <= 0) {
        // Lógica opcional para enviar una alerta o un toast de finalización
    }

    return () => clearInterval(timer);
  }, [examStarted, timeLeft]);

  const formatTime = (seconds: number | null) => {
      if (seconds === null) return '--:--';
      const s = Math.max(0, seconds); // Ensure seconds is not negative
      const h = Math.floor(s / 3600).toString().padStart(2,'0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const ss = (Math.floor(s) % 60).toString().padStart(2, '0');
      if (parseInt(h) > 0) return `${h}:${m}:${ss}`;
      return `${m}:${ss}`;
    };

    // [CÓDIGO ELIMINADO/MODIFICADO]: Ya no necesitamos calcular startTime localmente, lo obtenemos de examData
    const startTime = examData?.startedAt ? new Date(examData.startedAt) : null;
    const endTime = startTime && examData ? new Date(startTime.getTime() + examData.duration * 60000) : null;
    const displayName = userProfile?.nombre || user?.displayName || user?.name; // Agregamos user?.name
    const avatarFallback = displayName ? displayName.substring(0, 2).toUpperCase() : 'UG';

    return (
      <header
        style={{ backgroundColor: "#161F45" }}
        className="fixed top-0 left-0 right-0 h-16 border-b border-white/20 flex items-center justify-between px-6 shadow-md z-[100]" // Z-index aumentado
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <Image
              src="/Logo lineas.png"
              alt="Universidad Gabriela Mistral"
              width={180}
              height={40}
              // CORRECCIÓN: Se agrega style para resolver el CSS warning de las proporciones (Deuda Técnica)
              style={{ width: 'auto', height: '100%' }}
              className="object-contain max-h-20"
            />
            <div>
              <h1 className="text-xl font-bold text-white">
                <span className="text-[#00d4ff]">Procto</span>
                <span className="text-white">Team</span>
              </h1>
              <p className="text-xs text-white/70">Examen en Progreso</p>
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <h2 className="text-lg font-bold text-white">
            {examData?.title || 'Cargando examen...'}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* MEJORA UI: Se cambia el color del texto y fondo para un mejor contraste */}
                  <div className="flex items-center gap-2 font-bold text-lg tabular-nums bg-white px-3 py-1 rounded-lg border border-gray-200">
                    <Clock className="h-5 w-5 text-[#161F45]" />
                    {/* MEJORA UX: Color de advertencia si quedan menos de 5 minutos */}
                    <span className={`text-[#161F45] ${timeLeft !== null && timeLeft <= 300 ? 'text-red-600 animate-pulse' : ''}`}>
                        {formatTime(timeLeft)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                   {startTime && <p>Hora de inicio: {startTime.toLocaleTimeString()}</p>}
                   {endTime && <p>Hora de fin: {endTime.toLocaleTimeString()}</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Switch de tema */}
          <ThemeToggle />

          {/* Nombre del usuario */}
          <span className="text-white text-sm font-medium">
            {displayName || "Estudiante"}
          </span>


          {/* MEJORA UI: Botón de Salir con color que contrasta más con el fondo */}
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium border-0"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Salir
          </Button>
        </div>
      </header>
    );
  }