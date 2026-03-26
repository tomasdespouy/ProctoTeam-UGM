'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentHomePage() {
  const { user, userProfile, loading } = useAuth();
  const [accessCode, setAccessCode]     = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const router   = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isModalOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isModalOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleJoinExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !accessCode.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/exam-sessions/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ accessCode: accessCode.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Error al unirse al examen');

      toast({ title: '¡Éxito!', description: `Uniéndote a: ${data.title || 'Examen'}` });
      setIsModalOpen(false);
      setAccessCode('');
      router.push(`/student/exam/${data.examId}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'No se pudo ingresar',
        description: error.message || 'Verifica el código e inténtalo de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#e8eaf2' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#242f62' }} />
      </div>
    );
  }

  const firstName = userProfile?.nombre?.split(' ')[0] ?? 'Estudiante';

  return (
    <div className="min-h-screen px-6 py-8 space-y-8" style={{ backgroundColor: '#e8eaf2' }}>

      {/* ── Hero Banner ──────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1A1D47 0%, #242F62 55%, #2A3A8A 100%)',
          minHeight: 220,
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-16 -right-16 w-72 h-72 rounded-full pointer-events-none"
          style={{ backgroundColor: '#00D4FF', opacity: 0.06 }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full pointer-events-none"
          style={{ backgroundColor: '#4F5CC0', opacity: 0.12 }}
        />

        {/* Text */}
        <div className="relative z-10 px-8 py-8 pr-[260px] flex flex-col justify-center min-h-[220px]">
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
            style={{ color: '#00D4FF' }}
          >
            ProctoTeam — Portal del Estudiante
          </p>
          <h1 className="text-3xl font-extrabold text-white leading-tight mb-2">
            Bienvenido, {firstName}
          </h1>
          <p className="text-sm mb-6 max-w-md leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Sistema de vigilancia de exámenes en línea. Ingresa el código de tu docente para comenzar.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => setIsModalOpen(true)}
              className="gap-2 font-semibold text-sm h-10 px-5"
              style={{ backgroundColor: '#00D4FF', color: '#1A1D47' }}
            >
              <KeyRound className="h-4 w-4" />
              Unirse a un Examen
            </Button>
            <Button
              onClick={() => router.push('/student/historic')}
              variant="ghost"
              className="gap-2 font-semibold text-sm h-10 px-5 border border-white/20 text-white hover:bg-white/10"
            >
              <History className="h-4 w-4" />
              Ver Histórico
            </Button>
          </div>
        </div>

        {/* Avatar images */}
        <div
          className="absolute bottom-0 right-0 flex items-end pointer-events-none select-none"
          style={{ height: '100%' }}
        >
          <Image
            src="/avatar-female.png"
            alt="Estudiante"
            width={160}
            height={200}
            className="object-contain object-bottom"
            style={{ height: '88%', width: 'auto', marginRight: '-12px' }}
            priority
          />
          <Image
            src="/avatar-male.png"
            alt="Estudiante"
            width={170}
            height={210}
            className="object-contain object-bottom"
            style={{ height: '100%', width: 'auto' }}
            priority
          />
        </div>
      </div>

      {/* ── Quick join card ───────────────────────────────────────────────── */}
      <div>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">Unirse a una Sesión de Examen</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Ingresa el código de acceso que tu docente compartió contigo.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 max-w-lg">
          <form
            onSubmit={handleJoinExam}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="access-code" className="text-sm font-semibold text-gray-700">
                Código de Acceso
              </Label>
              <Input
                ref={inputRef}
                id="access-code"
                value={accessCode}
                onChange={e => setAccessCode(e.target.value)}
                placeholder="Ej: AB12CD"
                required
                className="h-11 font-mono text-center text-xl tracking-[0.3em] border-gray-200 focus-visible:ring-[#00D4FF] font-extrabold uppercase"
                style={{ color: '#1A1D47' }}
              />
              <p className="text-xs text-gray-400">El código tiene 6 caracteres y es case-insensitive.</p>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !accessCode.trim()}
              className="w-full h-11 font-bold gap-2 text-sm"
              style={{ backgroundColor: '#1A1D47', color: '#fff' }}
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</>
                : <><KeyRound className="h-4 w-4" /> Unirse al Examen</>}
            </Button>
          </form>
        </div>
      </div>

      {/* ── Join modal (kept for backwards compatibility with header button) ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              background: 'linear-gradient(135deg, rgba(0,140,220,0.55) 0%, rgba(90,80,200,0.45) 100%)',
            }}
          />
          <div
            className="relative z-10 bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <form onSubmit={handleJoinExam}>
              <div className="p-6 space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="h-5 w-5 text-[#5B5ECD]" />
                    <h3 className="text-lg font-bold text-[#1A1D47]">Unirse a un examen</h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-snug">
                    Ingresa el código de acceso proporcionado por tu docente.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modal-code" className="text-[#1A1D47] font-medium text-sm">
                    Código de Acceso:
                  </Label>
                  <Input
                    id="modal-code"
                    value={accessCode}
                    onChange={e => setAccessCode(e.target.value)}
                    required
                    className="font-mono text-base tracking-widest text-[#1A1D47] border-gray-300 focus:border-[#5B5ECD] uppercase"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 text-white font-semibold rounded-full text-base"
                  style={{ background: '#1A1D47' }}
                  disabled={isLoading || !accessCode.trim()}
                >
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</>
                    : 'Unirse al Examen'}
                </Button>
              </div>
              <div className="h-1.5 w-full" style={{ background: '#00BBFF' }} />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
