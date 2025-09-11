
"use client";

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const ORIGINAL_TITLE = "UGM Proctor";

interface DocumentTitleHandlerProps {
  criticalAlertCount: number;
}

export function DocumentTitleHandler({ criticalAlertCount }: DocumentTitleHandlerProps) {
  const { toasts } = useToast();

  useEffect(() => {
    const latestToast = toasts[0];
    let timeoutId: NodeJS.Timeout | null = null;
    let newTitle = ORIGINAL_TITLE;

    if (latestToast && latestToast.open) {
      if (latestToast.variant === 'destructive') {
        newTitle = `${criticalAlertCount} Faltas Cometidas - ${ORIGINAL_TITLE}`;
      } else if (latestToast.title === 'Mensaje del Supervisor') {
        newTitle = `Mensaje del Supervisor - ${ORIGINAL_TITLE}`;
      }
      
      if (document.title !== newTitle) {
        document.title = newTitle;
      }
      
      timeoutId = setTimeout(() => {
        if (document.title.startsWith(`${criticalAlertCount} Faltas`) || document.title.startsWith("Mensaje")) {
            document.title = ORIGINAL_TITLE;
        }
      }, 15000);
    } else {
        if (document.title !== ORIGINAL_TITLE) {
            document.title = ORIGINAL_TITLE;
        }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [toasts, criticalAlertCount]);

  return null;
}
