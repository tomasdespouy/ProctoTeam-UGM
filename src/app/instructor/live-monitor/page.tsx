'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ProctorView } from '@/components/proctoring/ProctorView';
import { Loader2, LayoutDashboard, History, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function LiveMonitorContent() {
  const searchParams          = useSearchParams();
  const router                = useRouter();
  const { user, userProfile } = useAuth();
  const examId                = searchParams.get('examId');
  const [checking, setChecking] = useState(true);
  const hasChecked            = useRef(false);

  // ── Sin examId: si hay un examen ACTIVO, saltamos a él. Si no, mostramos un
  //    estado vacío claro (NO redirigimos: antes esto "expulsaba" al docente al
  //    volver de histórico cuando su examen ya había terminado).
  useEffect(() => {
    if (examId) { setChecking(false); return; }
    if (hasChecked.current || !userProfile) return;
    hasChecked.current = true;

    const go = async () => {
      if (userProfile.role !== 'super-admin') {
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
              return; // saltamos al examen activo (checking sigue true durante la nav)
            }
          }
        } catch {
          /* muestra el estado vacío */
        }
      }
      setChecking(false); // sin examen activo → estado vacío, sin expulsar
    };

    go();
  }, [examId, user, userProfile, router]);

  if (examId) {
    return <ProctorView examId={examId} instructorId="instructor" />;
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm">Buscando examen activo…</p>
      </div>
    );
  }

  const dashboardPath = userProfile?.role === 'super-admin' ? '/super-admin/dashboard' : '/instructor';

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Eye className="h-7 w-7 text-slate-400" />
      </div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">No hay examen en curso</h2>
      <p className="text-muted-foreground mb-6 text-sm max-w-sm">
        Cuando inicies una sala de examen, el monitoreo en vivo aparecerá aquí automáticamente.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => router.push(dashboardPath)} className="gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Ir al panel
        </Button>
        {userProfile?.role !== 'super-admin' && (
          <Button variant="outline" onClick={() => router.push('/instructor/historic')} className="gap-2">
            <History className="h-4 w-4" />
            Ver histórico
          </Button>
        )}
      </div>
    </div>
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
