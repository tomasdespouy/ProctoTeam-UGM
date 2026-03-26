"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Bug, GraduationCap, BookOpen, CheckCircle, Settings } from 'lucide-react';
import { signInWithAzurePopup, signInWithAzureRedirect } from '@/lib/azure-auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserProfile } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

const SHOW_DEV_LOGIN = process.env.NEXT_PUBLIC_SHOW_DEV_LOGIN === 'true';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const { toast } = useToast();
  const { setDevUser } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const result = await signInWithAzurePopup();

      if (result.error) {
        console.warn("Popup falló, intentando redirección...", result.error);
        await signInWithAzureRedirect();
      }
    } catch (error) {
      console.error("Error en login:", error);
      toast({
        variant: "destructive",
        title: "Error de conexión",
        description: "No se pudo iniciar sesión con Microsoft.",
      });
      setIsLoading(false);
    }
  };

  const handleDevLogin = async (email: string) => {
    if (devLoading) return;
    setDevLoading(true);

    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en dev login');
      }

      const profile: UserProfile = {
        id: data.user.id,
        uid: data.user.uid,
        nombre: data.user.nombre,
        correo: data.user.email,
        role: data.user.role,
        photoURL: data.user.photo_url,
      };

      setDevUser(profile, data.devToken);

      toast({
        title: "Dev Login exitoso",
        description: `Entrando como ${profile.role}: ${profile.correo}`,
      });

      if (profile.role === 'student') {
        router.push('/student');
      } else {
        router.push('/instructor');
      }
    } catch (error: any) {
      console.error("Error en dev login:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo iniciar sesión de desarrollo.",
      });
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#0B1547' }}>

      {/* ── Background: vivid blue radial gradient ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 55% 50%, #1A3A9E 0%, #0F2070 40%, #0B1547 75%, #080E2E 100%)',
        }}
      />

      {/* ── LEFT: UGM letters — multiply blend keeps blue tones ── */}
      <div
        className="absolute left-0 top-0 bottom-0 pointer-events-none select-none overflow-hidden"
        style={{ zIndex: 1, width: '44%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ugm-letters.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-left-top"
          style={{
            opacity: 0.45,
            mixBlendMode: 'multiply',
          }}
        />
        {/* Soft right-edge fade */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, transparent 50%, #0F2070 90%, #0B1547 100%)',
          }}
        />
      </div>

      {/* ── RIGHT: Gabriela Mistral portrait — blue-tinted ghost ── */}
      <div
        className="absolute right-0 top-0 bottom-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 1, width: '65%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/gabriela-mistral-sketch.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
          style={{
            opacity: 0.55,
            mixBlendMode: 'screen',
            filter: 'sepia(1) hue-rotate(195deg) saturate(2.5) brightness(1.5)',
          }}
        />
        {/* Left fade: solid → transparent */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #0B1547 0%, rgba(11,21,71,0.88) 20%, rgba(11,21,71,0.55) 42%, rgba(11,21,71,0.18) 65%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Page content ── */}
      <div className="relative flex flex-col min-h-screen" style={{ zIndex: 2 }}>

        {/* Logo — top center */}
        <div className="flex justify-center pt-8 pb-1">
          <div className="flex flex-col items-center gap-1">
            <Image
              src="/ugm-logo.png"
              alt="Universidad Gabriela Mistral"
              width={220}
              height={44}
              style={{ filter: 'brightness(0) invert(1)', opacity: 0.95, width: 'auto', height: '40px' }}
              priority
            />
            <p className="text-white/50 text-[11px] italic tracking-wide">
              Juntos escribimos tu futuro
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mt-5 mb-8">
          <h1 className="font-headline font-black leading-none" style={{ fontSize: 'clamp(42px, 6vw, 76px)' }}>
            <span className="text-[#00CCFF]">UGM </span>
            <span className="text-white">Proctor</span>
          </h1>
          <p className="text-white/75 mt-2 text-base font-light tracking-wide">
            Sistema de Vigilancia de Exámenes en Línea
          </p>
        </div>

        {/* ── Role selection area ── */}
        <div className="flex flex-col items-center px-4 pb-24">

          <h2 className="text-white font-semibold text-xl mb-6 tracking-wide">
            ¿Cómo deseas ingresar?
          </h2>

          {/* Two informational cards */}
          <div className="flex gap-5 w-full max-w-xl mb-8">

            {/* Card: Portal de Estudiante */}
            <div
              className="flex-1 rounded-2xl p-6 flex flex-col items-center text-center relative"
              style={{
                background: 'rgba(255,255,255,0.97)',
                border: '2px solid #00CCFF',
                boxShadow: '0 4px 24px rgba(0,204,255,0.25)',
              }}
            >
              <div className="absolute top-3 right-3">
                <CheckCircle className="w-5 h-5 text-[#00CCFF]" />
              </div>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #00CCFF 0%, #007BCC 100%)' }}
              >
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-[#1A1D47] font-bold text-base mb-1">
                Portal de Estudiante
              </h3>
              <p className="text-gray-500 text-sm mb-3">
                Accede para rendir tu examen
              </p>
              <div className="w-8 h-0.5 bg-[#1A1D47] mb-3" />
              <p className="text-gray-400 text-xs leading-relaxed">
                Ingresa con tu cuenta institucional UGM para acceder a tus exámenes en línea bajo vigilancia.
              </p>
            </div>

            {/* Card: Panel del Docente */}
            <div
              className="flex-1 rounded-2xl p-6 flex flex-col items-center text-center relative"
              style={{
                background: 'rgba(255,255,255,0.97)',
                border: '2px solid rgba(200,210,230,0.6)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                opacity: 0.85,
              }}
            >
              <div className="absolute top-3 right-3">
                <CheckCircle className="w-5 h-5 text-gray-300" />
              </div>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #C8D2E6 0%, #A0AABF 100%)' }}
              >
                <Settings className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-[#1A1D47] font-bold text-base mb-1">
                Panel del Docente
              </h3>
              <p className="text-gray-500 text-sm mb-3">
                Monitorea el progreso del examen
              </p>
              <div className="w-8 h-0.5 bg-gray-300 mb-3" />
              <p className="text-gray-400 text-xs leading-relaxed">
                Supervisa en tiempo real el estado de tus estudiantes durante el examen.
              </p>
            </div>
          </div>

          {/* SSO entry button */}
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full h-12 text-white font-bold text-base rounded-xl transition-all duration-200 shadow-lg"
              style={{
                background: isLoading
                  ? 'rgba(255,255,255,0.15)'
                  : 'linear-gradient(135deg, #0055AA 0%, #0077DD 100%)',
                boxShadow: '0 4px 20px rgba(0,119,221,0.45)',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando…
                </>
              ) : (
                <>Entrar &nbsp;→</>
              )}
            </Button>
            <p className="text-white/45 text-[11px] text-center">
              El portal se asigna automáticamente según tu correo institucional
            </p>
          </div>

          {/* ── Dev Login Panel ── */}
          {SHOW_DEV_LOGIN && (
            <div
              className="mt-6 w-full max-w-sm rounded-xl p-4 border"
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,200,50,0.4)',
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
                placeholder="Email de prueba..."
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                className="mb-2 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-amber-400"
              />

              <div className="flex gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDevEmail('test@estudiante.ugm.cl');
                    handleDevLogin('test@estudiante.ugm.cl');
                  }}
                  disabled={devLoading}
                  className="flex-1 h-8 text-xs border-blue-400/50 text-blue-300 bg-transparent hover:bg-blue-400/10"
                >
                  <GraduationCap className="h-3 w-3 mr-1" />
                  Estudiante
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDevEmail('test@ugm.cl');
                    handleDevLogin('test@ugm.cl');
                  }}
                  disabled={devLoading}
                  className="flex-1 h-8 text-xs border-green-400/50 text-green-300 bg-transparent hover:bg-green-400/10"
                >
                  <BookOpen className="h-3 w-3 mr-1" />
                  Instructor
                </Button>
              </div>

              <Button
                onClick={() => handleDevLogin(devEmail)}
                disabled={devLoading || !devEmail}
                size="sm"
                className="w-full h-8 text-xs bg-amber-500/80 hover:bg-amber-500 text-white"
              >
                {devLoading ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar con email personalizado'
                )}
              </Button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer
          className="absolute bottom-0 left-0 right-0 py-3 text-center"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
        >
          <p className="text-white/40 text-xs">
            Universidad Gabriela Mistral — 2025. Todos los derechos reservados.
          </p>
        </footer>
      </div>
    </main>
  );
}
