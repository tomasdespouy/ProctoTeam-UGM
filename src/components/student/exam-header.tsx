
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/azure-auth';
import { useAuth } from '@/context/auth-context';
import { PortalLogo } from '@/components/portal-logo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from '@/components/ui/button';
import { LogOut, History, Clock, GraduationCap } from 'lucide-react';
import { ThemeToggle } from '../theme-toggle';
import Image from 'next/image';


interface ExamData {
    title: string;
    duration: number;
    accessCode: string;
    instructorId: string;
    createdAt: string | Date;
    status: 'pending' | 'active' | 'finished';
}
interface ExamHeaderProps {
  examStarted: boolean;
  examData: ExamData | null;
}

export function ExamHeader({ examStarted, examData }: ExamHeaderProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  useEffect(() => {
    if (examData && timeLeft === null) {
      const totalTimeInSeconds = examData.duration * 60;
      setTimeLeft(totalTimeInSeconds);
    }
  }, [examData, timeLeft]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (examStarted && timeLeft !== null && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prevTime) => (prevTime !== null ? prevTime - 1 : null));
      }, 1000);
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

  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    if(examStarted && !startTime && examData) {
      setStartTime(new Date());
    }
  }, [examStarted, startTime, examData]);

  const endTime = startTime && examData ? new Date(startTime.getTime() + examData.duration * 60000) : null;
  const displayName = userProfile?.nombre || user?.displayName;

  return (
    <header
      style={{ backgroundColor: "#161F45" }}
      className="fixed top-0 left-0 right-0 h-16 border-b border-white/20 flex items-center justify-between px-6 shadow-md z-50"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <Image
            src="/Logo lineas.png"
            alt="Universidad Gabriela Mistral"
            width={120}
            height={40}
            className="object-contain"
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
                <div className="flex items-center gap-2 font-bold text-lg tabular-nums bg-white/10 px-3 py-1 rounded-lg border border-white/20">
                  <Clock className="h-5 w-5 text-[#00d4ff]" />
                  <span className="text-white">{formatTime(timeLeft)}</span>
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


        {/* Botón de cerrar sesión */}
        <Button
          className="bg-[#242F62] hover:bg-[#1a1d47] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium border-0"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Salir
        </Button>
      </div>
    </header>
  );
}
