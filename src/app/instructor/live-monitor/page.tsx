'use client';

import { useState, useEffect, Suspense } from 'react';
import { DashboardLayout } from '@/components/instructor/dashboard-layout';
import type { StudentSession } from '@/services/live-session.service';
import { Card } from '@/components/ui/card';
import { WifiOff, Loader2, ArrowLeft, Users } from 'lucide-react';
import { UserNav } from '@/components/instructor/user-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

// Componente interno que usa useSearchParams (debe estar dentro de Suspense)
function LiveMonitorContent() {
  const [liveStudents, setLiveStudents] = useState<StudentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 1. Extraer ID de la URL
  const searchParams = useSearchParams();
  const examId = searchParams.get('examId');

  useEffect(() => {
    // Si no hay ID, mostramos error y paramos
    if (!examId) {
        setError("No se especificó un ID de examen.");
        setLoading(false);
        return;
    }

    const fetchData = async () => {
      try {
        // 2. Pasar el ID a la API
        const response = await fetch(`/api/live?examId=${examId}`, { cache: 'no-store' });

        if (!response.ok) {
           if (response.status === 404) throw new Error('Examen no encontrado o finalizado.');
           throw new Error('Error de conexión con el servidor.');
        }

        const data = await response.json();
        // Filtramos solo los activos
        const activeStudents = (data.students || []).filter((s: StudentSession) => s.status !== 'submitted' && s.status !== 'blocked');

        setLiveStudents(activeStudents);
        setError(null);
      } catch (err: any) {
        console.error(err);
        // Solo mostrar error en UI si es persistente, para no parpadear en fallos de red momentáneos
        if (err.message.includes('No se especificó')) setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Polling cada 3s

    return () => clearInterval(interval);
  }, [examId]);

  if (!examId) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold mb-2">No se seleccionó ningún examen</h2>
              <p className="text-muted-foreground mb-4">Debes iniciar el monitoreo desde el Dashboard principal.</p>
              <Button onClick={() => router.push('/instructor')}>Volver al Dashboard</Button>
          </div>
      );
  }

  return (
      <main className="p-4 md:p-6 lg:p-8 flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
            <div className="flex flex-col items-center justify-center h-64">
                <WifiOff className="h-10 w-10 text-destructive mb-2" />
                <p className="text-destructive font-bold">{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/instructor')}>Salir</Button>
            </div>
        ) : liveStudents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {liveStudents.map(student => (
              <Card key={student.id} className="overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-card border-white/10">
                <div className="aspect-[4/3] w-full bg-black/90 relative group">
                   {student.lastSnapshot ? (
                       <img 
                        src={student.lastSnapshot} 
                        alt={`Pantalla de ${student.name}`} 
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                   ) : (
                       <div className="flex items-center justify-center h-full text-white/50">
                           <Loader2 className="h-6 w-6 animate-spin" />
                       </div>
                   )}
                   <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white font-mono">
                       Hace {Math.floor((Date.now() - new Date(student.lastSeen).getTime()) / 1000)}s
                   </div>
                </div>
                <div className="p-3 border-t bg-card">
                    <p className="text-sm font-bold truncate text-foreground">{student.name}</p>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-muted-foreground">ID: {student.studentId.substring(0,6)}...</span>
                        {student.alerts && student.alerts.length > 0 && (
                            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Tiene alertas activas" />
                        )}
                    </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">Esperando conexión de estudiantes...</p>
            <p className="text-sm opacity-70">Asegúrate de haber compartido el código de acceso.</p>
          </div>
        )}
      </main>
  );
}

export default function LiveMonitorPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <header style={{ backgroundColor: "#161F45" }} className="border-b border-white/20 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <Button 
              variant="ghost" 
              className="text-white hover:bg-white/10 gap-2" 
              onClick={() => router.push('/instructor')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Volver</span>
            </Button>
          <div>
            <h2 className="text-lg font-bold text-white">Monitor Masivo</h2>
            <p className="text-xs text-white/70 hidden sm:block">Vista de cuadrícula en tiempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <UserNav />
        </div>
      </header>

      <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <LiveMonitorContent />
      </Suspense>
    </DashboardLayout>
  );
}