'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Eye,
  Copy,
  Save,
  Loader2,
  RefreshCw,
  MonitorPlay,
  AlertTriangle,
} from 'lucide-react';

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

  const [title,      setTitle]      = useState('');
  const [subject,    setSubject]    = useState('');
  const [section,    setSection]    = useState('');
  const [duration,   setDuration]   = useState<number>(60);
  const [accessCode, setAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Active-session guard (Bug 4) ───────────────────────────────────────────
  const [activeSession, setActiveSession]       = useState<{ id: string; title: string } | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => { setAccessCode(generateCode()); }, []);

  useEffect(() => {
    if (!user) return;

    const checkActiveSession = async () => {
      try {
        const token = await user.getIdToken();
        const res   = await fetch('/api/exam-sessions/by-instructor', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data    = await res.json();
        const active  = (data.sessions ?? []).find((s: any) => s.status === 'active') ?? null;
        setActiveSession(active ? { id: active.id, title: active.title } : null);
      } catch (err) {
        console.error('[InstructorHome] Error verificando sesión activa:', err);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkActiveSession();
  }, [user]);

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

      toast({ title: 'Sala creada', description: `Código de acceso: ${accessCode}` });
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
        <div
          className="absolute -top-16 -right-16 w-72 h-72 rounded-full pointer-events-none"
          style={{ backgroundColor: '#00D4FF', opacity: 0.06 }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full pointer-events-none"
          style={{ backgroundColor: '#4F5CC0', opacity: 0.12 }}
        />

        <div className="relative z-10 px-8 py-8 pr-[340px] flex flex-col justify-center min-h-[220px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#00D4FF' }}>
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

      {/* ── Active-session banner (Bug 4) ─────────────────────────────────── */}
      {isCheckingSession ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          Verificando si tienes un examen en curso...
        </div>
      ) : activeSession ? (
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
                     p-5 rounded-2xl border-2 shadow-md"
          style={{
            background:   'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
            borderColor:  '#F97316',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#F97316' }}
            >
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-orange-900 uppercase tracking-wide mb-0.5">
                Examen en Curso
              </p>
              <h3 className="text-lg font-extrabold text-orange-800">
                {activeSession.title}
              </h3>
              <p className="text-sm text-orange-700 mt-0.5">
                Ya tienes una sesión activa. Retoma el monitoreo para continuar vigilando a tus estudiantes.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push(`/instructor/live-monitor?examId=${activeSession.id}`)}
            size="lg"
            className="flex-shrink-0 gap-2 font-bold shadow-lg h-12 px-6 whitespace-nowrap"
            style={{ backgroundColor: '#F97316', color: '#fff' }}
          >
            <MonitorPlay className="h-5 w-5" />
            Retomar Monitoreo
          </Button>
        </div>
      ) : null}

      {/* ── Exam creation form ────────────────────────────────────────────── */}
      <div className={activeSession ? 'opacity-50 pointer-events-none select-none' : ''}>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">Crear Nueva Sala de Examen</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeSession
              ? 'Finaliza tu examen activo antes de crear uno nuevo.'
              : 'Completa los datos. Cuando crees la sala serás dirigido directamente al monitor.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

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

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || !!activeSession}
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
