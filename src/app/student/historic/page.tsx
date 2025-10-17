"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History,
  Loader2,
  Inbox,
  Search,
  Calendar as CalendarIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Monitor,
  KeyRound,
  GraduationCap,
  LogOut,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ExamSession {
  id: string;
  title: string;
  duration: number;
  accessCode: string;
  createdAt: Timestamp;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
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
    const pageNumbers: (number | string)[] = [];
    const maxPagesToShow = 5;
    const halfPages = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      if (currentPage > 3) {
        pageNumbers.push("...");
      }

      let start = Math.max(2, currentPage - halfPages + 1);
      let end = Math.min(totalPages - 1, currentPage + halfPages - 1);

      if (currentPage <= 2) {
        end = 3;
      }
      if (currentPage >= totalPages - 1) {
        start = totalPages - 2;
      }

      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }

      if (currentPage < totalPages - 2) {
        pageNumbers.push("...");
      }
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="bg-card hover:bg-card/80 text-foreground border border-border"
      >
        {currentPage}
      </Button>
      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          typeof page === "number" ? (
            <Button
              key={index}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 w-8",
                currentPage === page
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : "bg-card hover:bg-card/80 text-foreground border border-border",
              )}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ) : (
            <span key={index} className="px-2 py-1 text-[#515774]">
              ...
            </span>
          ),
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="bg-card hover:bg-card/80 text-foreground border border-border"
      >
        {totalPages}
      </Button>
    </div>
  );
};

export default function StudentHistoricPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchExamSessions = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const q = query(
          collection(db, "examSessions"),
          where("students", "array-contains", user.uid),
        );
        const querySnapshot = await getDocs(q);
        const sessions = querySnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as ExamSession,
        );

        setExamSessions(sessions);
      } catch (error) {
        console.error("Error fetching exam sessions: ", error);
        toast({
          variant: "destructive",
          title: "Error al cargar el histórico",
          description:
            "No se pudieron obtener las sesiones de examen. Por favor, inténtalo más tarde.",
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
    setCurrentPage(1);
    const sortedByDate = [...examSessions].sort(
      (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
    );

    return sortedByDate.filter((session) => {
      const titleMatch = session.title
        .toLowerCase()
        .includes(filter.toLowerCase());

      const createdAtDate = session.createdAt?.toDate();
      if (!createdAtDate) return false;

      let dateMatch = true;
      if (date?.from) {
        const fromDate = new Date(date.from.setHours(0, 0, 0, 0));
        dateMatch = createdAtDate >= fromDate;
      }
      if (date?.to) {
        const toDate = new Date(date.to.setHours(23, 59, 59, 999));
        dateMatch = dateMatch && createdAtDate <= toDate;
      }

      return titleMatch && dateMatch;
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

  const renderContent = () => {
    if (isLoading) {
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
        <div className="flex flex-col items-center justify-center text-center py-16 text-[#515774]">
          <Inbox className="h-12 w-12 mb-4" />
          <h3 className="text-xl font-semibold">No has rendido exámenes</h3>
          <p className="mt-2 text-sm">
            Los exámenes que rindas aparecerán aquí.
          </p>
        </div>
      );
    }

    if (filteredSessions.length === 0 && (filter || date)) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-16 text-[#515774]">
          <Search className="h-12 w-12 mb-4" />
          <h3 className="text-xl font-semibold">
            No se encontraron resultados
          </h3>
          <p className="mt-2 text-sm">
            Prueba con otro término de búsqueda o rango de fechas.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-b border-border">
              <TableHead className="text-foreground font-semibold">
                Título del Examen
              </TableHead>
              <TableHead className="text-foreground font-semibold">
                Fecha de Rendición
              </TableHead>
              <TableHead className="text-center text-foreground font-semibold">
                Duración (min)
              </TableHead>
              <TableHead className="text-foreground font-semibold">
                Código de Acceso
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.map((session, index) => (
              <TableRow
                key={session.id}
                className={cn(
                  "border-b border-border hover:bg-muted/50",
                  index % 2 === 0 ? "bg-card" : "bg-muted/30",
                )}
              >
                <TableCell className="font-medium text-foreground">
                  {session.title}
                </TableCell>
                <TableCell className="text-foreground">
                  {session.createdAt
                    ? format(session.createdAt.toDate(), "dd/MM/yyyy", {
                        locale: es,
                      })
                    : "N/A"}
                </TableCell>
                <TableCell className="text-center text-foreground">
                  {session.duration}
                </TableCell>
                <TableCell>
                  <code className="font-mono bg-muted text-foreground p-1 rounded border border-border">
                    {session.accessCode}
                  </code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-[#1a1d47] to-[#242f62]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
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
                <Button
                  variant="ghost"
                  className="p-0 h-auto w-auto"
                  onClick={() => router.push("/student")}
                >
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
                  <p className="text-xs text-white/70">Portal del Estudiante</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <span className="text-white text-sm font-medium">
                {userProfile?.nombre || "juanito"}
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

      {/* Botones de navegación */}
      <div className="py-4 bg-container">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                className="bg-card hover:bg-card/80 text-foreground border border-border flex items-center gap-2 text-sm font-semibold"
                onClick={() => router.push("/student")}
              >
                <KeyRound className="w-4 h-4" />
                Unirse a Examen
              </Button>

              <Button className="bg-[#515774] hover:bg-[#414362] text-white border border-[#515774] flex items-center gap-2 text-sm font-semibold">
                <History className="w-4 h-4" />
                Histórico
              </Button>
            </div>

            <Button
              className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 text-sm font-semibold"
              onClick={() => router.push("/student/help")}
            >
              Ayuda
            </Button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="container mx-auto px-6 py-6 bg-panel rounded-lg mx-6 my-6">
        <Card className="bg-card border border-border shadow-lg rounded-lg overflow-hidden">
          {/* Header del contenido */}
          <CardHeader className="bg-muted border-b border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  Exámenes Rendidos
                </h2>
                <p className="text-sm text-muted-foreground">
                  Aquí se listan todos los exámenes en los que has participado.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute h-4 w-4 top-1/2 -translate-y-1/2 left-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-10 w-48 bg-background border-border text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant="outline"
                      className={cn(
                        "w-[180px] justify-start text-left font-normal bg-card hover:bg-card/80 text-foreground border border-border",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date?.from ? (
                        date.to ? (
                          <>
                            {format(date.from, "dd/MM/yy")} -{" "}
                            {format(date.to, "dd/MM/yy")}
                          </>
                        ) : (
                          format(date.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
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
                {date && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-foreground hover:bg-muted"
                    onClick={() => setDate(undefined)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Limpiar fecha</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Contenido de la tabla */}
          <CardContent className="p-6">{renderContent()}</CardContent>

          {/* Footer con paginación */}
          {totalPages > 1 && (
            <CardFooter className="bg-muted border-t border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </CardFooter>
          )}
        </Card>
      </main>
    </div>
  );
}
