
'use client';

import { useLoading } from '@/context/loading-context';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function PageLoader() {
  const { isLoading } = useLoading();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
