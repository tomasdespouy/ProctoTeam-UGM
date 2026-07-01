'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ProctorView } from '@/components/proctoring/ProctorView';
import { Loader2, Eye, ArrowLeft, Users, RefreshCw, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActiveExam {
  id: string;
  title: string;
  subject: string;
  section: string;
  instructor_name: string | null;
  student_count: number;
}

function ObserverContent() {
  const searchParams          = useSearchParams();
  const router                = useRouter();
  const { user, userProfile, loading } = useAuth();
  const examId                = searchParams.get('examId');

  const [exams,     setExams]     = useState<ActiveExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Solo observador o super-admin
  useEffect(() => {
    if (!loading && userProfile && userProfile.role !== 'observer' && userProfile.role !== 'super-admin') {
      router.push('/');
    }
  }, [loading, userProfile, router]);

  const fetchActive = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/exam-sessions/active', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setExams(data.sessions ?? []);
      }
    } catch (err) {
      console.error('[Observer] Error cargando exámenes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user && !examId) fetchActive(); }, [user, examId, fetchActive]);

  // ── Viewing a specific exam (read-only) ────────────────────────────────────
  if (examId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 sticky top-0 z-40">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push('/observer')}>
            <ArrowLeft className="h-4 w-4" /> Exámenes en curso
          </Button>
          <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            <Eye className="h-3.5 w-3.5" /> Modo Observador — solo lectura
          </span>
        </div>
        <ProctorView examId={examId} instructorId="observer" readOnly />
      </div>
    );
  }

  // ── Listing active exams ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-end justify-between gap-2 mb-6">
          <div>
            <p className="text-xs font-bold text-violet-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Observador
            </p>
            <h1 className="text-3xl font-black text-slate-800">Monitoreo en vivo</h1>
            <p className="text-slate-500 text-sm mt-1">
              Elige un examen en curso para observarlo. No puedes intervenir; solo visualizar.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchActive}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-2">
              <Eye className="h-7 w-7 text-slate-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-700">No hay exámenes en curso</h2>
            <p className="text-sm text-slate-400 max-w-sm">
              Cuando un docente inicie una sala, aparecerá aquí para que puedas observarla.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map(e => (
              <button
                key={e.id}
                onClick={() => router.push(`/observer?examId=${e.id}`)}
                className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-violet-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{e.title}</p>
                    <p className="text-sm text-slate-500 truncate">{e.subject} · Sección {e.section}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 flex-shrink-0">
                    ● En vivo
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> {e.instructor_name ?? '—'}</span>
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {e.student_count} alumno{e.student_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-violet-600">
                  <Eye className="h-4 w-4" /> Observar
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ObserverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex justify-center items-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      }
    >
      <ObserverContent />
    </Suspense>
  );
}
