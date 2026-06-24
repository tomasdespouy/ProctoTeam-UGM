'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithAzureRedirect, handleAzureRedirectResult } from '@/lib/azure-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { PortalLogo } from '@/components/portal-logo';
import { useToast } from "@/hooks/use-toast";

export default function InstructorLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // 1. Lógica de Redirección Automática por Rol
  useEffect(() => {
    // Solo actuamos si ya terminó de cargar y tenemos perfil
    if (!loading && user && userProfile) {
      console.log("Usuario detectado con rol:", userProfile.role);

      if (userProfile.role === 'super-admin') {
        // 🚀 Si es Super Admin -> Va a la Torre de Control
        router.push('/super-admin/dashboard');
      } else if (userProfile.role === 'instructor') {
        // 👨‍🏫 Si es Instructor -> Va a su panel normal
        router.push('/instructor');
      } else {
        // 🚫 Si es Estudiante colado -> Error y pa' fuera
        toast({
          variant: "destructive",
          title: "Acceso Restringido",
          description: "Esta cuenta es de estudiante. Por favor ingresa por el Portal de Estudiante.",
        });
        // Opcional: router.push('/student');
      }
    }
  }, [user, userProfile, loading, router, toast]);

  // 2. Verificar redirecciones de Microsoft (Móviles/Fallback)
  useEffect(() => {
    const checkRedirect = async () => {
      if (!user) {
          await handleAzureRedirectResult();
      }
    };
    checkRedirect();
  }, [user]);

  const handleAzureLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); 
    if (isLoading) return;

    setIsLoading(true);

    try {
        // Flujo de REDIRECT (sin popup): la ventana navega a Microsoft y vuelve.
        // El useEffect de arriba enruta por rol al volver con sesión.
        const { error } = await signInWithAzureRedirect();
        if (error) {
            setIsLoading(false);
            toast({
                variant: "destructive",
                title: "Error de conexión",
                description: "No se pudo conectar con Microsoft.",
            });
        }
    } catch (err) {
        console.error("Error en login:", err);
        toast({
            variant: "destructive",
            title: "Error de conexión",
            description: "No se pudo conectar con Microsoft.",
        });
        setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-xl border-0 bg-card/95 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-2 transform hover:scale-105 transition-transform">
            <PortalLogo size="lg" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">Portal Docente</CardTitle>
            <CardDescription>
                Acceso unificado para Instructores y Administradores
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button 
              onClick={handleAzureLogin}
              type="button"
              disabled={isLoading}
              className="w-full h-12 text-md font-medium shadow-md transition-all hover:translate-y-[-2px]"
              size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Verificando credenciales...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" />
                Ingresar con cuenta UGM
              </>
            )}
          </Button>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground mt-4">
             <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
             <p>
               El sistema detectará automáticamente tu nivel de privilegios (Docente o Super Admin) una vez inicies sesión.
             </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}