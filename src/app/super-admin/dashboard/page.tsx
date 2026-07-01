'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users, FileText, Activity, ShieldAlert, AlertTriangle, Info,
  Search, Loader2, Calendar, UserCheck, Eye, Camera, Download, BellRing,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalExams:       number;
  activeExams:      number;
  totalStudents:    number;
  totalInstructors: number;
}

interface ExamSessionData {
  id:               string;
  title:            string;
  subject:          string;
  status:           'pending' | 'active' | 'finished';
  created_at:       string;
  access_code:      string;
  instructor_name:  string;
  instructor_email: string;
  student_count:    number;
  critical_alerts:  number;
}

interface ExamAlert {
  id:           string;
  student_id:   string;
  student_name: string | null;
  severity:     'critical' | 'warning' | 'info';
  description:  string;
  evidence_url: string | null;
  timestamp:    string;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#3b82f6',
};

function SeverityBadge({ severity }: { severity: ExamAlert['severity'] }) {
  if (severity === 'critical') return (
    <Badge className="gap-1 bg-red-100 text-red-700 border border-red-200 hover:bg-red-100 text-[10px] whitespace-nowrap">
      <ShieldAlert className="h-2.5 w-2.5" /> Crítica
    </Badge>
  );
  if (severity === 'warning') return (
    <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[10px] whitespace-nowrap">
      <AlertTriangle className="h-2.5 w-2.5" /> Advertencia
    </Badge>
  );
  return (
    <Badge className="gap-1 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[10px] whitespace-nowrap">
      <Info className="h-2.5 w-2.5" /> Info
    </Badge>
  );
}

// ─── Evidence Dialog — same pattern as ProctorView & Histórico ────────────────

function EvidenceDialog({ alert }: { alert: ExamAlert }) {
  const color = SEVERITY_COLOR[alert.severity] ?? '#6B7280';
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          title="Ver foto de evidencia"
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors flex-shrink-0"
          style={{
            color,
            borderColor:     color + '44',
            backgroundColor: color + '11',
          }}
        >
          <Camera className="h-3 w-3" />
          Ver Foto
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm font-semibold text-gray-800 leading-tight">
            Evidencia fotográfica
            <span className="ml-2 font-normal text-gray-400">
              — {alert.student_name ?? alert.student_id}
            </span>
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-0.5">{alert.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <SeverityBadge severity={alert.severity} />
            <span className="text-[10px] text-gray-400">
              {format(new Date(alert.timestamp), "dd 'de' MMMM, HH:mm", { locale: es })}
            </span>
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

// ─── Alerts Sheet — same drawer pattern as Histórico del Docente ──────────────

function AlertsSheet({
  exam,
  token,
  open,
  onClose,
}: {
  exam:    ExamSessionData | null;
  token:   string | null;
  open:    boolean;
  onClose: () => void;
}) {
  const [alerts,    setAlerts]    = useState<ExamAlert[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [filterSev, setFilterSev] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const fetchAlerts = useCallback(async () => {
    if (!exam || !token) return;
    setLoading(true);
    setAlerts([]);
    try {
      const res = await fetch(`/api/exam-sessions/${exam.id}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch (err) {
      console.error('[AdminAlerts] Error cargando alertas:', err);
    } finally {
      setLoading(false);
    }
  }, [exam, token]);

  useEffect(() => {
    if (open && exam) {
      setFilterSev('all');
      fetchAlerts();
    }
  }, [open, exam, fetchAlerts]);

  const filtered = useMemo(() =>
    filterSev === 'all' ? alerts : alerts.filter(a => a.severity === filterSev),
    [alerts, filterSev]
  );

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount  = alerts.filter(a => a.severity === 'warning').length;
  const infoCount     = alerts.filter(a => a.severity === 'info').length;
  const evidenceCount = alerts.filter(a => a.evidence_url).length;

  const downloadCsv = () => {
    const rows = [
      ['Estudiante', 'Severidad', 'Descripción', 'Fecha', 'Link de Evidencia'],
      ...alerts.map(a => [
        a.student_name ?? a.student_id,
        a.severity,
        a.description,
        format(new Date(a.timestamp), 'dd/MM/yyyy HH:mm', { locale: es }),
        a.evidence_url ?? '',
      ]),
    ];
    const content = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob    = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `alertas_${(exam?.title ?? 'examen').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 gap-0"
        style={{ maxWidth: '720px' }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold text-gray-800 leading-snug truncate">
                {exam?.subject ?? '—'}
              </SheetTitle>
              <SheetDescription className="text-xs text-gray-400 mt-0.5">
                {exam?.title}
                {exam?.created_at && (
                  <> · {format(new Date(exam.created_at), 'dd/MM/yyyy', { locale: es })}</>
                )}
                {exam?.instructor_name && (
                  <> · {exam.instructor_name}</>
                )}
              </SheetDescription>
            </div>
          </div>

          {/* Severity filter chips */}
          {!loading && alerts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => setFilterSev('all')}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  filterSev === 'all'
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                Todas ({alerts.length})
              </button>
              {criticalCount > 0 && (
                <button
                  onClick={() => setFilterSev('critical')}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    filterSev === 'critical'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-red-50 text-red-600 border-red-200 hover:border-red-400'
                  }`}
                >
                  Críticas ({criticalCount})
                </button>
              )}
              {warningCount > 0 && (
                <button
                  onClick={() => setFilterSev('warning')}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    filterSev === 'warning'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 text-amber-600 border-amber-200 hover:border-amber-400'
                  }`}
                >
                  Advertencias ({warningCount})
                </button>
              )}
              {infoCount > 0 && (
                <button
                  onClick={() => setFilterSev('info')}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    filterSev === 'info'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-400'
                  }`}
                >
                  Info ({infoCount})
                </button>
              )}
              {evidenceCount > 0 && (
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600 border border-green-200">
                  {evidenceCount} con foto
                </span>
              )}
            </div>
          )}
        </SheetHeader>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-300">
              <BellRing className="h-8 w-8" />
              <p className="text-sm">
                {alerts.length === 0
                  ? 'Este examen no registró alertas.'
                  : 'No hay alertas para el filtro seleccionado.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  {/* Severity color bar */}
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: SEVERITY_COLOR[alert.severity] ?? '#9ca3af' }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-xs font-semibold text-gray-700 truncate">
                        {alert.student_name ?? alert.student_id}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {alert.description}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-1">
                      {format(new Date(alert.timestamp), "dd/MM/yyyy 'a las' HH:mm:ss", { locale: es })}
                    </p>
                  </div>

                  {/* Evidence button */}
                  {alert.evidence_url && (
                    <div className="flex-shrink-0 mt-0.5">
                      <EvidenceDialog alert={alert} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
            <p className="text-[10px] text-gray-400">
              {filtered.length} de {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-md transition-colors bg-white"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar CSV completo
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [stats,         setStats]         = useState<DashboardStats | null>(null);
  const [exams,         setExams]         = useState<ExamSessionData[]>([]);
  const [token,         setToken]         = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchTerm,    setSearchTerm]    = useState('');

  // Sheet state
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamSessionData | null>(null);

  const [loadingXlsx, setLoadingXlsx] = useState(false);
  const handleAdminExcel = async () => {
    if (!user) return;
    setLoadingXlsx(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/reports/admin', { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'reporte_global_proctoteam.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Report/admin] Error descargando Excel:', err);
    } finally {
      setLoadingXlsx(false);
    }
  };

  // Auth guard
  useEffect(() => {
    if (!loading && userProfile && userProfile.role !== 'super-admin') {
      router.push('/');
    }
  }, [loading, userProfile, router]);

  // Data fetch
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const idToken = await user.getIdToken();
        setToken(idToken);

        const res = await fetch('/api/admin/dashboard-data', {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setExams(data.exams ?? []);
        } else {
          console.error('Admin fetch error:', res.status);
        }
      } catch (err) {
        console.error('Admin fetch error:', err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [user]);

  const handleOpenSheet = useCallback((exam: ExamSessionData) => {
    setSelectedExam(exam);
    setSheetOpen(true);
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────────
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

  return (
    <>
      <div className="container mx-auto px-6 py-8 space-y-8 max-w-7xl">

        {/* ── Page header ─────────────────────────────────────────────── */}
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
          <div className="flex items-center gap-3">
            <button
              onClick={handleAdminExcel}
              disabled={loadingXlsx}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-sm font-semibold transition-colors hover:bg-emerald-50 disabled:opacity-50"
              style={{ borderColor: '#10b981', color: '#161F45' }}
              title="Descargar reporte global (Excel)"
            >
              {loadingXlsx
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" style={{ color: '#10b981' }} />}
              Descargar Excel
            </button>
            <p className="text-xs text-slate-400 whitespace-nowrap hidden md:block">
              {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ── KPI Grid ────────────────────────────────────────────────── */}
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

        {/* ── Exam audit table ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Auditoría de Exámenes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredExams.length} sesión{filteredExams.length !== 1 ? 'es' : ''} encontrada{filteredExams.length !== 1 ? 's' : ''}
                {' · '}Haz clic en
                <Eye className="h-3 w-3 inline mx-1 text-blue-400" />
                para ver las alertas con evidencia fotográfica de ese examen.
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

                    {/* Critical alerts count — navigates to full audit page */}
                    <TableCell className="py-4 text-center">
                      {exam.critical_alerts > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 gap-1"
                          onClick={() => router.push('/super-admin/alerts')}
                          title="Ver todas las alertas en Auditoría IA"
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

                    {/* Eye — opens AlertsSheet for ANY exam (not just active) */}
                    <TableCell className="py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 border-blue-200 text-blue-500 hover:bg-blue-50 hover:border-blue-400"
                        title="Ver alertas e incidencias de este examen"
                        onClick={() => handleOpenSheet(exam)}
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

      {/* ── Alerts Sheet (portal, outside container) ─────────────────── */}
      <AlertsSheet
        exam={selectedExam}
        token={token}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
