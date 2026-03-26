'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Calendar, BellRing, BarChart2 } from 'lucide-react';
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

// ─── Row action buttons ───────────────────────────────────────────────────────

function ActionButtons({
  session,
  token,
}: {
  session: ExamSession;
  token: string | null;
}) {
  const [loadingAlerts, setLoadingAlerts]   = useState(false);
  const [loadingStats,  setLoadingStats]    = useState(false);

  const handleAlerts = async () => {
    if (!token) return;
    setLoadingAlerts(true);
    try {
      const res  = await fetch(`/api/exam-sessions/${session.id}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const alerts = data.alerts ?? [];

      const rows: string[][] = [
        ['Estudiante', 'Severidad', 'Descripción', 'Fecha'],
        ...alerts.map((a: any) => [
          a.student_name ?? a.student_id,
          a.severity,
          a.description,
          format(new Date(a.timestamp), 'dd/MM/yyyy HH:mm', { locale: es }),
        ]),
      ];
      downloadCsv(`alertas_${session.title.replace(/\s+/g, '_')}.csv`, rows);
    } catch {
      // silently ignore — network or auth error
    } finally {
      setLoadingAlerts(false);
    }
  };

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
      {/* Alertas — red border */}
      <button
        onClick={handleAlerts}
        disabled={loadingAlerts}
        className="flex items-center gap-1.5 h-6 px-2.5 rounded-[5px] border text-xs font-normal transition-colors hover:bg-red-50 disabled:opacity-50"
        style={{ borderColor: '#ef4565', color: '#242f62' }}
        title="Descargar alertas CSV"
      >
        {loadingAlerts
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <BellRing className="h-3 w-3 flex-shrink-0" style={{ color: '#ef4565' }} />}
        Alertas
      </button>

      {/* Estadísticas — teal border */}
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

  const [sessions,      setSessions]      = useState<ExamSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [token,         setToken]         = useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [dateFilter,    setDateFilter]    = useState('');

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

  // ── Loading state ────────────────────────────────────────────────────────────
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

      {/* ── Page title ────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1
          className="font-bold text-2xl leading-tight"
          style={{ color: '#242f62', fontFamily: "'Onest', sans-serif" }}
        >
          Sesiones Creadas
        </h1>
        <p className="text-base mt-1" style={{ color: '#242f62', opacity: 0.75 }}>
          Aquí se listan todos los exámenes que has configurado. Puedes descargar un reporte
          detallado de cada sesión.
        </p>
      </div>

      {/* ── Search + Date filter ──────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 mb-4">
        {/* Buscador */}
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

        {/* Filtro de fecha */}
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

      {/* ── Table card ────────────────────────────────────────────────── */}
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
          {['Título del Examen', 'Sección', 'Asignatura', 'Fecha de Creación', 'Descargar Acciones'].map(col => (
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
              {/* Título */}
              <div className="flex items-center px-6">
                <span className="text-sm font-medium truncate" style={{ color: '#515774' }}>
                  {session.title}
                </span>
              </div>

              {/* Sección */}
              <div className="flex items-center px-6">
                <span className="text-sm" style={{ color: '#515774' }}>
                  {session.section}
                </span>
              </div>

              {/* Asignatura */}
              <div className="flex items-center px-6">
                <span className="text-sm" style={{ color: '#515774' }}>
                  {session.subject}
                </span>
              </div>

              {/* Fecha de Creación */}
              <div className="flex items-center px-6">
                <span className="text-sm" style={{ color: '#515774' }}>
                  {format(new Date(session.created_at), 'dd/MM/yyyy', { locale: es })}
                </span>
              </div>

              {/* Acciones */}
              <div className="flex items-center px-4">
                <ActionButtons session={session} token={token} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Footer count ──────────────────────────────────────────────── */}
      {sessions.length > 0 && (
        <p className="mt-3 text-xs text-right" style={{ color: '#767c97' }}>
          {filtered.length} de {sessions.length} sesiones
        </p>
      )}
    </div>
  );
}
