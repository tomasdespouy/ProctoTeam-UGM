"use client"

import React, { useState, useEffect } from 'react';
import { CheckCircle2, WifiOff } from 'lucide-react';

export function ExamFooter() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-10 bg-primary text-primary-foreground flex items-center justify-between px-6 z-50">
      <div className="text-xs text-muted-foreground/80">
        <p>Sistema de Proctoring UGM v1.0</p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {isOnline ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span>Conexión Estable</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-destructive-foreground">Sin Conexión</span>
          </>
        )}
      </div>
    </footer>
  );
}
