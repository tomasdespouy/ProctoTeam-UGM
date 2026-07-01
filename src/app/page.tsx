"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Loader2, GraduationCap } from 'lucide-react';
import { signInWithAzureRedirect } from '@/lib/azure-auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const redirectedRef = useRef(false);

  // Once authenticated, leave the public login page and route by role.
  // This is driven by the auth-context state that the msal:loginSuccess event
  // populates — NOT by awaiting loginPopup() — so it still fires when COOP blocks
  // MSAL's popup window.closed monitor and the loginPopup promise never resolves.
  // (That hang is exactly why the button used to stay frozen on "Conectando…".)
  useEffect(() => {
    if (loading || redirectedRef.current) return;
    if (userProfile) {
      redirectedRef.current = true;
      setIsLoading(false);
      if (userProfile.role === 'student') router.replace('/student');
      else if (userProfile.role === 'super-admin') router.replace('/super-admin/dashboard');
      else router.replace('/instructor');
    } else if (user) {
      // Sesión iniciada pero el perfil no sincronizó (p.ej. /api/auth/get-user
      // falló): no dejar el spinner colgado — avisar y permitir reintentar.
      redirectedRef.current = true;
      setIsLoading(false);
      toast({
        variant: 'destructive',
        title: 'No pudimos cargar tu perfil',
        description: 'Tu sesión se inició pero hubo un problema al sincronizar tu cuenta. Intenta nuevamente.',
      });
    }
  }, [user, userProfile, loading, router, toast]);

  const handleLogin = async () => {
    if (isLoading) return;
    redirectedRef.current = false; // re-arm the redirect effect for this attempt
    setIsLoading(true);
    try {
      // Flujo de REDIRECT (sin popup): evita el COOP del popup y el doble manejo
      // del redirect DENTRO de la ventana emergente, que provocaba el
      // "Error procesando la autenticación". La ventana navega a Microsoft y
      // vuelve a /auth/callback, que reenvía a "/" para enrutar por rol.
      const { error } = await signInWithAzureRedirect();
      if (error) {
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Error de conexión",
          description: "No se pudo iniciar sesión con Microsoft.",
        });
      }
      // En éxito el navegador ya se fue a Microsoft; nada más que hacer aquí.
    } catch (error) {
      console.error("Error en login:", error);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Error de conexión",
        description: "No se pudo iniciar sesión con Microsoft.",
      });
    }
  };

  // Mientras MSAL inicializa, o ya hay perfil (a punto de enrutar por rol),
  // mostramos un loader en lugar del formulario para no parpadear el login.
  if (loading || userProfile) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1B2A6B 0%, #0E1845 40%, #080E28 100%)' }}
      >
        <Loader2 className="w-10 h-10 animate-spin text-[#00D4FF]" />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden pb-12"
      style={{ background: 'linear-gradient(135deg, #1B2A6B 0%, #0E1845 40%, #080E28 100%)' }}
    >

      {/* ── LEFT: UGM letters ── */}
      {/*
        Images have a white background + pencil-style lines.
        filter:invert(1) flips: white→black (transparent with screen),
        dark pencil lines → bright white → show as light-blue glows on the navy background.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ugm-letters.png"
        alt=""
        aria-hidden="true"
        className="absolute left-[-5%] top-0 h-full w-auto object-cover pointer-events-none select-none"
        style={{
          opacity: 0.55,
          mixBlendMode: 'screen',
          filter: 'invert(1)',
          zIndex: 0,
        }}
      />

      {/* ── RIGHT: Gabriela Mistral portrait ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/gabriela-mistral-sketch.png"
        alt=""
        aria-hidden="true"
        className="absolute right-[-5%] top-0 h-full w-auto object-cover pointer-events-none select-none"
        style={{
          opacity: 0.45,
          mixBlendMode: 'screen',
          filter: 'invert(1)',
          zIndex: 0,
        }}
      />

      {/* ── Halo cyan sutil detrás del título (profundidad sobria) ── */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[26%] -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)', zIndex: 0 }}
      />

      {/* ── Centre content ── */}
      <div className="relative z-10 flex flex-col items-center w-full px-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/ugm-logo.png"
            alt="Universidad Gabriela Mistral"
            width={220}
            height={44}
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.95, width: 'auto', height: 'auto' }}
            priority
          />
        </div>

        {/* Title */}
        <h1 className="font-headline font-black leading-none mb-2 text-center"
            style={{ fontSize: 'clamp(40px, 5.5vw, 72px)' }}>
          <span style={{ color: '#00D4FF', textShadow: '0 0 28px rgba(0,212,255,0.35)' }}>Procto</span>
          <span className="text-white">Team</span>
        </h1>
        <p className="text-white/80 text-base font-light tracking-wide mb-10 text-center">
          Sistema de Vigilancia de Exámenes en Línea
        </p>

        {/* ── SSO Card ── */}
        <div
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* Icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1A2242 0%, #2A3B7A 100%)' }}
          >
            <GraduationCap className="w-9 h-9 text-white" />
          </div>

          {/* Card title & description */}
          <h2 className="text-2xl font-bold mb-1" style={{ color: '#1A2242' }}>
            Acceso Institucional
          </h2>
          <p className="text-gray-500 text-sm mt-1 mb-8 leading-relaxed max-w-xs">
            Ingresa con tu cuenta de la Universidad Gabriela Mistral para acceder al sistema de exámenes.
          </p>

          {/* SSO button */}
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full rounded-full py-6 text-base font-semibold text-white transition-all shadow-md hover:shadow-lg"
            style={{
              background: isLoading
                ? '#8892AA'
                : 'linear-gradient(135deg, #1A2242 0%, #263580 100%)',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Conectando…
              </>
            ) : (
              'Iniciar Sesión con UGM'
            )}
          </Button>

          <p className="text-gray-400 text-xs mt-4">
            El rol se asigna automáticamente según tu correo institucional
          </p>

          {/* Cyan bottom stripe */}
          <div
            className="absolute bottom-0 left-0 w-full h-2"
            style={{ background: '#00D4FF' }}
          />
        </div>

      </div>

      {/* ── Footer ── */}
      <p className="absolute bottom-4 z-10 text-xs text-white/40 text-center w-full">
        Universidad Gabriela Mistral — 2026. Todos los derechos reservados.
      </p>
    </main>
  );
}
