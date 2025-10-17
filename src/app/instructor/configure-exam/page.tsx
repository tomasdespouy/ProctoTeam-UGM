
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserNav } from '@/components/instructor/user-nav';
import { useToast } from "@/hooks/use-toast";
import { Copy, Layers, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { PortalLogo } from '@/components/portal-logo';


export default function ConfigureExamPage() {
  const [examTitle, setExamTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('');
  const [duration, setDuration] = useState<number | ''>(60);
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const generateAccessCode = useCallback((length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }, []);
  
  // This useEffect will run only on the client, after hydration, avoiding the mismatch.
  useEffect(() => {
    setAccessCode(generateAccessCode());
  }, [generateAccessCode]);


  const handleCopyCode = useCallback(() => {
    if (!accessCode) return;
    navigator.clipboard.writeText(accessCode).then(() => {
      toast({
        title: "Copiado",
        description: "El código de acceso ha sido copiado al portapapeles.",
      });
    });
  }, [accessCode, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || userProfile?.role !== 'instructor') {
        toast({
            variant: 'destructive',
            title: 'Acción no permitida',
            description: 'Solo los instructores pueden crear salas de examen.',
        });
        return;
    }
    
    if (duration === '' || isNaN(duration) || duration < 10 || duration > 240) {
        toast({
            variant: "destructive",
            title: "Duración inválida",
            description: "La duración debe ser un número entre 10 y 240 minutos.",
        });
        return;
    }

    setIsLoading(true);

    try {
        const idToken = await user.getIdToken();
        
        const response = await fetch('/api/exam-sessions/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                title: examTitle,
                subject,
                section,
                duration,
                accessCode,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al crear la sesión');
        }

        toast({
            title: "Sala de Examen Creada",
            description: `La sala para "${examTitle}" está lista. Redirigiendo al panel...`,
        });
        
        router.push('/instructor');

    } catch (error) {
        console.error("Error creating exam session: ", error);
        toast({
            variant: "destructive",
            title: "Error al crear la sala",
            description: error instanceof Error ? error.message : "No se pudo guardar la configuración del examen.",
        });
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      <header className="bg-primary text-primary-foreground border-b p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="p-0 h-auto w-auto" onClick={() => router.push('/instructor')}>
            <PortalLogo />
            <span className="sr-only">Ir a Inicio</span>
          </Button>
          <div>
            <h1 className="text-2xl font-headline font-bold">Configurar Examen</h1>
            <p className="text-sm text-primary-foreground/80">Crea una nueva sala de monitoreo para un examen.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserNav />
        </div>
      </header>
      <main className="p-4 md:p-6 lg:p-8 flex-1 flex justify-center items-start">
        <Card className="w-full max-w-2xl shadow-lg">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                    <Layers className="h-6 w-6 text-primary" />
                    Nueva Sala de Monitoreo
                </CardTitle>
                <CardDescription className="dark:text-gray-300">
                  Define los detalles del examen para generar una sala de monitoreo única para tus estudiantes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="exam-title" className="text-foreground dark:text-white">Título del Examen</Label>
                  <Input
                    id="exam-title"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Ej: Fundamentos de Programación - Parcial 1"
                    required
                  />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-foreground dark:text-white">Nombre de la Asignatura</Label>
                      <Input
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Ej: Programación Avanzada"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="section" className="text-foreground dark:text-white">Sección</Label>
                      <Input
                        id="section"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        placeholder="Ej: PROG401-001D"
                        required
                      />
                    </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration" className="text-foreground dark:text-white">Duración (en minutos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    required
                    min="10"
                    max="240"
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="access-code" className="text-foreground dark:text-white">Código de Acceso para Estudiantes</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="access-code"
                      value={accessCode}
                      readOnly
                      className="font-mono text-lg bg-muted"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={handleCopyCode} aria-label="Copiar código">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                   <p className="text-xs text-muted-foreground dark:text-gray-300">
                    Los estudiantes usarán este código para unirse a la sesión de monitoreo correcta.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading || !examTitle || !subject || !section || !duration || !user || userProfile?.role !== 'instructor'}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando sala...</> : 'Crear Sala de Examen'}
                </Button>
              </CardFooter>
            </form>
        </Card>
      </main>
    </div>
  );
}

    