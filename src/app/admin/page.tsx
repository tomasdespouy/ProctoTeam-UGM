'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ProctorView } from '@/components/proctoring/ProctorView';
import { RecordingsDialog } from '@/components/proctoring/recordings-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Eye, ArrowLeft, Users, RefreshCw, BookOpen, Video, ShieldAlert, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActiveExam {
  id: string; title: string; subject: string; section: string;
  instructor_name: string | null; student_count: number;
}
interface AuditExam extends ActiveExam {
  status: 'pending' | 'active' | 'finished';
  created_at: string;
  instructor_email: string | null;
  alert_count: number;
}
interface AuditAlert {
  id: string; student_name: string | null; severity: 'critical' | 'warning' | 'info';
  description: string; evidence_url: string | null; timestamp: string;
}

const SEV_COLOR: Record<string, string> = { critical: '#EF4444', warning: '#F97316', info: '#3B82F6' };
const SEV_LABEL: Record<string, string> = { critical: 'Crítica', warning: 'Advertencia', info: 'Info' };
const STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', active: 'En vivo', finished: 'Finalizado' };

// ─── Alerts dialog (auditoría por examen) ──────────────────────────────────────

function AlertsDialog({ examId, title, token, count }: { examId: string; title: string; token: string | null; count: number }) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    fetch(`/api/exam-sessions/${examId}/alerts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setAlerts(d.alerts ?? []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [open, examId, token]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs border-red-200 text-red-600 hover:bg-red-50">
          <ShieldAlert className="h-3.5 w-3.5" /> {count}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Alertas — {title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Sin alertas registradas.</p>
          ) : (
            alerts.map(a => (
              <div key={a.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0"
                  style={{ backgroundColor: SEV_COLOR[a.severity] ?? '#6B7280' }}>
                  {SEV_LABEL[a.severity] ?? a.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.student_name ?? '—'}</p>
                  <p className="text-xs text-slate-600 break-words">{a.description}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {format(new Date(a.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                  </p>
                </div>
                {a.evidence_url && (
                  <a href={a.evidence_url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-blue-600 hover:underline flex-shrink-0 mt-0.5">
                    Ver foto
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Content ───────────────────────────────────────────────────────────────────

function AdminContent() {
  const searchParams          = useSearchParams();
  const router                = useRouter();
  const { user, userProfile, loading } = useAuth();
  const examId                = searchParams.get('examId');

  const [token,   setToken]   = useState<string | null>(null);
  const [live,    setLive]    = useState<ActiveExam[]>([]);
  const [audit,   setAudit]   = useState<AuditExam[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && userProfile && userProfile.role !== 'admin' && userProfile.role !== 'super-admin') {
      router.push('/');
    }
  }, [loading, userProfile, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const t = await user.getIdToken();
      setToken(t);
      const [liveRes, auditRes] = await Promise.all([
        fetch('/api/exam-sessions/active', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/exam-sessions/audit',  { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (liveRes.ok)  setLive((await liveRes.json()).sessions ?? []);
      if (auditRes.ok) setAudit((await auditRes.json()).sessions ?? []);
    } catch (err) {
      console.error('[Admin] Error cargando datos:', err);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => { if (user && !examId) fetchData(); }, [user, examId, fetchData]);

  // ── Viendo un examen en vivo (solo lectura) ────────────────────────────────
  if (examId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 sticky top-0 z-40">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4" /> Panel de auditoría
          </Button>
          <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            <Eye className="h-3.5 w-3.5" /> Modo Admin — solo lectura
          </span>
        </div>
        <ProctorView examId={examId} instructorId="admin" readOnly />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-violet-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Admin · Auditoría
            </p>
            <h1 className="text-3xl font-black text-slate-800">Panel de Auditoría</h1>
            <p className="text-slate-500 text-sm mt-1">
              Monitorea en vivo (solo lectura) y audita las grabaciones y alertas de todos los exámenes.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </Button>
        </div>

        {/* ── En vivo ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-red-500" /> En vivo
            {live.length > 0 && <span className="text-xs font-normal text-slate-400">({live.length})</span>}
          </h2>
          {loadingData ? (
            <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-violet-500" /></div>
          ) : live.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No hay exámenes en curso ahora.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {live.map(e => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/admin?examId=${e.id}`)}
                  className="text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-violet-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{e.title}</p>
                      <p className="text-xs text-slate-500 truncate">{e.subject} · Sección {e.section}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 flex-shrink-0">● En vivo</span>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> {e.instructor_name ?? '—'}</span>
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {e.student_count}</span>
                    <span className="ml-auto flex items-center gap-1 text-violet-600 font-semibold"><Eye className="h-3.5 w-3.5" /> Observar</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Auditoría de grabaciones ─────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Video className="h-4 w-4 text-indigo-500" /> Auditoría de grabaciones
            {audit.length > 0 && <span className="text-xs font-normal text-slate-400">({audit.length})</span>}
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingData ? (
              <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>
            ) : audit.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-14">No hay exámenes registrados.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {audit.map(e => (
                  <div key={e.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{e.title}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          e.status === 'active' ? 'bg-green-100 text-green-700'
                            : e.status === 'finished' ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-100 text-amber-700'}`}>
                          {STATUS_LABEL[e.status] ?? e.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {e.subject} · {e.instructor_name ?? '—'} · {format(new Date(e.created_at), 'dd/MM/yyyy', { locale: es })}
                      </p>
                    </div>
                    <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                      <Users className="h-3.5 w-3.5" /> {e.student_count}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {e.alert_count > 0 && (
                        <AlertsDialog examId={e.id} title={e.title} token={token} count={e.alert_count} />
                      )}
                      <RecordingsDialog
                        examId={e.id}
                        title={e.title}
                        token={token}
                        trigger={
                          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                            <Video className="h-3.5 w-3.5" /> Grabaciones
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex justify-center items-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
