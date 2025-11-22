
'use client';

import { useLoading } from '@/context/loading-context';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

export function PageLoader() {
  const { isLoading } = useLoading();

  useEffect(() => {
    console.log('[PageLoader] isLoading:', isLoading);
  }, [isLoading]);

  // Si no está cargando, no renderizar NADA
  if (!isLoading) return null;

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-auto"
          style={{ pointerEvents: isLoading ? 'auto' : 'none' }}
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
