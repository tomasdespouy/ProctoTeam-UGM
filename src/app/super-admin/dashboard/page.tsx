'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  FileText,
  Activity,
  ShieldAlert,
  Search,
  Loader2,
  Calendar,
  UserCheck,
  Eye,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalExams: number;
  activeExams: number;
  totalStudents: number;
  totalInstructors: number;
}

interface ExamSessionData {
  id: string;
  title: string;
  subject: string;
  status: 'pending' | 'active' | 'finished';
  created_at: string;
  access_code: string;
  instructor_name: string;
  instructor_email: string;
  student_count: number;
  critical_alerts: number;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  live = false,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
  live?: boolean;
  sub?: string;
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
  if (status === 'active')   return <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] animate-pulse">EN VIVO</Badge>;
  if (status === 'pending')  return <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">Pendiente</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Finalizado</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [stats, setStats]             = useState<DashboardStats | null>(null);
  const [exams, setExams]             = useState<ExamSessionData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');

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
        if (!idToken) return;

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

  // ── Loading state ──────────────────────────────────────────────────────────
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
    <div className="container mx-auto px-6 py-8 space-y-8 max-w-7xl">

      {/* ── Page header ─────────────────────────────────────────────────── */}
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

      {/* ── KPI Grid ────────────────────────────────────────────────────── */}
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

      {/* ── Exam audit table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Table header bar */}
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

        {/* Table */}
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

                  {/* Status */}
                  <TableCell className="py-4">
                    <StatusBadge status={exam.status} />
                  </TableCell>

                  {/* Exam info */}
                  <TableCell className="py-4">
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{exam.subject}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {exam.access_code}
                      </span>
                      <span className="text-xs text-slate-400 truncate max-w-[180px]">{exam.title}</span>
                    </div>
                  </TableCell>

                  {/* Instructor */}
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

                  {/* Student count */}
                  <TableCell className="py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {exam.student_count}
                    </span>
                  </TableCell>

                  {/* Critical alerts */}
                  <TableCell className="py-4 text-center">
                    {exam.critical_alerts > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 gap-1"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        {exam.critical_alerts}
                      </Button>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Date */}
                  <TableCell className="py-4 text-right">
                    <span className="flex items-center justify-end gap-1 text-xs text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(exam.created_at).toLocaleDateString('es-CL')}
                    </span>
                  </TableCell>

                  {/* Action */}
                  <TableCell className="py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 border-blue-200 text-blue-500 hover:bg-blue-50 hover:border-blue-400"
                      title="Ver detalle"
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
