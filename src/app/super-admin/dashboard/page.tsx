'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Users, 
  FileText, 
  Activity, 
  ShieldAlert, 
  Search, 
  LogOut, 
  Loader2,
  Calendar,
  UserCheck,
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from '@/components/theme-toggle';
import Image from 'next/image';

// Tipos de datos sincronizados con la API
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

export default function SuperAdminDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [exams, setExams] = useState<ExamSessionData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch de datos usando la API unificada (con autenticación)
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Obtener token de Azure AD
        const idToken = await user.getIdToken();
        
        if (!idToken) {
          console.error("No se pudo obtener el token de autenticación");
          setIsLoadingData(false);
          return;
        }

        const response = await fetch('/api/admin/dashboard-data', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data.stats);
          setExams(data.exams || []);
        } else {
          console.error("Error fetching admin data:", response.status);
        }
      } catch (error) {
        console.error("Error de conexión:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (user) {
        fetchData();
    }
  }, [user]);

  // Protección de ruta (Solo Super Admin)
  useEffect(() => {
    if (!loading && userProfile && userProfile.role !== 'super-admin') {
        router.push('/'); // Expulsar si no es admin
    }
  }, [loading, userProfile, router]);

  if (loading || isLoadingData) {
    return <div className="flex h-screen items-center justify-center bg-[#161F45]"><Loader2 className="h-10 w-10 animate-spin text-[#00d4ff]"/></div>;
  }

  if (!userProfile || userProfile.role !== 'super-admin') return null;

  // Filtrado de exámenes
  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exam.instructor_name && exam.instructor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    exam.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header Admin */}
      <header className="bg-[#161F45] border-b border-white/10 sticky top-0 z-10 shadow-md">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <Image src="/Logo lineas.png" alt="UGM" width={100} height={30} className="object-contain opacity-90" />
                <div className="h-8 w-px bg-white/20 mx-2"></div>
                <div className="flex flex-col">
                    <h1 className="text-white font-bold text-lg leading-none">Super Admin</h1>
                    <span className="text-[#00d4ff] text-xs font-mono">TORRE DE CONTROL</span>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <ThemeToggle />
                <div className="text-right hidden md:block">
                    <p className="text-white text-sm font-medium">{userProfile.nombre}</p>
                    <p className="text-white/50 text-xs">{userProfile.email}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={async () => {
                    const { signOut } = await import("@/lib/azure-auth"); await signOut(); router.push("/");
                }}>
                    <LogOut className="h-4 w-4"/>
                </Button>
            </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">

        {/* KPI Cards: Métricas clave para decisiones rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Exámenes Totales</CardTitle>
                    <FileText className="h-4 w-4 text-blue-500"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalExams || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Registrados en la plataforma</p>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow bg-green-50/50 dark:bg-green-900/10">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">En Curso Ahora</CardTitle>
                    <Activity className="h-4 w-4 text-green-500 animate-pulse"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats?.activeExams || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Sesiones monitoreando en vivo</p>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Estudiantes</CardTitle>
                    <Users className="h-4 w-4 text-purple-500"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Base de datos de alumnos</p>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Docentes</CardTitle>
                    <UserCheck className="h-4 w-4 text-orange-500"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalInstructors || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Cuentas con permisos de staff</p>
                </CardContent>
            </Card>
        </div>

        {/* Tabla de Gestión Centralizada */}
        <Card className="shadow-md border-0">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <LayoutDashboard className="h-5 w-5 text-primary"/>
                        Auditoría de Exámenes
                    </CardTitle>
                    <CardDescription>Visión global y estado de todas las sesiones.</CardDescription>
                </div>
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por título, docente..." 
                        className="pl-8 w-full md:w-[300px] bg-secondary/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[100px]">Estado</TableHead>
                                <TableHead>Asignatura / Examen</TableHead>
                                <TableHead>Docente Responsable</TableHead>
                                <TableHead className="text-center">Alumnos</TableHead>
                                <TableHead className="text-center">Alertas Críticas</TableHead>
                                <TableHead className="text-right">Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredExams.length > 0 ? (
                                filteredExams.map((exam) => (
                                    <TableRow key={exam.id}>
                                        <TableCell>
                                            {exam.status === 'active' && <Badge className="bg-green-500 hover:bg-green-600 animate-pulse">EN VIVO</Badge>}
                                            {exam.status === 'pending' && <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendiente</Badge>}
                                            {exam.status === 'finished' && <Badge variant="secondary">Finalizado</Badge>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-bold text-foreground">{exam.subject}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <span className="font-mono bg-muted px-1 rounded">{exam.access_code}</span>
                                                {exam.title}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-[#161F45]/10 flex items-center justify-center text-xs font-bold text-[#161F45]">
                                                    {exam.instructor_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{exam.instructor_name || 'Desconocido'}</span>
                                                    <span className="text-[10px] text-muted-foreground">{exam.instructor_email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="gap-1">
                                                <Users className="h-3 w-3"/> {exam.student_count}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {exam.critical_alerts > 0 ? (
                                                <Badge variant="destructive" className="gap-1">
                                                    <ShieldAlert className="h-3 w-3"/> {exam.critical_alerts}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            <div className="flex items-center justify-end gap-1">
                                                <Calendar className="h-3 w-3"/>
                                                {new Date(exam.created_at).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileText className="h-8 w-8 opacity-20"/>
                                            <p>No se encontraron exámenes registrados.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}