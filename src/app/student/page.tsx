"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  KeyRound,
  History,
  Calendar,
  Bell,
  LogOut,
  Settings,
  Clock,
  BookOpen,
  GraduationCap,
  HelpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UserNav } from "@/components/instructor/user-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalLogo } from "@/components/portal-logo";
import Image from "next/image";

export default function StudentHomePage() {
  const { user, userProfile, loading } = useAuth();
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleJoinExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !accessCode.trim()) return;

    setIsLoading(true);
    try {
      const q = query(
        collection(db, "examSessions"),
        where("accessCode", "==", accessCode.trim().toUpperCase()),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          variant: "destructive",
          title: "Código no válido",
          description:
            "No se encontró ninguna sesión de examen con ese código. Por favor, verifícalo.",
        });
        setIsLoading(false);
        return;
      }

      const examDoc = querySnapshot.docs[0];
      const examData = examDoc.data();
      const examId = examDoc.id;

      if (examData.status === "finished") {
        toast({
          variant: "destructive",
          title: "Sesión Finalizada",
          description:
            "Esta sesión de examen ya ha sido finalizada por el instructor.",
          duration: 9000,
        });
        setIsLoading(false);
        return;
      }

      if (
        examData.blockedStudents &&
        examData.blockedStudents.find((s: any) => s.uid === user.uid)
      ) {
        toast({
          variant: "destructive",
          title: "Acceso Denegado",
          description:
            "Tu acceso a esta sesión de examen ha sido bloqueado previamente.",
          duration: 9000,
        });
        setIsLoading(false);
        return;
      }

      const examDocRef = doc(db, "examSessions", examId);
      await updateDoc(examDocRef, {
        students: arrayUnion(user.uid),
      });

      toast({
        title: "¡Éxito!",
        description: "Uniéndote a la sesión de examen...",
      });

      setIsModalOpen(false);
      setAccessCode("");
      router.push(`/student/exam/${examId}`);
    } catch (error) {
      console.error("Error joining exam session: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Ocurrió un problema al unirse a la sesión. Inténtalo de nuevo.",
      });
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-section">
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
                <Image
                  src="/Logo lineas.png"
                  alt="Universidad Gabriela Mistral"
                  width={120}
                  height={40}
                  className="object-contain"
                  style={{ width: 'auto', height: 'auto' }}
                />
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
              {/* Switch de tema */}
              <ThemeToggle />

              {/* Nombre del usuario */}
              <span className="text-white text-sm font-medium">
                {userProfile?.nombre || "juanito"}
              </span>


              {/* Botón de cerrar sesión */}
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

      {/* Espacio intermedio con botones fuera del banner */}
      <div className="py-4 bg-container">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-card hover:bg-card/80 text-foreground border border-border flex items-center gap-2 text-sm font-semibold"
                  >
                    <KeyRound className="w-4 h-4" />
                    Unirse a Examen
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <form onSubmit={handleJoinExam}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-[#515774]">
                        <KeyRound className="h-5 w-5" />
                        Unirse a un examen
                      </DialogTitle>
                      <DialogDescription>
                        Ingresa el código de acceso proporcionado por tu docente para comenzar la sesión de monitoreo.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="modal-access-code" className="text-[#515774] font-medium">
                          Código de Acceso:
                        </Label>
                        <Input
                          id="modal-access-code"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value)}
                          placeholder="Ej: ABC123"
                          required
                          className="text-center font-mono text-lg tracking-widest bg-gray-50 border-[#CCCFDD] text-[#515774] placeholder-gray-400 focus:border-[#00d4ff] focus:ring-[#00d4ff]"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        className="w-full bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold"
                        disabled={isLoading || !accessCode.trim()}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Unirse al Examen
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Button
                className="bg-card hover:bg-card/80 text-foreground border border-border flex items-center gap-2 text-sm font-semibold"
                onClick={() => router.push("/student/historic")}
              >
                <History className="w-4 h-4" />
                Histórico
              </Button>
            </div>

            <Button
              className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 text-sm font-semibold"
              onClick={() => router.push("/student/help")}
            >
              <HelpCircle className="w-4 h-4" />
              Ayuda
            </Button>
          </div>
        </div>
      </div>

      {/* Welcome Banner - Reducido a la mitad */}
      <div className="bg-gradient-to-r from-[#00d4ff] via-[#00b8e6] to-[#0099cc] relative overflow-hidden py-3">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white text-xs font-medium">
                <Calendar className="w-3 h-3" />
                <span>
                  {new Date().toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                Bienvenid@{userProfile?.nombre ? ` ${userProfile.nombre}` : ""}
              </h2>
              <p className="text-base text-white">Al Portal del Estudiante</p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="relative z-10 bg-[#00BFFF] rounded-full p-3">
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
                  <Image
                    src="/Estudiante.png"
                    alt="Estudiante"
                    width={240}
                    height={240}
                    className="object-contain"
                  />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#1a1d47]/20 rounded-full"></div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-white/30 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 bg-panel rounded-lg mx-6 my-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Join Exam Card */}
            <Card className="bg-card border border-border shadow-lg rounded-lg">
              <form onSubmit={handleJoinExam}>
                <CardHeader className="text-center">
                  <div className="w-16 h-16 bg-[#00d4ff]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="h-8 w-8 text-[#00d4ff]" />
                  </div>
                  <CardTitle className="text-2xl text-foreground">
                    Unirse a Examen
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Ingresa el código de acceso proporcionado por tu docente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="access-code" className="text-foreground font-medium">
                      Código de Acceso
                    </Label>
                    <Input
                      id="access-code"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Ej: ABC123"
                      required
                      className="text-center font-mono text-lg tracking-widest bg-muted border-border text-foreground placeholder-muted-foreground focus:border-[#00d4ff] focus:ring-[#00d4ff]"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold"
                    disabled={isLoading || !accessCode.trim()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                        Verificando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Unirse al Examen
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* Status Card */}
            <Card className="bg-card border border-border shadow-lg rounded-lg h-full flex flex-col">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-[#00d4ff]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-8 w-8 text-[#00d4ff]" />
                </div>
                <CardTitle className="text-2xl text-foreground">
                  Estado del Sistema
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Verifica el estado de tus dispositivos y conexión
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-center space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                    <span className="text-sm text-foreground font-medium">Conexión</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-500 font-semibold">Activa</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                    <span className="text-sm text-foreground font-medium">Cámara</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-500 font-semibold">
                        Disponible
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                    <span className="text-sm text-foreground font-medium">Micrófono</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-500 font-semibold">
                        Disponible
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <div className="w-full text-center">
                  <p className="text-xs text-muted-foreground">
                    Todos los sistemas funcionando correctamente
                  </p>
                </div>
              </CardFooter>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}