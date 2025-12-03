'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Calendar, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DashboardLayout } from '@/components/instructor/dashboard-layout';

interface ExamSession {
  id: string;
  title: string;
  subject: string;
  section: string;
  status: 'pending' | 'active' | 'finished';
  created_at: string;
  access_code: string;
  student_count: number;
}

export default function HistoricPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/exam-sessions/by-instructor', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            setSessions(data.sessions || []);
        } else {
            console.error("Error cargando historial");
        }
      } catch (error) {
        console.error("Error de red:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (!loading) {
        fetchHistory();
    }
  }, [user, loading]);

  if (loading || isLoadingData) {
    return (
        <div className="flex justify-center items-center h-screen bg-[#161F45]">
            <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
        </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2"/> Volver
            </Button>
            <h1 className="text-2xl font-bold text-white">Historial de Exámenes</h1>
        </div>

        <Card className="border-0 shadow-lg">
            <CardHeader>
                <CardTitle>Mis Sesiones Anteriores</CardTitle>
                <CardDescription>Registro completo de exámenes creados y su estado.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Estado</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead>Asignatura</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-center">Alumnos</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.length > 0 ? (
                            sessions.map((session) => (
                                <TableRow key={session.id}>
                                    <TableCell>
                                        {session.status === 'active' && <Badge className="bg-green-500">Activo</Badge>}
                                        {session.status === 'finished' && <Badge variant="secondary">Finalizado</Badge>}
                                        {session.status === 'pending' && <Badge variant="outline">Pendiente</Badge>}
                                    </TableCell>
                                    <TableCell className="font-medium">{session.title}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{session.subject}</span>
                                            <span className="text-xs text-muted-foreground">{session.section}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="h-4 w-4"/>
                                            {format(new Date(session.created_at), "d MMM yyyy", { locale: es })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="gap-1">
                                            <Users className="h-3 w-3"/> {session.student_count}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {session.status === 'active' && (
                                            <Button 
                                                size="sm" 
                                                className="bg-[#00d4ff] text-[#161F45] hover:bg-[#00b8e6]"
                                                onClick={() => router.push('/instructor')} // Va al dashboard activo
                                            >
                                                <Eye className="h-4 w-4 mr-2"/> Monitorear
                                            </Button>
                                        )}
                                        {/* Futuro: Botón ver reporte */}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                    No has creado exámenes todavía.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}