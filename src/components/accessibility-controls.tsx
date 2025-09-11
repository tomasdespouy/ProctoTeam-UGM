
'use client';

import { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const FONT_STEP = 2;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 20;
const DEFAULT_FONT_SIZE = 16;

export function AccessibilityControls() {
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [isMounted, setIsMounted] = useState(false);

  // Effect to load font size from localStorage on mount
  useEffect(() => {
    const savedSize = localStorage.getItem('fontSize');
    if (savedSize && !isNaN(parseInt(savedSize, 10))) {
        setFontSize(parseInt(savedSize, 10));
    }
    setIsMounted(true);
  }, []);

  // Effect to apply font size to HTML element and save to localStorage
  useEffect(() => {
    if (isMounted) {
      document.documentElement.style.fontSize = `${fontSize}px`;
      localStorage.setItem('fontSize', fontSize.toString());
    }
  }, [fontSize, isMounted]);

  const increaseFontSize = () => {
    setFontSize((prevSize) => Math.min(prevSize + FONT_STEP, MAX_FONT_SIZE));
  };

  const decreaseFontSize = () => {
    setFontSize((prevSize) => Math.max(prevSize - FONT_STEP, MIN_FONT_SIZE));
  };

  if (!isMounted) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
         <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={increaseFontSize}
              disabled={fontSize >= MAX_FONT_SIZE}
              className="bg-background/80 backdrop-blur-sm border hover:bg-muted"
              aria-label="Aumentar tamaño de fuente"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Aumentar tamaño de fuente</p>
          </TooltipContent>
        </Tooltip>
         <Tooltip>
          <TooltipTrigger asChild>
             <Button
              variant="ghost"
              size="icon"
              onClick={decreaseFontSize}
              disabled={fontSize <= MIN_FONT_SIZE}
              className="bg-background/80 backdrop-blur-sm border hover:bg-muted"
              aria-label="Disminuir tamaño de fuente"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Disminuir tamaño de fuente</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
