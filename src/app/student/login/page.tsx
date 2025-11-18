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

  // Eliminado: La lógica de redirect ahora está en /auth/callback

  useEffect(() => {
    if (!loading && user && userProfile) {
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
  }, [user, userProfile, loading, router, toast]);

  const handleAzureLogin = async () => {
    setIsLoading(true);
    sessionStorage.setItem('loginRole', 'student');
    const result = await signInWithAzureRedirect();
    
    if (result.error) {
      console.error('Error de login:', result.error);
      toast({
        variant: "destructive",
        title: "Error de autenticación",
        description: "No se pudo iniciar sesión. Por favor, intenta de nuevo.",
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
          <Button 
            onClick={handleAzureLogin} 
            disabled={isLoading}
            className="w-full"
            size="lg"
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
