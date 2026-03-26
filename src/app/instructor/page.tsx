'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, Copy, Save, Loader2, RefreshCw } from 'lucide-react';

// ─── Access-code generator ────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstructorHome() {
  const { user, userProfile } = useAuth();
  const router                = useRouter();
  const { toast }             = useToast();

  const [title, setTitle]         = useState('');
  const [subject, setSubject]     = useState('');
  const [section, setSection]     = useState('');
  const [duration, setDuration]   = useState<number>(60);
  const [accessCode, setAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { setAccessCode(generateCode()); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const idToken  = await user.getIdToken();
      const response = await fetch('/api/exam-sessions/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({ title, subject, section, duration, accessCode }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Error al crear la sala');
      }

      const session = await response.json();

      toast({
        title:       'Sala creada',
        description: `Código de acceso: ${accessCode}`,
      });

      // Navigate directly to live monitor for this exam
      router.push(`/instructor/live-monitor?examId=${session.id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstName = userProfile?.nombre?.split(' ')[0] ?? 'Docente';

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-8">

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

        {/* Text content */}
        <div className="relative z-10 px-8 py-8 pr-[340px] flex flex-col justify-center min-h-[220px]">
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
            style={{ color: '#00D4FF' }}
          >
            ProctoTeam — Portal del Docente
          </p>
          <h1 className="text-3xl font-extrabold text-white leading-tight mb-2">
            Bienvenido, {firstName}
          </h1>
          <p className="text-sm mb-6 max-w-md leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Sistema de vigilancia de exámenes en línea. Crea una sala abajo y empieza a monitorear en tiempo real.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => router.push('/instructor/live-monitor')}
              className="gap-2 font-semibold text-sm h-10 px-5"
              style={{ backgroundColor: '#00D4FF', color: '#1A1D47' }}
            >
              <Eye className="h-4 w-4" />
              Monitor en Vivo
            </Button>
            <Button
              onClick={() => router.push('/instructor/historic')}
              variant="ghost"
              className="gap-2 font-semibold text-sm h-10 px-5 border border-white/20 text-white hover:bg-white/10"
            >
              Ver Histórico
            </Button>
          </div>
        </div>

        {/* Avatar images — anchored to bottom-right */}
        <div
          className="absolute bottom-0 right-0 flex items-end pointer-events-none select-none"
          style={{ height: '100%' }}
        >
          <Image
            src="/avatar-female.png"
            alt="Profesora"
            width={160}
            height={200}
            className="object-contain object-bottom"
            style={{ height: '88%', width: 'auto', marginRight: '-12px' }}
            priority
          />
          <Image
            src="/avatar-male.png"
            alt="Profesor"
            width={170}
            height={210}
            className="object-contain object-bottom"
            style={{ height: '100%', width: 'auto' }}
            priority
          />
        </div>
      </div>

      {/* ── Exam creation form ────────────────────────────────────────────── */}
      <div>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">Crear Nueva Sala de Examen</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Completa los datos. Cuando crees la sala serás dirigido directamente al monitor.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold text-gray-700">
                Título del Examen
              </Label>
              <Input
                id="title"
                placeholder="Ej: Evaluación Solemne 1"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="h-11 border-gray-200 focus-visible:ring-[#00D4FF]"
              />
            </div>

            {/* Asignatura + Sección */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-semibold text-gray-700">
                  Asignatura
                </Label>
                <Input
                  id="subject"
                  placeholder="Ej: Cálculo I"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                  className="h-11 border-gray-200 focus-visible:ring-[#00D4FF]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section" className="text-sm font-semibold text-gray-700">
                  Sección / Grupo
                </Label>
                <Input
                  id="section"
                  placeholder="Ej: 004D"
                  value={section}
                  onChange={e => setSection(e.target.value)}
                  required
                  className="h-11 border-gray-200 focus-visible:ring-[#00D4FF]"
                />
              </div>
            </div>

            {/* Duración + Código */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-semibold text-gray-700">
                  Duración (minutos)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="600"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  required
                  className="h-11 border-gray-200 focus-visible:ring-[#00D4FF]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Código de Acceso
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={accessCode}
                    readOnly
                    className="h-11 font-mono text-center text-xl tracking-[0.3em] bg-gray-50 border-gray-200 font-extrabold"
                    style={{ color: '#1A1D47' }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-gray-200 flex-shrink-0"
                    title="Generar nuevo código"
                    onClick={() => setAccessCode(generateCode())}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-gray-200 flex-shrink-0"
                    title="Copiar código"
                    onClick={() => {
                      navigator.clipboard.writeText(accessCode);
                      toast({ description: 'Código copiado al portapapeles' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Comparte este código con tus estudiantes para que puedan unirse.
                </p>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 px-8 font-bold gap-2 text-sm"
                style={{ backgroundColor: '#1A1D47', color: '#fff' }}
              >
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando sala...</>
                  : <><Save className="h-4 w-4" /> Crear Sala y Monitorear</>}
              </Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
