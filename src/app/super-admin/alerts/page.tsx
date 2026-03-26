'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ShieldAlert, AlertTriangle, Info, Search, Loader2, Image as ImageIcon, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertMetrics {
  totalToday:    number;
  criticalToday: number;
  warningToday:  number;
  infoToday:     number;
  topAlertType:  string;
  withEvidence:  number;
}

interface AlertRow {
  id:                   string;
  timestamp:            string;
  severity:             'critical' | 'warning' | 'info';
  description:          string;
  evidence_url:         string | null;
  student_email_masked: string;
  exam_subject:         string;
  exam_title:           string;
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: AlertRow['severity'] }) {
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

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, accent, icon: Icon, sub,
}: {
  label:  string;
  value:  number | string;
  accent: string;
  icon:   React.ElementType;
  sub?:   string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-sm border border-slate-100"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>
      <span className="text-3xl font-black text-slate-800 leading-none">{value}</span>
      {sub && <p className="text-xs text-slate-400 leading-snug truncate">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsAuditPage() {
  const { user, userProfile, loading } = useAuth();
  const router  = useRouter();
  const { toast } = useToast();

  const [metrics,    setMetrics]    = useState<AlertMetrics | null>(null);
  const [alerts,     setAlerts]     = useState<AlertRow[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Auth guard
  useEffect(() => {
    if (!loading && userProfile && userProfile.role !== 'super-admin') router.push('/');
  }, [loading, userProfile, router]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res   = await fetch('/api/admin/alerts', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setAlerts(data.alerts ?? []);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (user) fetchData(); }, [user]);

  if (loading || isLoading) {
    return (
      <div className="flex h-[calc(100vh-73px)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  const filtered = alerts.filter(a =>
    a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.exam_subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.student_email_masked?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Super Admin</p>
          <h1 className="text-3xl font-black text-slate-800">Auditoría IA</h1>
          <p className="text-slate-500 text-sm mt-1">
            Feed global de alertas generadas por el motor de detección inteligente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 self-start md:self-auto">
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* KPI metrics */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="Total alertas hoy"
            value={metrics.totalToday}
            accent="#3b82f6"
            icon={ShieldAlert}
            sub={`${metrics.criticalToday} críticas · ${metrics.warningToday} advertencias · ${metrics.infoToday} info`}
          />
          <MetricCard
            label="Tipo más frecuente (7d)"
            value={metrics.topAlertType || '—'}
            accent="#f59e0b"
            icon={AlertTriangle}
            sub="Infracción dominante en la última semana"
          />
          <MetricCard
            label="Con evidencia fotográfica"
            value={metrics.withEvidence}
            accent="#22c55e"
            icon={ImageIcon}
            sub="Alertas con snapshot adjunto disponible"
          />
        </div>
      )}

      {/* Alert feed table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-400" />
              Feed de Alertas Recientes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} alertas</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Buscar por materia, tipo…"
              className="pl-9 text-sm bg-slate-50 border-slate-200"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide w-36">Fecha / Hora</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Examen</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide w-40">Estudiante</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Tipo de alerta</TableHead>
              <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wide w-32">Severidad</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length > 0 ? (
              filtered.map(alert => (
                <TableRow
                  key={alert.id}
                  className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors"
                >
                  {/* Timestamp */}
                  <TableCell className="py-3.5">
                    <div className="text-xs text-slate-500 font-mono">
                      <p>{new Date(alert.timestamp).toLocaleDateString('es-CL')}</p>
                      <p className="text-slate-400">{new Date(alert.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </TableCell>

                  {/* Exam */}
                  <TableCell className="py-3.5">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{alert.exam_subject || '—'}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">{alert.exam_title || ''}</p>
                  </TableCell>

                  {/* Masked student email */}
                  <TableCell className="py-3.5">
                    <span className="text-xs font-mono text-slate-600">{alert.student_email_masked || '—'}</span>
                  </TableCell>

                  {/* Alert type */}
                  <TableCell className="py-3.5">
                    <span className="text-sm text-slate-700">{alert.description}</span>
                  </TableCell>

                  {/* Severity */}
                  <TableCell className="py-3.5">
                    <SeverityBadge severity={alert.severity} />
                  </TableCell>

                  {/* Evidence */}
                  <TableCell className="py-3.5 text-right">
                    {alert.evidence_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-400"
                        onClick={() => window.open(alert.evidence_url!, '_blank')}
                      >
                        <ImageIcon className="h-3 w-3" />
                        Evidencia
                      </Button>
                    ) : (
                      <span className="text-slate-300 text-xs">sin evidencia</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <ShieldAlert className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No hay alertas registradas.</p>
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
