
'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/instructor/dashboard-layout';
import type { StudentSession } from '@/services/live-session.service';
import { Card } from '@/components/ui/card';
import Image from 'next/image';
import { WifiOff, Loader2 } from 'lucide-react';
import { UserNav } from '@/components/instructor/user-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PortalLogo } from '@/components/portal-logo';

export default function LiveMonitorPage() {
  const [liveStudents, setLiveStudents] = useState<StudentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/live', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('La conexión con el servidor de monitoreo falló.');
        }
        const data = await response.json();
        const activeStudents = (data.students || []).filter((s: StudentSession) => s.status !== 'finished');
        setLiveStudents(activeStudents);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Polling cada 3 segundos

    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardLayout>
      <header
        style={{ backgroundColor: "#161F45" }}
        className="border-b border-white/20 p-4 flex justify-between items-center"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="p-0 h-auto w-auto hover:bg-white/10" 
              onClick={() => router.push('/instructor')}
            >
              <Image
                src="/Logo lineas.png"
                alt="Universidad Gabriela Mistral"
                width={120}
                height={40}
                className="object-contain"
                style={{ width: 'auto', height: 'auto' }}
              />
              <span className="sr-only">Ir a Inicio</span>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">
                <span className="text-[#00d4ff]">Procto</span>
                <span className="text-white">Team</span>
              </h1>
              <p className="text-xs text-white/70">Portal del Docente</p>
            </div>
          </div>
          <div className="hidden md:block">
            <h2 className="text-lg font-bold text-white">
              Monitor Masivo en Vivo
            </h2>
            <p className="text-sm text-white/70">Vista de cuadrícula de todos los estudiantes activos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm font-semibold bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
              <WifiOff className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          <ThemeToggle />
          <UserNav />
        </div>
      </header>
      <main className="p-4 md:p-6 lg:p-8 flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="sr-only">Cargando...</span>
          </div>
        ) : liveStudents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {liveStudents.map(student => (
              <Card key={student.id} className="overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                <div className="aspect-[4/3] w-full bg-muted relative">
                   <Image 
                    src={student.imgSrc} 
                    alt={`Pantalla de ${student.name}`} 
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 16vw"
                    className="object-cover" 
                    data-ai-hint="student screen"
                  />
                </div>
                <div className="p-2 border-t bg-card">
                    <p className="text-sm font-semibold truncate" title={student.name}>{student.name}</p>
                    <p className="text-xs text-muted-foreground truncate" title={student.id}>ID: {student.id.substring(0,8)}...</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p>Esperando a que los estudiantes comiencen la sesión de monitoreo...</p>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
