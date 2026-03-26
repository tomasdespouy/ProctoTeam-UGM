'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ProctorView } from '@/components/proctoring/ProctorView';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function LiveMonitorContent() {
  const searchParams    = useSearchParams();
  const router          = useRouter();
  const { user }        = useAuth();
  const examId          = searchParams.get('examId');
  const hasRedirected   = useRef(false);

  // ── Auto-redirect: if no examId try to find the instructor's active session ─
  useEffect(() => {
    if (examId || hasRedirected.current) return;

    const fetchActive = async () => {
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch('/api/exam-sessions/by-instructor', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const active = (data.sessions ?? []).find((s: any) => s.status === 'active');
        if (active) {
          hasRedirected.current = true;
          router.replace(`/instructor/live-monitor?examId=${active.id}`);
        }
      } catch {
        // silent — if fetch fails show the empty state
      }
    };

    fetchActive();
  }, [examId, user, router]);

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
