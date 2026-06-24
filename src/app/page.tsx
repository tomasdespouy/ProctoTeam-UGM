"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Bug, GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';
import { signInWithAzureRedirect } from '@/lib/azure-auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserProfile } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

const SHOW_DEV_LOGIN = process.env.NEXT_PUBLIC_SHOW_DEV_LOGIN === 'true';
const DEV_TEACHER_EMAIL = 'docente@ugm.cl';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [devEmail, setDevEmail] = useState(DEV_TEACHER_EMAIL);
  const [devPassword, setDevPassword] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const { toast } = useToast();
  const { setDevUser, user, userProfile, loading } = useAuth();
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

  const handleDevLogin = async (email: string, forceRole?: string, password?: string) => {
    if (devLoading) return;
    setDevLoading(true);
    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(forceRole ? { role: forceRole } : {}),
          ...(password ? { password } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error en dev login');

      const profile: UserProfile = {
        id: data.user.id,
        uid: data.user.uid,
        nombre: data.user.nombre,
        correo: data.user.email,
        role: data.user.role,
        photoURL: data.user.photo_url,
      };
      setDevUser(profile, data.devToken);
      toast({ title: "Dev Login exitoso", description: `Entrando como ${profile.role}: ${profile.correo}` });

      if (profile.role === 'student') {
        router.push('/student');
      } else if (profile.role === 'super-admin') {
        router.push('/super-admin/dashboard');
      } else {
        router.push('/instructor');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setDevLoading(false);
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

        {/* ── Dev login panel ── */}
        {SHOW_DEV_LOGIN && (
          <div
            className="mt-6 w-full max-w-md rounded-2xl p-4 border"
            style={{
              background: 'rgba(255,255,255,0.07)',
              borderColor: 'rgba(255,200,50,0.35)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Bug className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-xs font-semibold tracking-wide uppercase">
                Modo Desarrollo
              </span>
            </div>
            <Input
              type="email"
              placeholder="Usuario docente..."
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              className="mb-2 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-amber-400"
            />
            <Input
              type="password"
              placeholder="Clave de acceso de desarrollo (requerida)..."
              value={devPassword}
              onChange={(e) => setDevPassword(e.target.value)}
              className="mb-1 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-amber-400"
            />
            <p className="text-amber-200/60 text-[10px] mb-2">
              Requerida para todos los accesos de desarrollo (DEV_LOGIN_PASSWORD).
            </p>
            <Button
              onClick={() => handleDevLogin(devEmail || DEV_TEACHER_EMAIL, 'instructor', devPassword)}
              disabled={devLoading || !devEmail || !devPassword}
              size="sm"
              className="mb-2 w-full h-8 text-xs bg-green-600/90 hover:bg-green-600 text-white"
            >
              {devLoading ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Entrando...</> : 'Entrar como Docente'}
            </Button>
            <div className="flex gap-2 mb-2">
              <Button
                variant="outline" size="sm"
                onClick={() => { setDevEmail('test@estudiante.ugm.cl'); handleDevLogin('test@estudiante.ugm.cl', 'student', devPassword); }}
                disabled={devLoading || !devPassword}
                className="flex-1 h-8 text-xs border-blue-400/50 text-blue-300 bg-transparent hover:bg-blue-400/10"
              >
                <GraduationCap className="h-3 w-3 mr-1" /> Estudiante
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { setDevEmail('test@ugm.cl'); handleDevLogin('test@ugm.cl', 'instructor', devPassword); }}
                disabled={devLoading || !devPassword}
                className="flex-1 h-8 text-xs border-green-400/50 text-green-300 bg-transparent hover:bg-green-400/10"
              >
                <BookOpen className="h-3 w-3 mr-1" /> Instructor
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { setDevEmail('admin@ugm.cl'); handleDevLogin('admin@ugm.cl', 'super-admin', devPassword); }}
                disabled={devLoading || !devPassword}
                className="flex-1 h-8 text-xs border-purple-400/50 text-purple-300 bg-transparent hover:bg-purple-400/10"
              >
                <ShieldCheck className="h-3 w-3 mr-1" /> Admin
              </Button>
            </div>
            <Button
              onClick={() => handleDevLogin(devEmail, undefined, devPassword)}
              disabled={devLoading || !devEmail || !devPassword}
              size="sm"
              className="w-full h-8 text-xs bg-amber-500/80 hover:bg-amber-500 text-white"
            >
              {devLoading ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Entrando...</> : 'Entrar con email personalizado'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <p className="absolute bottom-4 z-10 text-xs text-white/40 text-center w-full">
        Universidad Gabriela Mistral — 2026. Todos los derechos reservados.
      </p>
    </main>
  );
}
