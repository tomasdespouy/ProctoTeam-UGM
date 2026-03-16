'use client';

import { Users, Clock, CheckCircle, Bell, ScanFace } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — se reemplazará por datos reales cuando el backend esté listo
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_STUDENTS = [
  { id: '1', name: 'Lorena', code: 'ID:wenv234' },
  { id: '2', name: 'Lorena', code: 'ID:wenv234' },
  { id: '3', name: 'Lorena', code: 'ID:wenv234' },
  { id: '4', name: 'Lorena', code: 'ID:wenv234' },
  { id: '5', name: 'Lorena', code: 'ID:wenv234' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MockStudentCard — tarjeta oscura estilo Figma
// ─────────────────────────────────────────────────────────────────────────────
function MockStudentCard({ name, code }: { name: string; code: string }) {
  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col border border-white/10 shadow"
      style={{ backgroundColor: '#1A2744' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: '#4A5568' }}
          >
            {name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">{name}</p>
            <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{code}</p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-1"
          style={{ backgroundColor: '#22C55E', color: '#fff' }}
        >
          Activo
        </span>
      </div>

      {/* Video placeholder */}
      <div className="mx-2 rounded-lg" style={{ height: 110, backgroundColor: '#0A1228' }} />

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2">
        <ScanFace className="h-4 w-4" style={{ color: '#94A3B8' }} />
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard principal
// ─────────────────────────────────────────────────────────────────────────────
export default function InstructorDashboard() {
  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

      {/* ── Tarjetas de métricas ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Estudiantes Activos — cyan */}
        <div
          className="rounded-xl p-5 text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, #00BBFF 0%, #0095FF 100%)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 opacity-90" />
            <span className="text-sm font-semibold">Estudiantes Activos</span>
          </div>
          <p className="text-4xl font-bold leading-none">0</p>
          <p className="text-sm opacity-75 mt-1.5">Estudiantes en línea</p>
        </div>

        {/* Tiempo de Monitoreo — blue */}
        <div
          className="rounded-xl p-5 text-white shadow-md"
          style={{ backgroundColor: '#0095FF' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 opacity-90" />
            <span className="text-sm font-semibold">Tiempo de Monitoreo</span>
          </div>
          <p className="text-4xl font-bold font-mono leading-none">00:00</p>
          <p className="text-sm opacity-75 mt-1.5">Esperando inicio</p>
        </div>

        {/* Estudiantes Finalizados — violet */}
        <div
          className="rounded-xl p-5 text-white shadow-md"
          style={{ backgroundColor: '#4F5CC0' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 opacity-90" />
            <span className="text-sm font-semibold">Estudiantes Finalizados</span>
          </div>
          <p className="text-4xl font-bold leading-none">26</p>
          <p className="text-sm opacity-75 mt-1.5">de 56 en total</p>
        </div>

        {/* Estudiantes con Alertas — navy */}
        <div
          className="rounded-xl p-5 text-white shadow-md"
          style={{ backgroundColor: '#394281' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 opacity-90" />
            <span className="text-sm font-semibold">Estudiantes con Alertas</span>
          </div>
          <p className="text-4xl font-bold leading-none" style={{ color: '#FCA5A5' }}>03</p>
          <p className="text-sm opacity-75 mt-1.5">de 56 en total</p>
        </div>
      </div>

      {/* ── Estadísticas + Monitor lateral ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Estadísticas de la Sección (2 columnas) */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-bold text-gray-800">Estadísticas de la Sección</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-gray-200 rounded-xl shadow-sm h-52">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-normal text-gray-500">
                  Distribución de Alertas
                </CardTitle>
              </CardHeader>
              <CardContent className="h-36" />
            </Card>
            <Card className="border border-gray-200 rounded-xl shadow-sm h-52">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-normal text-gray-500">
                  Tiempos de Finalización
                </CardTitle>
              </CardHeader>
              <CardContent className="h-36" />
            </Card>
          </div>
        </div>

        {/* Monitoreo de estudiantes (placeholder lateral, 1 columna) */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-gray-800">Monitoreo de estudiantes</h2>
          <Card className="border border-gray-200 rounded-xl shadow-sm h-52">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-normal text-gray-500">
                Tiempos de Finalización
              </CardTitle>
            </CardHeader>
            <CardContent className="h-36" />
          </Card>
        </div>
      </div>

      {/* ── Monitoreo de estudiantes (grid de tarjetas) ───────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-800">Monitoreo de estudiantes</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {MOCK_STUDENTS.map((s) => (
              <MockStudentCard key={s.id} name={s.name} code={s.code} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
