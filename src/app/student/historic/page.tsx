'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Calendar, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentSession {
  id: string;
  title: string;
  subject: string;
  section: string;
  duration: number;
  access_code: string;
  status: string;
  participation_date: string;
  participation_status: string;
}

// ─── Status label helper ──────────────────────────────────────────────────────

const PARTICIPATION_LABELS: Record<string, { label: string; color: string }> = {
  'submitted':   { label: 'Finalizado',    color: '#22C55E' },
  'in-progress': { label: 'En progreso',   color: '#F59E0B' },
  'joined':      { label: 'Conectado',     color: '#3B82F6' },
  'blocked':     { label: 'Bloqueado',     color: '#EF4444' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentHistoricPage() {
  const { user, loading } = useAuth();

  const [sessions,      setSessions]      = useState<StudentSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [search,        setSearch]        = useState('');
  const [dateFilter,    setDateFilter]    = useState('');

  useEffect(() => {
    if (loading || !user) return;

    const load = async () => {
      try {
        const token = await user.getIdToken();
        const res   = await fetch('/api/exam-sessions/by-student', {
          headers: { Authorization: `Bearer ${token}` },
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
        format(new Date(s.participation_date), 'yyyy-MM-dd') === dateFilter
      );
    }

    return list;
  }, [sessions, search, dateFilter]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#e8eaf2' }}>
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
          Exámenes Rendidos
        </h1>
        <p className="text-base mt-1" style={{ color: '#242f62', opacity: 0.75 }}>
          Aquí se listan todos los exámenes en los que has participado.
        </p>
      </div>

      {/* ── Search + Date filter ──────────────────────────────────────── */}
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
            gridTemplateColumns: '2fr 1.4fr 1fr 1.5fr 1fr',
            height: 55,
          }}
        >
          {['Título del Examen', 'Asignatura', 'Sección', 'Fecha de Participación', 'Estado'].map(col => (
            <div
              key={col}
              className="flex items-center px-6 text-sm font-normal"
              style={{ color: '#242f62' }}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {sessions.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: '#515774' }}>
            <Inbox className="h-10 w-10 opacity-50" />
            <p className="text-sm">No has rendido exámenes todavía.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#515774' }}>
            No hay resultados para tu búsqueda.
          </div>
        ) : (
          filtered.map((session, idx) => {
            const badge = PARTICIPATION_LABELS[session.participation_status] ?? { label: session.participation_status, color: '#767c97' };

            return (
              <div
                key={session.id}
                className="grid border-b border-[#cccfdd] last:border-b-0 hover:bg-gray-50 transition-colors"
                style={{
                  gridTemplateColumns: '2fr 1.4fr 1fr 1.5fr 1fr',
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

                {/* Asignatura */}
                <div className="flex items-center px-6">
                  <span className="text-sm truncate" style={{ color: '#515774' }}>
                    {session.subject}
                  </span>
                </div>

                {/* Sección */}
                <div className="flex items-center px-6">
                  <span className="text-sm" style={{ color: '#515774' }}>
                    {session.section}
                  </span>
                </div>

                {/* Fecha */}
                <div className="flex items-center px-6">
                  <span className="text-sm" style={{ color: '#515774' }}>
                    {format(new Date(session.participation_date), 'dd/MM/yyyy', { locale: es })}
                  </span>
                </div>

                {/* Estado */}
                <div className="flex items-center px-6">
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: badge.color + '22',
                      color: badge.color,
                      border: `1px solid ${badge.color}44`,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer count ──────────────────────────────────────────────── */}
      {sessions.length > 0 && (
        <p className="mt-3 text-xs text-right" style={{ color: '#767c97' }}>
          {filtered.length} de {sessions.length} exámenes
        </p>
      )}
    </div>
  );
}
