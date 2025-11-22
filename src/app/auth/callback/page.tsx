'use client';

import { Suspense, useEffect, useState } from 'react';
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
        console.log('[Callback] Iniciando procesamiento de callback');
        console.log('[Callback] URL completa:', window.location.href);
        console.log('[Callback] Hash:', window.location.hash);
        
        const instance = getMsalInstance();
        console.log('[Callback] Instancia MSAL obtenida');
        
        // NO limpiar estados aquí - MSAL los necesita para procesar el redirect
        await instance.initialize();
        console.log('[Callback] MSAL inicializado');
        
        // PRIMERO procesar el redirect
        const response = await instance.handleRedirectPromise();
        console.log('[Callback] handleRedirectPromise procesado');
        
        console.log('[Callback] Respuesta completa:', response);
        console.log('[Callback] ¿Tiene account?:', response?.account ? 'SÍ' : 'NO');
        console.log('[Callback] ¿Tiene accessToken?:', response?.accessToken ? 'SÍ' : 'NO');
        
        if (response && response.account) {
          console.log('[Callback] Autenticación exitosa, cuenta:', response.account.username);
          
          // CRÍTICO: Establecer la cuenta como activa
          instance.setActiveAccount(response.account);
          console.log('[Callback] Cuenta activa establecida');
          
          // AHORA sí, limpiar estados de interacción después de procesar
          console.log('[Callback] Limpiando estados de interacción DESPUÉS de procesar...');
          Object.keys(sessionStorage).forEach(key => {
            if (key.includes('interaction')) {
              sessionStorage.removeItem(key);
              console.log('[Callback] Removido:', key);
            }
          });
          
          const userRole = sessionStorage.getItem('loginRole');
          sessionStorage.removeItem('loginRole');
          
          console.log('[Callback] Redirigiendo a portal según rol:', userRole);
          
          if (userRole === 'student') {
            console.log('[Callback] Redirigiendo a portal de estudiantes');
            router.push('/student');
          } else if (userRole === 'instructor') {
            console.log('[Callback] Redirigiendo a portal de instructores');
            router.push('/instructor');
          } else {
            console.log('[Callback] Sin rol definido, redirigiendo a home');
            router.push('/');
          }
        } else {
          const error = searchParams.get('error');
          const errorDescription = searchParams.get('error_description');
          
          if (error) {
            console.error('[Callback] Error de autenticación:', error, errorDescription);
            setError(errorDescription || 'Error de autenticación');
            setTimeout(() => {
              const userRole = sessionStorage.getItem('loginRole');
              sessionStorage.removeItem('loginRole');
              if (userRole === 'student') {
                router.push('/student/login');
              } else if (userRole === 'instructor') {
                router.push('/instructor/login');
              } else {
                router.push('/');
              }
            }, 3000);
          } else {
            console.log('[Callback] No hay respuesta ni error, redirigiendo al login');
            const userRole = sessionStorage.getItem('loginRole');
            sessionStorage.removeItem('loginRole');
            if (userRole === 'student') {
              router.push('/student/login');
            } else if (userRole === 'instructor') {
              router.push('/instructor/login');
            } else {
              router.push('/');
            }
          }
        }
      } catch (error) {
        console.error('[Callback] Error procesando redirect:', error);
        setError('Error procesando la autenticación');
        setTimeout(() => {
          const userRole = sessionStorage.getItem('loginRole');
          sessionStorage.removeItem('loginRole');
          if (userRole === 'student') {
            router.push('/student/login');
          } else if (userRole === 'instructor') {
            router.push('/instructor/login');
          } else {
            router.push('/');
          }
        }, 3000);
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

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
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
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
