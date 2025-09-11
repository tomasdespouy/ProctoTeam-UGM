'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function ErrorRecovery() {
  const router = useRouter();

  useEffect(() => {
    let chunkErrorCount = 0;
    const maxRetries = 2;

    // Handler for chunk loading errors
    const handleChunkError = (event: Event) => {
      // Check if it's a chunk loading error
      const error = (event as any)?.error;
      const errorMessage = error?.message || '';
      
      if (errorMessage.includes('Loading chunk') || errorMessage.includes('ChunkLoadError')) {
        console.log('ChunkLoadError detected, attempting recovery...');
        
        chunkErrorCount++;
        
        if (chunkErrorCount <= maxRetries) {
          // Save current location
          const currentPath = window.location.pathname + window.location.search;
          
          // Attempt to reload the current page
          setTimeout(() => {
            if (currentPath === window.location.pathname + window.location.search) {
              window.location.reload();
            }
          }, 1000);
        } else {
          // If too many retries, show user-friendly message
          console.warn('Multiple chunk loading failures detected');
          
          // Optional: Show a user notification
          if (typeof window !== 'undefined' && 'Notification' in window) {
            new Notification('Detectado problema de conexión', {
              body: 'Refrescando la página automáticamente...',
              icon: '/favicon.ico'
            });
          }
          
          // Hard refresh after multiple failures
          setTimeout(() => {
            window.location.href = window.location.href;
          }, 2000);
        }
        
        // Prevent the error from propagating
        event.preventDefault();
      }
    };

    // Handler for unhandled promise rejections (async chunk loading)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorMessage = error?.message || '';
      
      if (errorMessage.includes('Loading chunk') || errorMessage.includes('ChunkLoadError')) {
        console.log('Async ChunkLoadError detected, attempting recovery...');
        handleChunkError(event as any);
      }
    };

    // Add event listeners
    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [router]);

  return null; // This component doesn't render anything
}