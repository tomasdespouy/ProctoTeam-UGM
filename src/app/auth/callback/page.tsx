'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMsalInstance } from '@/lib/azure-auth';
import { Loader2 } from 'lucide-react';

function AuthCallbackContent() {
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
          // Éxito: volvemos a "/" y dejamos que la home enrute por ROL
          // (incluye super-admin), con el perfil ya sincronizado por AuthProvider.
          router.replace('/');
        } else {
          const errorParam = searchParams.get('error');
          const errorDescription = searchParams.get('error_description');

          if (errorParam) {
            console.error('Authentication error:', errorParam, errorDescription);
            setError(errorDescription || 'Error de autenticación');
            setTimeout(() => router.push('/'), 3000);
          } else {
            // Sin respuesta pendiente: AuthProvider ya procesó el redirect si
            // había cuenta. En cualquier caso, "/" decide (login o dashboard).
            router.replace('/');
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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0D1240 0%, #1A1D6E 40%, #1E3A8A 100%)' }}
      >
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-xl font-semibold mb-4">Error de Autenticación</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-400">Redirigiendo al inicio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0D1240 0%, #1A1D6E 40%, #1E3A8A 100%)' }}
    >
      <div className="bg-white p-8 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#00BBFF]" />
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#1A1D47] mb-1">
              Procesando autenticación
            </h2>
            <p className="text-sm text-gray-500">Por favor espera...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0D1240 0%, #1A1D6E 40%, #1E3A8A 100%)' }}
        >
          <Loader2 className="w-10 h-10 animate-spin text-[#00BBFF]" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
