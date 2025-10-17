
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from "react-day-picker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { UserNav } from '@/components/instructor/user-nav';
import { History, FileDown, Loader2, Inbox, BarChart2, Search, Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, UserCog, LogOut } from 'lucide-react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { useRouter } from 'next/navigation';
import { PortalLogo } from '@/components/portal-logo';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';

interface ExamSession {
  id: string;
  title: string;
  subject: string;
  section: string;
  duration: number;
  access_code: string;
  created_at: string;
  instructor_id: string;
  instructor_name?: string;
}

interface AlertData {
    student_id: string;
    student_name?: string;
    severity: string;
    description: string;
    timestamp: string;
}

interface StudentSessionData {
    id: string;
    name: string;
    start_time: number;
    finish_time: number;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {
    const handlePrevious = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    };

    const handleNext = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    };

    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5;
        const halfPages = Math.floor(maxPagesToShow / 2);

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            pageNumbers.push(1);
            if (currentPage > 3) {
                pageNumbers.push('...');
            }

            let start = Math.max(2, currentPage - halfPages + 1);
            let end = Math.min(totalPages - 1, currentPage + halfPages -1);

            if(currentPage <= 2) {
                end = 3;
            }
             if(currentPage >= totalPages -1) {
                start = totalPages - 2;
            }

            for (let i = start; i <= end; i++) {
                pageNumbers.push(i);
            }

            if (currentPage < totalPages - 2) {
                pageNumbers.push('...');
            }
            pageNumbers.push(totalPages);
        }
        return pageNumbers;
    };

    const pages = getPageNumbers();

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentPage === 1}
            >
                <ChevronLeft className="h-4 w-4" />
                Anterior
            </Button>
            <div className="flex items-center gap-1">
                 {pages.map((page, index) =>
                    typeof page === 'number' ? (
                        <Button
                            key={index}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </Button>
                    ) : (
                        <span key={index} className="px-2 py-1">...</span>
                    )
                )}
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentPage === totalPages}
            >
                Siguiente
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
};


export default function SuperAdminDashboard() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [date, setDate] = useState<DateRange | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!userProfile || userProfile.role !== 'super-admin') {
      router.push('/');
      return;
    }
  }, [userProfile, router, authLoading, user]);


  useEffect(() => {
    const fetchExamSessions = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/exam-sessions/all', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Error al obtener sesiones');
        }

        const data = await response.json();
        setExamSessions(data.sessions || []);
      } catch (error) {
        console.error("Error fetching exam sessions: ", error);
        toast({
          variant: "destructive",
          title: "Error al cargar el histórico",
          description: "No se pudieron obtener las sesiones de examen.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchExamSessions();
    }
  }, [user, authLoading, toast]);

  const filteredSessions = useMemo(() => {
    setCurrentPage(1); // Reset page to 1 whenever filters change
    return examSessions.filter(session => {
        const lowerCaseFilter = filter.toLowerCase();
        const titleMatch = session.title.toLowerCase().includes(lowerCaseFilter);
        const instructorMatch = session.instructor_name?.toLowerCase().includes(lowerCaseFilter);
        const subjectMatch = session.subject?.toLowerCase().includes(lowerCaseFilter);
        const sectionMatch = session.section?.toLowerCase().includes(lowerCaseFilter);

        const textMatch = titleMatch || instructorMatch || subjectMatch || sectionMatch;

        const createdAtDate = new Date(session.created_at);
        if (!createdAtDate || isNaN(createdAtDate.getTime())) return false;

        let dateMatch = true;
        if (date?.from) {
            const fromDate = new Date(date.from.setHours(0, 0, 0, 0));
            dateMatch = createdAtDate >= fromDate;
        }
        if (date?.to) {
            const toDate = new Date(date.to.setHours(23, 59, 59, 999));
            dateMatch = dateMatch && createdAtDate <= toDate;
        }
        
        return textMatch && dateMatch;
    });
  }, [examSessions, filter, date]);

  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSessions.slice(startIndex, endIndex);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);
  
  const handleDownloadReport = async (session: ExamSession, type: 'alerts' | 'stats') => {
    setIsDownloading(prevState => ({ ...prevState, [session.id + type]: true }));

    try {
        if (!user) return;
        
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/exam-sessions/${session.id}/alerts`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
            throw new Error('Error al obtener datos de la sesión');
        }

        const { alerts, studentDetails } = await response.json();

        if (!alerts || alerts.length === 0) {
            toast({
                title: "Sin Datos",
                description: "Esta sesión de examen no tiene datos registrados para descargar.",
            });
            setIsDownloading(prevState => ({ ...prevState, [session.id + type]: false }));
            return;
        }

        const studentSessionData = studentDetails as StudentSessionData[];

        let csvContent = "";
        let fileName = "";

        if (type === 'alerts') {
            const csvRows: string[][] = [
                ['Fecha', 'Hora', 'Estudiante', 'ID Estudiante', 'Severidad', 'Descripción']
            ];
            
            alerts.forEach((alert: AlertData) => {
                const timestamp = new Date(alert.timestamp);
                const date = !isNaN(timestamp.getTime()) ? format(timestamp, 'yyyy-MM-dd') : 'N/A';
                const time = !isNaN(timestamp.getTime()) ? format(timestamp, 'HH:mm:ss') : 'N/A';
                const studentName = alert.student_name || `ID ${alert.student_id.substring(0,8)}`;
                
                csvRows.push([
                    `"${date}"`,
                    `"${time}"`,
                    `"${studentName}"`,
                    `"${alert.student_id}"`,
                    `"${alert.severity}"`,
                    `"${alert.description.replace(/"/g, '""')}"` // Escape double quotes
                ]);
            });

            csvContent = csvRows.map(e => e.join(",")).join("\n");
            fileName = `reporte_alertas_${session.title.replace(/[^a-z0-9]/gi, '_')}.csv`;
        } else { // stats
             const alertCounts = alerts.reduce((acc: Record<string, number>, alert: AlertData) => {
                acc[alert.description] = (acc[alert.description] || 0) + 1;
                return acc;
            }, {});
            const totalAlerts = alerts.length;

            let statsCsvContent = "Estadisticas de Alertas\n";
            statsCsvContent += "Tipo de Alerta,Cantidad,Porcentaje\n";
            Object.entries(alertCounts).forEach(([desc, count]) => {
                 const percentage = totalAlerts > 0 ? ((count / totalAlerts) * 100).toFixed(1) : 0;
                 statsCsvContent += `"${desc}",${count},${percentage}%\n`;
            });
            statsCsvContent += `Total de Alertas,${totalAlerts}\n\n`;

            const finishedStudents = studentSessionData.filter(s => s.start_time && s.finish_time);
            if(finishedStudents.length > 0) {
                 const durations = finishedStudents.map(s => parseFloat(((s.finish_time - s.start_time) / 60000).toFixed(1)));
                 const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;

                statsCsvContent += "Estadisticas de Tiempos de Finalizacion (minutos)\n";
                statsCsvContent += "Estudiante,Duracion\n";
                finishedStudents.forEach(item => {
                    const duration = parseFloat(((item.finish_time - item.start_time) / 60000).toFixed(1));
                    statsCsvContent += `"${item.name}",${duration}\n`;
                });
                statsCsvContent += `\nPromedio,${average.toFixed(1)}\n`;
                statsCsvContent += `Mas Rapido,${Math.min(...durations)}\n`;
                statsCsvContent += `Mas Lento,${Math.max(...durations)}\n`;
            } else {
                statsCsvContent += "No hay datos de tiempos de finalización.\n";
            }
            csvContent = statsCsvContent;
            fileName = `reporte_estadisticas_${session.title.replace(/[^a-z0-9]/gi, '_')}.csv`;
        }

        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        
        link.click();
        document.body.removeChild(link);
        
        toast({
            title: "Reporte Generado",
            description: "La descarga de tu reporte CSV ha comenzado.",
        });

    } catch (error) {
        console.error("Error downloading report:", error);
        toast({
            variant: "destructive",
            title: "Error al Descargar",
            description: "No se pudo generar el reporte. Revisa la consola para más detalles.",
        });
    } finally {
        setIsDownloading(prevState => ({ ...prevState, [session.id + type]: false }));
    }
  };

  const renderContent = () => {
    if (isLoading || authLoading) {
      return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    
    if (examSessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
                <Inbox className="h-12 w-12 mb-4" />
                <h3 className="text-xl font-semibold">No hay exámenes en el sistema</h3>
                <p className="mt-2 text-sm">Aún no se ha creado ninguna sesión de examen.</p>
            </div>
        )
    }

    if (filteredSessions.length === 0 && (filter || date)) {
        return (
             <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
                <Search className="h-12 w-12 mb-4" />
                <h3 className="text-xl font-semibold">No se encontraron resultados</h3>
                <p className="mt-2 text-sm">Prueba con otro término de búsqueda o rango de fechas.</p>
            </div>
        )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título del Examen</TableHead>
            <TableHead>Docente</TableHead>
            <TableHead>Asignatura</TableHead>
            <TableHead>Sección</TableHead>
            <TableHead>Código de Acceso</TableHead>
            <TableHead>Fecha de Creación</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell className="font-medium">{session.title}</TableCell>
              <TableCell className="font-medium flex items-center gap-2 pt-6"><UserCog className="h-4 w-4 text-muted-foreground"/>{session.instructor_name || 'Desconocido'}</TableCell>
              <TableCell>{session.subject}</TableCell>
              <TableCell><Badge variant="secondary">{session.section}</Badge></TableCell>
              <TableCell className="font-mono text-sm font-semibold"><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">{session.access_code}</Badge></TableCell>
              <TableCell>
                {session.created_at ? format(new Date(session.created_at), 'PPP', { locale: es }) : 'N/A'}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDownloadReport(session, 'alerts')}
                    disabled={isDownloading[session.id + 'alerts']}
                >
                    {isDownloading[session.id + 'alerts'] ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Alertas
                </Button>
                 <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDownloadReport(session, 'stats')}
                    disabled={isDownloading[session.id + 'stats']}
                >
                    {isDownloading[session.id + 'stats'] ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <BarChart2 className="mr-2 h-4 w-4" />
                    )}
                    Estadísticas
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  if (authLoading) {
    return (
        <div className="flex justify-center items-center h-screen bg-secondary">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-section">
      {/* Header */}
      <header
        style={{ backgroundColor: "#161F45" }}
        className="border-b border-white/20"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" className="p-0 h-auto w-auto" onClick={() => router.push('/instructor')}>
                  <Image
                    src="/Logo lineas.png"
                    alt="Universidad Gabriela Mistral"
                    width={120}
                    height={40}
                    className="object-contain"
                  />
                  <span className="sr-only">Ir a Inicio</span>
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    <span className="text-[#00d4ff]">Procto</span>
                    <span className="text-white">Team</span>
                  </h1>
                  <p className="text-xs text-white/70">Portal del Super Administrador</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <span className="text-white text-sm font-medium">
                {userProfile?.nombre || "Super Admin"}
              </span>
              <Button
                className="bg-[#242F62] hover:bg-[#1a1d47] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium border-0"
                onClick={async () => {
                  const { signOut } = await import("@/lib/azure-auth");
                  await signOut();
                  router.push("/");
                }}
              >
                <LogOut className="w-4 h-4" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* Contenido principal */}
      <main className="container mx-auto px-6 py-6 bg-panel rounded-lg mx-6 my-6">
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-center gap-4 flex-wrap">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-6 w-6 text-primary" />
                            Historial de Todas las Sesiones
                        </CardTitle>
                        <CardDescription>
                            Aquí se listan todos los exámenes que se han configurado en la plataforma.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search className="absolute h-4 w-4 top-1/2 -translate-y-1/2 left-3 text-muted-foreground" />
                            <Input 
                                placeholder="Filtrar por título, docente..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10 w-full sm:w-64"
                            />
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                    "w-[260px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                    <>
                                        {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                        {format(date.to, "LLL dd, y", { locale: es })}
                                    </>
                                    ) : (
                                    format(date.from, "LLL dd, y", { locale: es })
                                    )
                                ) : (
                                    <span>Seleccionar fecha</span>
                                )}
                                </Button>
                            </PopoverTrigger>
                             {date && (
                                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDate(undefined)}>
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Limpiar fecha</span>
                                </Button>
                            )}
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                                locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                    </div>
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                    />
                </CardFooter>
            )}
        </Card>
      </main>
    </div>
  );
}

    