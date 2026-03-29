'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users, FileText, Activity, ShieldAlert, AlertTriangle, Info,
  Search, Loader2, Calendar, UserCheck, Eye, Camera, Download,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalExams:        number;
  activeExams:       number;
  totalStudents:     number;
  totalInstructors:  number;
}

interface ExamSessionData {
  id:                string;
  title:             string;
  subject:           string;
  status:            'pending' | 'active' | 'finished';
  created_at:        string;
  access_code:       string;
  instructor_name:   string;
  instructor_email:  string;
  student_count:     number;
  critical_alerts:   number;
}

interface RecentAlert {
  id:                   string;
  timestamp:            string;
  severity:             'critical' | 'warning' | 'info';
  description:          string;
  evidence_url:         string | null;
  student_email_masked: string;
  exam_subject:         string;
  exam_title:           string;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, accent, live = false, sub,
}: {
  label:   string;
  value:   number | string;
  icon:    React.ElementType;
  accent:  string;
  live?:   boolean;
  sub?:    string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-black text-slate-800 leading-none">{value}</span>
        {live && (
          <span className="flex items-center gap-1 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-semibold">LIVE</span>
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-slate-400 leading-snug">{sub}</p>}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ExamSessionData['status'] }) {
  if (status === 'active')  return <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] animate-pulse">EN VIVO</Badge>;
  if (status === 'pending') return <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">Pendiente</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Finalizado</Badge>;
}

// ─── Severity badge (shared with alerts widget) ───────────────────────────────

function SeverityBadge({ severity }: { severity: RecentAlert['severity'] }) {
  if (severity === 'critical') return (
    <Badge className="gap-1 bg-red-100 text-red-700 border border-red-200 hover:bg-red-100 text-[10px]">
      <ShieldAlert className="h-3 w-3" /> Crítica
    </Badge>
  );
  if (severity === 'warning') return (
    <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[10px]">
      <AlertTriangle className="h-3 w-3" /> Advertencia
    </Badge>
  );
  return (
    <Badge className="gap-1 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[10px]">
      <Info className="h-3 w-3" /> Info
    </Badge>
  );
}

// ─── Evidence Dialog — same pattern as ProctorView & Histórico ────────────────

function EvidenceDialog({ alert }: { alert: RecentAlert }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-400"
        >
          <Camera className="h-3 w-3" />
          Ver Foto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm font-semibold text-slate-800 leading-tight">
            Evidencia fotográfica
            <span className="ml-2 font-normal text-slate-400">— {alert.student_email_masked}</span>
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-0.5">{alert.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <SeverityBadge severity={alert.severity} />
            <span className="text-[10px] text-slate-400">
              {new Date(alert.timestamp).toLocaleString('es-CL', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {alert.exam_subject && (
              <span className="text-[10px] text-slate-400">· {alert.exam_subject}</span>
            )}
          </div>
        </DialogHeader>
        <div className="bg-black">
          <img
            src={alert.evidence_url!}
            alt={`Evidencia — ${alert.description}`}
            className="w-full object-contain max-h-[60vh]"
          />
        </div>
        <div className="px-5 py-3 flex justify-end">
          <a
            href={alert.evidence_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Abrir en nueva pestaña
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [stats,         setStats]         = useState<DashboardStats | null>(null);
  const [exams,         setExams]         = useState<ExamSessionData[]>([]);
  const [recentAlerts,  setRecentAlerts]  = useState<RecentAlert[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchTerm,    setSearchTerm]    = useState('');

  // Auth guard
  useEffect(() => {
    if (!loading && userProfile && userProfile.role !== 'super-admin') {
      router.push('/');
    }
  }, [loading, userProfile, router]);

  // Data fetch — dashboard + alerts in parallel
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const idToken = await user.getIdToken();
        if (!idToken) return;

        const [dashRes, alertsRes] = await Promise.all([
          fetch('/api/admin/dashboard-data', { headers: { Authorization: `Bearer ${idToken}` } }),
          fetch('/api/admin/alerts',          { headers: { Authorization: `Bearer ${idToken}` } }),
        ]);

        if (dashRes.ok) {
          const data = await dashRes.json();
          setStats(data.stats);
          setExams(data.exams ?? []);
        }

        if (alertsRes.ok) {
          const data = await alertsRes.json();
          // Show only the 8 most recent critical + warning alerts that have evidence
          const prioritized: RecentAlert[] = (data.alerts ?? [])
            .filter((a: RecentAlert) => a.severity === 'critical' || a.severity === 'warning')
            .slice(0, 8);
          setRecentAlerts(prioritized);
        }
      } catch (err) {
        console.error('Admin dashboard fetch error:', err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [user]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading || isLoadingData) {
    return (
      <div className="flex h-[calc(100vh-73px)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  if (!userProfile || userProfile.role !== 'super-admin') return null;

  const filteredExams = exams.filter(e =>
    e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.instructor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const alertsWithEvidence  = recentAlerts.filter(a => a.evidence_url);
  const alertsWithoutEvidence = recentAlerts.filter(a => !a.evidence_url);
  // Show alerts with evidence first, then the rest
  const sortedAlerts = [...alertsWithEvidence, ...alertsWithoutEvidence];

  return (
    <div className="container mx-auto px-6 py-8 space-y-8 max-w-7xl">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Super Admin</p>
          <h1 className="text-3xl font-black text-slate-800 leading-tight">
            Centro de Mando Global
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Visión unificada del sistema de proctoring — exámenes, docentes y alertas en tiempo real.
          </p>
        </div>
        <p className="text-xs text-slate-400 whitespace-nowrap">
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── KPI Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Sesiones Activas"
          value={stats?.activeExams ?? 0}
          icon={Activity}
          accent="#22c55e"
          live
          sub="Exámenes monitoreando en este momento"
        />
        <KpiCard
          label="Exámenes Realizados"
          value={stats?.totalExams ?? 0}
          icon={FileText}
          accent="#3b82f6"
          sub="Total registrados en la plataforma"
        />
        <KpiCard
          label="Docentes Activos"
          value={stats?.totalInstructors ?? 0}
          icon={UserCheck}
          accent="#f59e0b"
          sub="Cuentas con permisos de staff"
        />
        <KpiCard
          label="Base de Estudiantes"
          value={stats?.totalStudents ?? 0}
          icon={Users}
          accent="#8b5cf6"
          sub="Alumnos registrados en el sistema"
        />
      </div>

      {/* ── Recent Alerts widget ───────────────────────────────────────────── */}
      {sortedAlerts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                Alertas Críticas Recientes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Últimas {sortedAlerts.length} detecciones de alta prioridad con posible evidencia fotográfica
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => router.push('/super-admin/alerts')}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Ver auditoría completa
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide w-36">Fecha / Hora</TableHead>
                <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Examen</TableHead>
                <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide w-40">Estudiante</TableHead>
                <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Descripción</TableHead>
                <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide w-32">Severidad</TableHead>
                <TableHead className="w-28 text-xs text-slate-400 font-semibold uppercase tracking-wide text-right">Evidencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAlerts.map(alert => (
                <TableRow
                  key={alert.id}
                  className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors"
                >
                  <TableCell className="py-3.5">
                    <div className="text-xs text-slate-500 font-mono">
                      <p>{new Date(alert.timestamp).toLocaleDateString('es-CL')}</p>
                      <p className="text-slate-400">
                        {new Date(alert.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell className="py-3.5">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{alert.exam_subject || '—'}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[160px]">{alert.exam_title || ''}</p>
                  </TableCell>

                  <TableCell className="py-3.5">
                    <span className="text-xs font-mono text-slate-600">{alert.student_email_masked || '—'}</span>
                  </TableCell>

                  <TableCell className="py-3.5">
                    <span className="text-sm text-slate-700">{alert.description}</span>
                  </TableCell>

                  <TableCell className="py-3.5">
                    <SeverityBadge severity={alert.severity} />
                  </TableCell>

                  <TableCell className="py-3.5 text-right">
                    {alert.evidence_url ? (
                      <EvidenceDialog alert={alert} />
                    ) : (
                      <span className="text-slate-300 text-xs">sin evidencia</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Exam audit table ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Auditoría de Exámenes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredExams.length} sesión{filteredExams.length !== 1 ? 'es' : ''} encontrada{filteredExams.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Buscar por título, docente, materia…"
              className="pl-9 text-sm bg-slate-50 border-slate-200 focus:bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide w-28">Estado</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Examen / Materia</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Docente</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide text-center w-24">Alumnos</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide text-center w-28">Alertas</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide text-right w-36">Fecha</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredExams.length > 0 ? (
              filteredExams.map((exam) => (
                <TableRow key={exam.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">

                  <TableCell className="py-4">
                    <StatusBadge status={exam.status} />
                  </TableCell>

                  <TableCell className="py-4">
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{exam.subject}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {exam.access_code}
                      </span>
                      <span className="text-xs text-slate-400 truncate max-w-[180px]">{exam.title}</span>
                    </div>
                  </TableCell>

                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: '#161F45' }}
                      >
                        {exam.instructor_name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{exam.instructor_name ?? 'Desconocido'}</p>
                        <p className="text-[10px] text-slate-400 truncate">{exam.instructor_email}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {exam.student_count}
                    </span>
                  </TableCell>

                  {/* Critical alerts — now navigates to the full audit page */}
                  <TableCell className="py-4 text-center">
                    {exam.critical_alerts > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 gap-1"
                        onClick={() => router.push('/super-admin/alerts')}
                        title="Ver alertas críticas en Auditoría IA"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        {exam.critical_alerts}
                      </Button>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </TableCell>

                  <TableCell className="py-4 text-right">
                    <span className="flex items-center justify-end gap-1 text-xs text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(exam.created_at).toLocaleDateString('es-CL')}
                    </span>
                  </TableCell>

                  <TableCell className="py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 border-blue-200 text-blue-500 hover:bg-blue-50 hover:border-blue-400 disabled:opacity-30"
                      title={exam.status === 'active' ? 'Monitorear en vivo (modo fantasma)' : 'Sólo disponible durante exámenes activos'}
                      disabled={exam.status !== 'active'}
                      onClick={() => router.push(`/super-admin/live-monitor?examId=${exam.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>

                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    <FileText className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No se encontraron exámenes.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
