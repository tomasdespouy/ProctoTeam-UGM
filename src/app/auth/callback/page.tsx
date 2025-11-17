'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMsalInstance } from '@/lib/azure-auth';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const instance = getMsalInstance();
        await instance.initialize();
        const response = await instance.handleRedirectPromise();
        
        if (response) {
          const userRole = sessionStorage.getItem('loginRole');
          sessionStorage.removeItem('loginRole');
          
          if (userRole === 'student') {
            router.push('/student');
          } else if (userRole === 'instructor') {
            router.push('/instructor');
          } else {
            router.push('/');
          }
        } else {
          const error = searchParams.get('error');
          const errorDescription = searchParams.get('error_description');
          
          if (error) {
            console.error('Authentication error:', error, errorDescription);
            setError(errorDescription || 'Error de autenticación');
            setTimeout(() => router.push('/'), 3000);
          } else {
            const userRole = sessionStorage.getItem('loginRole');
            sessionStorage.removeItem('loginRole');
            if (userRole === 'student') {
              router.push('/student');
            } else if (userRole === 'instructor') {
              router.push('/instructor');
            } else {
              router.push('/');
            }
          }
        }
      } catch (error) {
        console.error('Error handling redirect:', error);
        setError('Error procesando la autenticación');
        setTimeout(() => router.push('/'), 3000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00d4ff] via-[#0099cc] to-[#006699]">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="text-center">
            <div className="text-red-500 text-xl font-semibold mb-4">Error de Autenticación</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirigiendo al inicio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00d4ff] via-[#0099cc] to-[#006699]">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#00d4ff]" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Procesando autenticación
            </h2>
            <p className="text-gray-600">Por favor espera...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
