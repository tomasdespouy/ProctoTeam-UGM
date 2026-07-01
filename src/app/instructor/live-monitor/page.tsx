'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ProctorView } from '@/components/proctoring/ProctorView';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function LiveMonitorContent() {
  const searchParams        = useSearchParams();
  const router              = useRouter();
  const { user, userProfile } = useAuth();
  const examId              = searchParams.get('examId');
  const hasRedirected       = useRef(false);

  // ── Sin examId: buscar la sesión activa y, si no hay, VOLVER al dashboard ──
  // (Antes se quedaba pegado en "Buscando examen activo…" para siempre: los
  //  super-admin no tienen exámenes propios, y un docente sin examen activo
  //  tampoco resolvía nunca.)
  useEffect(() => {
    if (examId || hasRedirected.current || !userProfile) return;
    hasRedirected.current = true;

    const go = async () => {
      // El super-admin no crea exámenes → no hay "activo propio"; a su panel.
      if (userProfile.role === 'super-admin') {
        router.replace('/super-admin/dashboard');
        return;
      }
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch('/api/exam-sessions/by-instructor', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const active = (data.sessions ?? []).find((s: any) => s.status === 'active');
          if (active) {
            router.replace(`/instructor/live-monitor?examId=${active.id}`);
            return;
          }
        }
      } catch {
        /* cae al redirect de abajo */
      }
      // No hay examen activo → volver al dashboard (como promete el texto).
      router.replace('/instructor');
    };

    go();
  }, [examId, user, userProfile, router]);

  if (!examId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2 text-gray-800">Buscando examen activo…</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Si no tienes un examen en curso serás redirigido al Dashboard.
        </p>
        <Button variant="outline" onClick={() => router.push('/instructor')}>
          <Users className="h-4 w-4 mr-2" />
          Ir al Dashboard
        </Button>
      </div>
    );
  }

  return (
    <ProctorView
      examId={examId}
      instructorId="instructor"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LiveMonitorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LiveMonitorContent />
    </Suspense>
  );
}
