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
      router.push(profile.role === 'student' ? '/student' : '/instructor');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden"
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

      {/* ── Centre content ── */}
      <div className="relative z-10 flex flex-col items-center w-full px-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/ugm-logo.png"
            alt="Universidad Gabriela Mistral"
            width={220}
            height={44}
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.95, width: 'auto', height: '44px' }}
            priority
          />
        </div>

        {/* Title */}
        <h1 className="font-headline font-black leading-none mb-2 text-center"
            style={{ fontSize: 'clamp(40px, 5.5vw, 72px)' }}>
          <span style={{ color: '#00D4FF' }}>UGM </span>
          <span className="text-white">Proctor</span>
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
              placeholder="Email de prueba..."
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              className="mb-2 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-amber-400"
            />
            <div className="flex gap-2 mb-2">
              <Button
                variant="outline" size="sm"
                onClick={() => { setDevEmail('test@estudiante.ugm.cl'); handleDevLogin('test@estudiante.ugm.cl'); }}
                disabled={devLoading}
                className="flex-1 h-8 text-xs border-blue-400/50 text-blue-300 bg-transparent hover:bg-blue-400/10"
              >
                <GraduationCap className="h-3 w-3 mr-1" /> Estudiante
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { setDevEmail('test@ugm.cl'); handleDevLogin('test@ugm.cl'); }}
                disabled={devLoading}
                className="flex-1 h-8 text-xs border-green-400/50 text-green-300 bg-transparent hover:bg-green-400/10"
              >
                <BookOpen className="h-3 w-3 mr-1" /> Instructor
              </Button>
            </div>
            <Button
              onClick={() => handleDevLogin(devEmail)}
              disabled={devLoading || !devEmail}
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
