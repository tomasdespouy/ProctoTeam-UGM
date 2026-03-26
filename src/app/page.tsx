"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Bug, GraduationCap, BookOpen } from 'lucide-react';
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
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-[#0D1240]">

      {/* ── Background base gradient ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0D1240 0%, #1A1D6E 50%, #0D1240 100%)',
        }}
      />

      {/* ── LEFT: UGM letters — vertically stacked U·G·M sketch ── */}
      <div
        className="absolute left-0 top-0 bottom-0 pointer-events-none select-none overflow-hidden"
        style={{ zIndex: 1, width: '42%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ugm-letters.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-left-top"
          style={{
            opacity: 0.55,
            mixBlendMode: 'screen',
            filter: 'invert(1)',
          }}
        />
        {/* Fade right edge to blend seamlessly with center */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, transparent 60%, #0D1240 100%)',
          }}
        />
      </div>

      {/* ── RIGHT: Gabriela Mistral portrait with left fade ── */}
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
            opacity: 0.65,
            mixBlendMode: 'screen',
            filter: 'invert(1)',
          }}
        />
        {/* Gradient fade: solid navy left → transparent right (the "efecto de fade") */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #0D1240 0%, rgba(13,18,64,0.92) 18%, rgba(13,18,64,0.65) 40%, rgba(13,18,64,0.2) 65%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Page content ── */}
      <div className="relative flex flex-col min-h-screen" style={{ zIndex: 2 }}>

        {/* UGM University Logo — top center */}
        <div className="flex justify-center pt-8 pb-2">
          <Image
            src="/ugm-logo.png"
            alt="Universidad Gabriela Mistral"
            width={220}
            height={44}
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.9, width: 'auto', height: '44px' }}
            priority
          />
        </div>

        {/* Title */}
        <div className="text-center mt-6 mb-8">
          <h1 className="font-headline font-black leading-none" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
            <span className="text-[#00BBFF]">Procto</span>
            <span className="text-white">Team</span>
          </h1>
          <p className="text-white/70 mt-2 text-base font-light tracking-wide">
            Sistema de Vigilancia de Exámenes en Línea
          </p>
        </div>

        {/* ── Login Card ── */}
        <div className="flex flex-col items-center px-4 pb-24">
          <div
            className="bg-white w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ boxShadow: '0px 8px 40px rgba(0,0,0,0.55)' }}
          >
            {/* Card top */}
            <div className="flex flex-col items-center pt-8 pb-4 px-8">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #1A1D47 0%, #242F62 100%)' }}
              >
                <svg viewBox="0 0 40 40" className="w-11 h-11" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 8L4 16L20 24L36 16L20 8Z" fill="white"/>
                  <path d="M8 18.5V27C8 27 12 31 20 31C28 31 32 27 32 27V18.5L20 24.5L8 18.5Z" fill="white" opacity="0.85"/>
                  <rect x="34" y="15" width="3" height="12" rx="1.5" fill="white" opacity="0.7"/>
                  <circle cx="35.5" cy="28" r="2.5" fill="white" opacity="0.7"/>
                </svg>
              </div>

              <h2 className="text-[#1A1D47] font-headline font-bold text-xl mb-1">
                Portal de estudiante
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Accede para rendir tu examen
              </p>

              <div className="w-full h-px bg-gray-200 mb-6" />

              <div className="w-full">
                <p className="text-[#1A1D47] font-bold text-base mb-5">
                  Iniciar sesión
                </p>

                <div className="mb-3">
                  <label className="block text-[#1A1D47] text-xs font-medium mb-1">
                    E-mail institucional
                  </label>
                  <div
                    className="w-full h-10 rounded-lg px-3 flex items-center text-sm text-gray-400"
                    style={{ background: '#D6EFFF', border: '1px solid #B3DFFF' }}
                  >
                    correo@ugm.cl
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-[#1A1D47] text-xs font-medium mb-1">
                    Contraseña
                  </label>
                  <div
                    className="w-full h-10 rounded-lg px-3 flex items-center gap-1"
                    style={{ background: '#D6EFFF', border: '1px solid #B3DFFF' }}
                  >
                    {[...Array(8)].map((_, i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-[#1A1D47]/40 inline-block" />
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full h-11 text-white font-semibold text-base rounded-lg transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #1A1D47 0%, #242F62 100%)',
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>

                <p className="text-center text-gray-400 text-[11px] mt-3">
                  Autenticación vía Microsoft Azure AD
                </p>
              </div>
            </div>

            {/* Bottom cyan bar */}
            <div className="h-2 w-full" style={{ background: '#00BBFF' }} />
          </div>

          {/* ── Dev Login Panel ── */}
          {SHOW_DEV_LOGIN && (
            <div
              className="mt-4 w-full max-w-sm rounded-xl p-4 border"
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
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
        >
          <p className="text-white/50 text-xs">
            Universidad Gabriela Mistral - 2026. Todos los derechos reservados.
          </p>
        </footer>
      </div>
    </main>
  );
}
