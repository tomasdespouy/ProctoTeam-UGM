"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Bug, GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserProfile } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function TestLoginPage() {
  const [devEmail, setDevEmail] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const { toast } = useToast();
  const { setDevUser } = useAuth();
  const router = useRouter();

  const handleDevLogin = async (email: string, forceRole?: string) => {
    if (devLoading) return;
    setDevLoading(true);
    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(forceRole ? { role: forceRole } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error en test login');

      const profile: UserProfile = {
        id: data.user.id,
        uid: data.user.uid,
        nombre: data.user.nombre,
        correo: data.user.email,
        role: data.user.role,
        photoURL: data.user.photo_url,
      };
      setDevUser(profile, data.devToken);
      toast({ title: "Login exitoso", description: `Entrando como ${profile.role}: ${profile.correo}` });

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

  return (
    <main
      className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden pb-12"
      style={{ background: 'linear-gradient(135deg, #1B2A6B 0%, #0E1845 40%, #080E28 100%)' }}
    >
      <div className="relative z-10 flex flex-col items-center w-full px-4">

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

        <h1 className="font-headline font-black leading-none mb-2 text-center"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}>
          <span style={{ color: '#00D4FF' }}>Procto</span>
          <span className="text-white">Team</span>
        </h1>
        <p className="text-white/80 text-base font-light tracking-wide mb-8 text-center">
          Modo de Pruebas
        </p>

        <div
          className="w-full max-w-md rounded-2xl p-6 border"
          style={{
            background: 'rgba(255,255,255,0.07)',
            borderColor: 'rgba(255,200,50,0.35)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Bug className="h-5 w-5 text-amber-400" />
            <span className="text-amber-300 text-sm font-semibold tracking-wide uppercase">
              Test Login
            </span>
          </div>

          <p className="text-white/60 text-xs mb-4">
            Selecciona un rol para ingresar al sistema como usuario de prueba.
          </p>

          <div className="flex flex-col gap-3 mb-4">
            <Button
              variant="outline"
              onClick={() => { setDevEmail('test@estudiante.ugm.cl'); handleDevLogin('test@estudiante.ugm.cl', 'student'); }}
              disabled={devLoading}
              className="h-12 text-sm border-blue-400/50 text-blue-300 bg-transparent hover:bg-blue-400/10 justify-start"
            >
              <GraduationCap className="h-5 w-5 mr-3" /> Entrar como Estudiante
            </Button>
            <Button
              variant="outline"
              onClick={() => { setDevEmail('test@ugm.cl'); handleDevLogin('test@ugm.cl', 'instructor'); }}
              disabled={devLoading}
              className="h-12 text-sm border-green-400/50 text-green-300 bg-transparent hover:bg-green-400/10 justify-start"
            >
              <BookOpen className="h-5 w-5 mr-3" /> Entrar como Instructor
            </Button>
            <Button
              variant="outline"
              onClick={() => { setDevEmail('admin@ugm.cl'); handleDevLogin('admin@ugm.cl', 'super-admin'); }}
              disabled={devLoading}
              className="h-12 text-sm border-purple-400/50 text-purple-300 bg-transparent hover:bg-purple-400/10 justify-start"
            >
              <ShieldCheck className="h-5 w-5 mr-3" /> Entrar como Super Admin
            </Button>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-white/40 text-xs mb-2">O usa un email personalizado:</p>
            <Input
              type="email"
              placeholder="Email de prueba..."
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              className="mb-2 h-10 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-amber-400"
            />
            <Button
              onClick={() => handleDevLogin(devEmail)}
              disabled={devLoading || !devEmail}
              className="w-full h-10 text-sm bg-amber-500/80 hover:bg-amber-500 text-white"
            >
              {devLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : 'Entrar con email personalizado'}
            </Button>
          </div>
        </div>
      </div>

      <p className="absolute bottom-4 z-10 text-xs text-white/40 text-center w-full">
        ProctoTeam — Entorno de Pruebas
      </p>
    </main>
  );
}
