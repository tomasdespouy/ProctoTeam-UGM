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
    <footer 
      // MEJORA UI: Fondo más neutro para contraste, manteniendo la posición fija
      className="fixed bottom-0 left-0 right-0 h-10 bg-gray-100 dark:bg-gray-800 flex items-center justify-between px-6 z-50 border-t border-gray-300 dark:border-gray-700"
    >
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {/* MEJORA UI: Versión y derechos de autor discretos */}
        <p>Sistema de Proctoring UGM v1.0 © 2025</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold">
        {isOnline ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Conexión Estable</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <WifiOff className="h-4 w-4" />
            <span>Sin Conexión</span>
          </div>
        )}
      </div>
    </footer>
  );
}