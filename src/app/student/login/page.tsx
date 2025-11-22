'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithAzureRedirect } from '@/lib/azure-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { PortalLogo } from '@/components/portal-logo';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

export default function StudentLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  console.log('[StudentLoginPage] Renderizando, loading:', loading, 'user:', user ? 'exists' : 'null', 'userProfile:', userProfile ? 'exists' : 'null');

  useEffect(() => {
    console.log('[StudentLoginPage] useEffect - loading:', loading, 'user:', user ? 'exists' : 'null', 'userProfile:', userProfile ? 'exists' : 'null');
    
    if (!loading && user && userProfile) {
      console.log('[StudentLoginPage] Usuario autenticado, redirigiendo a /student');
      if (userProfile.role === 'student') {
        router.push('/student');
      } else {
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "Esta cuenta no es de estudiante. Por favor, usa el portal correcto.",
        });
      }
    }
  }, [user, userProfile, loading]);

  const handleAzureLogin = async () => {
    console.log('[Student Login] Iniciando login con Azure');
    setIsLoading(true);
    try {
      console.log('[Student Login] Guardando loginRole en sessionStorage');
      sessionStorage.setItem('loginRole', 'student');
      console.log('[Student Login] loginRole guardado');
      
      console.log('[Student Login] Llamando signInWithAzureRedirect()');
      const result = await signInWithAzureRedirect();
      console.log('[Student Login] Resultado de signInWithAzureRedirect:', result);
      
      if (result.error) {
        console.error('[Student Login] Error de login:', result.error);
        toast({
          variant: "destructive",
          title: "Error de autenticación",
          description: "No se pudo iniciar sesión. Por favor, intenta de nuevo.",
        });
        setIsLoading(false);
      } else {
        console.log('[Student Login] Login exitoso, esperando redirect a Azure');
      }
    } catch (error) {
      console.error('[Student Login] Excepción en handleAzureLogin:', error);
      toast({
        variant: "destructive",
        title: "Error de autenticación",
        description: "Error inesperado. Por favor, intenta de nuevo.",
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
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center mb-2">
            <PortalLogo width={64} height={64} />
          </div>
          <CardTitle className="text-2xl text-center">Portal de Estudiantes</CardTitle>
          <CardDescription className="text-center">
            Inicia sesión con tu cuenta institucional UGM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Botón original con el componente Button */}
          <Button 
            onClick={(e) => {
              console.log('[StudentLogin] Button onClick ejecutado!');
              e.preventDefault();
              handleAzureLogin();
            }}
            disabled={isLoading}
            className="w-full"
            size="lg"
            type="button"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" />
                Ingresar con Microsoft
              </>
            )}
          </Button>
          
          {/* Botón HTML nativo de prueba - SIEMPRE VISIBLE */}
          <button
            onClick={() => {
              console.log('[StudentLogin] ========== CLICK NATIVO TEST ==========');
              console.log('[StudentLogin] isLoading actual:', isLoading);
              console.log('[StudentLogin] Llamando handleAzureLogin directamente...');
              handleAzureLogin();
            }}
            className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium"
            type="button"
          >
            🧪 TEST: Botón Nativo - Login Microsoft
          </button>
          
          {/* Debug info */}
          <div className="text-xs text-center text-muted-foreground space-y-1">
            <p>Estado actual: isLoading = {isLoading ? 'true' : 'false'}</p>
            <p>Si no funcionan los clicks, hay un overlay bloqueando</p>
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Usa tu cuenta institucional de la Universidad Gabriela Mistral
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
