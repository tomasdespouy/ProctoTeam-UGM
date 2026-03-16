'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Copy, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ConfigureExamPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [accessCode, setAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setAccessCode(result);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/exam-sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ title, subject, section, duration, accessCode }),
      });
      if (!response.ok) throw new Error('Error al crear la sesión de examen');
      toast({ title: 'Examen Creado', description: 'La sala ha sido configurada correctamente.' });
      router.push('/instructor');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la configuración. Intenta nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 gap-1.5 text-gray-600 hover:text-gray-900 -ml-2"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <Card className="shadow-lg border-t-4 border-t-[#00d4ff]">
        <CardHeader>
          <CardTitle>Configurar Nuevo Examen</CardTitle>
          <CardDescription>
            Completa los parámetros básicos. El código de acceso se genera automáticamente.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">

            <div className="space-y-2">
              <Label htmlFor="title">Título del Examen</Label>
              <Input
                id="title"
                placeholder="Ej: Evaluación Solemne 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Asignatura</Label>
                <Input
                  id="subject"
                  placeholder="Ej: Cálculo I"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Sección / Grupo</Label>
                <Input
                  id="section"
                  placeholder="Ej: 004D"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duración (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Código de Acceso</Label>
                <div className="flex gap-2">
                  <Input
                    value={accessCode}
                    readOnly
                    className="font-mono text-center text-lg tracking-widest bg-muted font-bold text-primary"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(accessCode);
                      toast({ description: 'Código copiado al portapapeles' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Comparte este código con tus alumnos.
                </p>
              </div>
            </div>

          </CardContent>
          <CardFooter className="flex justify-end gap-2 bg-muted/20 p-6">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#00d4ff] text-[#161F45] hover:bg-[#00b8e6] font-bold"
            >
              {isSubmitting
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Save className="mr-2 h-4 w-4" />}
              Crear Sesión
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
