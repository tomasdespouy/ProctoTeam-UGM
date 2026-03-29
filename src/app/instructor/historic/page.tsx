'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Loader2, Search, Calendar, BellRing, BarChart2,
  Camera, Download, ShieldAlert, AlertTriangle, Info, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExamSession {
  id: string;
  title: string;
  subject: string;
  section: string;
  status: 'pending' | 'active' | 'finished';
  created_at: string;
  access_code: string;
  student_count: number;
  duration: number;
}

interface HistoricAlert {
  id: string;
  student_id: string;
  student_name: string | null;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  evidence_url: string | null;
  timestamp: string;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#3b82f6',
};

function SeverityBadge({ severity }: { severity: HistoricAlert['severity'] }) {
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

// ─── Evidence photo dialog (same pattern as ProctorView) ──────────────────────

function EvidenceDialog({ alert }: { alert: HistoricAlert }) {
  const color = SEVERITY_COLOR[alert.severity] ?? '#6B7280';
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          title="Ver foto de evidencia"
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors flex-shrink-0"
          style={{
            color:           color,
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

// ─── Alerts Sheet (drawer) ────────────────────────────────────────────────────

function AlertsSheet({
  session,
  token,
  open,
  onClose,
}: {
  session: ExamSession | null;
  token: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [alerts,    setAlerts]    = useState<HistoricAlert[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [filterSev, setFilterSev] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const fetchAlerts = useCallback(async () => {
    if (!session || !token) return;
    setLoading(true);
    setAlerts([]);
    try {
      const res = await fetch(`/api/exam-sessions/${session.id}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch (err) {
      console.error('[HistoricAlerts] Error cargando alertas:', err);
    } finally {
      setLoading(false);
    }
  }, [session, token]);

  useEffect(() => {
    if (open && session) fetchAlerts();
  }, [open, session, fetchAlerts]);

  const filtered = useMemo(() =>
    filterSev === 'all' ? alerts : alerts.filter(a => a.severity === filterSev),
    [alerts, filterSev]
  );

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount  = alerts.filter(a => a.severity === 'warning').length;
  const infoCount     = alerts.filter(a => a.severity === 'info').length;
  const evidenceCount = alerts.filter(a => a.evidence_url).length;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 gap-0"
        style={{ maxWidth: '720px' }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold text-gray-800 leading-snug truncate">
                {session?.title ?? '—'}
              </SheetTitle>
              <SheetDescription className="text-xs text-gray-400 mt-0.5">
                {session?.subject} · Sección {session?.section}
                {session?.created_at && (
                  <> · {format(new Date(session.created_at), 'dd/MM/yyyy', { locale: es })}</>
                )}
              </SheetDescription>
            </div>
          </div>

          {/* KPI mini-chips */}
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

        {/* ── Body ────────────────────────────────────────────────────── */}
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
                  ? 'Esta sesión no registró alertas.'
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
                  {/* Severity indicator */}
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

        {/* ── Footer: CSV download ─────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
            <p className="text-[10px] text-gray-400">
              {filtered.length} de {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => downloadAlertsCsv(session?.title ?? 'examen', alerts)}
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

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob    = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadAlertsCsv(title: string, alerts: HistoricAlert[]) {
  const rows: string[][] = [
    ['Estudiante', 'Severidad', 'Descripción', 'Fecha', 'Link de Evidencia'],
    ...alerts.map(a => [
      a.student_name ?? a.student_id,
      a.severity,
      a.description,
      format(new Date(a.timestamp), 'dd/MM/yyyy HH:mm', { locale: es }),
      a.evidence_url ?? '',
    ]),
  ];
  downloadCsv(`alertas_${title.replace(/\s+/g, '_')}.csv`, rows);
}

// ─── Row action buttons ───────────────────────────────────────────────────────

function ActionButtons({
  session,
  token,
  onViewAlerts,
}: {
  session: ExamSession;
  token: string | null;
  onViewAlerts: (session: ExamSession) => void;
}) {
  const [loadingStats, setLoadingStats] = useState(false);

  const handleStats = () => {
    setLoadingStats(true);
    try {
      const statusLabel: Record<string, string> = {
        active: 'Activo', finished: 'Finalizado', pending: 'Pendiente',
      };
      const rows: string[][] = [
        ['Campo', 'Valor'],
        ['Título', session.title],
        ['Asignatura', session.subject],
        ['Sección', session.section],
        ['Código de Acceso', session.access_code],
        ['Estado', statusLabel[session.status] ?? session.status],
        ['Duración (min)', String(session.duration)],
        ['Estudiantes inscritos', String(session.student_count)],
        ['Fecha de creación', format(new Date(session.created_at), 'dd/MM/yyyy HH:mm', { locale: es })],
      ];
      downloadCsv(`estadisticas_${session.title.replace(/\s+/g, '_')}.csv`, rows);
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Ver Detalle — opens Sheet with inline alert table */}
      <button
        onClick={() => onViewAlerts(session)}
        className="flex items-center gap-1.5 h-6 px-2.5 rounded-[5px] border text-xs font-normal transition-colors hover:bg-red-50"
        style={{ borderColor: '#ef4565', color: '#242f62' }}
        title="Ver alertas del examen"
      >
        <BellRing className="h-3 w-3 flex-shrink-0" style={{ color: '#ef4565' }} />
        Ver Alertas
      </button>

      {/* Estadísticas — CSV download */}
      <button
        onClick={handleStats}
        disabled={loadingStats}
        className="flex items-center gap-1.5 h-6 px-2.5 rounded-[5px] border text-xs font-normal transition-colors hover:bg-teal-50 disabled:opacity-50"
        style={{ borderColor: '#0ad3c2', color: '#242f62' }}
        title="Descargar estadísticas CSV"
      >
        {loadingStats
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <BarChart2 className="h-3 w-3 flex-shrink-0" style={{ color: '#0ad3c2' }} />}
        Estadísticas
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoricPage() {
  const { user, loading } = useAuth();

  const [sessions,       setSessions]       = useState<ExamSession[]>([]);
  const [isLoadingData,  setIsLoadingData]  = useState(true);
  const [token,          setToken]          = useState<string | null>(null);
  const [search,         setSearch]         = useState('');
  const [dateFilter,     setDateFilter]     = useState('');

  // Sheet state
  const [sheetOpen,        setSheetOpen]        = useState(false);
  const [selectedSession,  setSelectedSession]  = useState<ExamSession | null>(null);

  const handleViewAlerts = useCallback((session: ExamSession) => {
    setSelectedSession(session);
    setSheetOpen(true);
  }, []);

  useEffect(() => {
    if (loading || !user) return;

    const load = async () => {
      try {
        const idToken = await user.getIdToken();
        setToken(idToken);

        const res = await fetch('/api/exam-sessions/by-instructor', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions ?? []);
        }
      } catch {
        // network error — leave empty
      } finally {
        setIsLoadingData(false);
      }
    };

    load();
  }, [user, loading]);

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = sessions;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q)
      );
    }

    if (dateFilter) {
      list = list.filter(s =>
        format(new Date(s.created_at), 'yyyy-MM-dd') === dateFilter
      );
    }

    return list;
  }, [sessions, search, dateFilter]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading || isLoadingData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#e8eaf2' }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#242f62' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-8" style={{ backgroundColor: '#e8eaf2' }}>

      {/* ── Page title ────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1
          className="font-bold text-2xl leading-tight"
          style={{ color: '#242f62', fontFamily: "'Onest', sans-serif" }}
        >
          Sesiones Creadas
        </h1>
        <p className="text-base mt-1" style={{ color: '#242f62', opacity: 0.75 }}>
          Aquí se listan todos los exámenes que has configurado. Haz clic en "Ver Alertas"
          para revisar el historial de incidencias con evidencia fotográfica.
        </p>
      </div>

      {/* ── Search + Date filter ──────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 mb-4">
        <div className="relative w-64">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: '#54537d' }}
          />
          <Input
            placeholder="Buscar"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 pl-9 border-[#cccfdd] bg-white text-sm focus-visible:ring-[#242f62]"
            style={{ color: '#54537d' }}
          />
        </div>

        <div className="relative w-44">
          <Calendar
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: '#767c97' }}
          />
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#cccfdd] bg-white pl-9 pr-3 text-sm text-[#767c97] focus:outline-none focus:ring-2 focus:ring-[#242f62]"
          />
        </div>

        {dateFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-400 hover:text-gray-600 h-10"
            onClick={() => setDateFilter('')}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* ── Table card ────────────────────────────────────────────── */}
      <div
        className="rounded-[10px] border border-[#cccfdd] overflow-hidden"
        style={{ backgroundColor: '#fff' }}
      >
        {/* Table header row */}
        <div
          className="grid border-b border-[#cccfdd]"
          style={{
            backgroundColor: '#e2e5f3',
            gridTemplateColumns: '2fr 1fr 1.4fr 1.5fr 1fr',
            height: 55,
          }}
        >
          {['Título del Examen', 'Sección', 'Asignatura', 'Fecha de Creación', 'Acciones'].map(col => (
            <div
              key={col}
              className="flex items-center px-6 text-sm font-normal"
              style={{ color: '#242f62' }}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#515774' }}>
            {sessions.length === 0
              ? 'No has creado exámenes todavía.'
              : 'No hay resultados para tu búsqueda.'}
          </div>
        ) : (
          filtered.map((session, idx) => (
            <div
              key={session.id}
              className="grid border-b border-[#cccfdd] last:border-b-0 hover:bg-gray-50 transition-colors"
              style={{
                gridTemplateColumns: '2fr 1fr 1.4fr 1.5fr 1fr',
                height: 44,
                backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbff',
              }}
            >
              <div className="flex items-center px-6">
                <span className="text-sm font-medium truncate" style={{ color: '#515774' }}>
                  {session.title}
                </span>
              </div>
              <div className="flex items-center px-6">
                <span className="text-sm" style={{ color: '#515774' }}>{session.section}</span>
              </div>
              <div className="flex items-center px-6">
                <span className="text-sm" style={{ color: '#515774' }}>{session.subject}</span>
              </div>
              <div className="flex items-center px-6">
                <span className="text-sm" style={{ color: '#515774' }}>
                  {format(new Date(session.created_at), 'dd/MM/yyyy', { locale: es })}
                </span>
              </div>
              <div className="flex items-center px-4">
                <ActionButtons
                  session={session}
                  token={token}
                  onViewAlerts={handleViewAlerts}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Footer count ──────────────────────────────────────────── */}
      {sessions.length > 0 && (
        <p className="mt-3 text-xs text-right" style={{ color: '#767c97' }}>
          {filtered.length} de {sessions.length} sesiones
        </p>
      )}

      {/* ── Alerts Sheet drawer ───────────────────────────────────── */}
      <AlertsSheet
        session={selectedSession}
        token={token}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
