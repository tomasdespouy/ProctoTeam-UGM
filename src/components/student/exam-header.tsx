"use client";

import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock } from 'lucide-react';
import Image from 'next/image';

interface ExamHeaderProps {
  examStarted: boolean;
  examData: any | null;
}

export function ExamHeader({ examStarted, examData }: ExamHeaderProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!examData?.startedAt || timeLeft !== null) return;

    const totalDurationSeconds = examData.duration * 60;
    const startTime = new Date(examData.startedAt).getTime();
    const nowTime = new Date().getTime();
    const elapsedSeconds = Math.floor((nowTime - startTime) / 1000);

    const remainingSeconds = totalDurationSeconds - elapsedSeconds;
    setTimeLeft(remainingSeconds);
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
    const s = Math.max(0, seconds);
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (Math.floor(s) % 60).toString().padStart(2, '0');
    if (parseInt(h) > 0) return `${h}:${m}:${ss}`;
    return `${m}:${ss}`;
  };

  const startTime = examData?.startedAt ? new Date(examData.startedAt) : null;
  const endTime = startTime && examData ? new Date(startTime.getTime() + examData.duration * 60000) : null;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 select-none justify-between"
      style={{ background: '#161f45', height: 73, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Logo and branding (left) */}
      <div className="flex items-center flex-shrink-0">
        <Image
          src="/Logo lineas.png"
          alt="Universidad Gabriela Mistral"
          width={120}
          height={32}
          className="object-contain flex-shrink-0"
          priority
          style={{ height: '32px', width: 'auto' }}
        />

        <div
          className="flex-shrink-0 mx-5"
          style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' }}
        />

        <span className="font-black text-2xl tracking-tight leading-none flex-shrink-0">
          <span style={{ color: '#00bbff' }}>Procto</span>
          <span className="text-white">Team</span>
        </span>
      </div>

      {/* Exam title (center) */}
      <div className="flex-1 text-center">
        <h2 className="text-lg font-bold text-white truncate px-4">
          {examData?.title || 'Cargando examen...'}
        </h2>
      </div>

      {/* Timer (right) */}
      <div className="flex-shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 font-bold text-lg tabular-nums bg-white px-3 py-1 rounded-lg border border-gray-200">
                <Clock className="h-5 w-5 text-[#161F45]" />
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
    </header>
  );
}