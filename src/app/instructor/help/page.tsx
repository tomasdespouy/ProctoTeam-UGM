
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/auth-context';
import { BookOpen, LogOut } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { HelpCircle, Sparkles, Send, Loader2, Monitor, History, Users } from 'lucide-react';
import { askProctorHelp } from '@/ai/flows/proctor-help-flow';
import { ThemeToggle } from '@/components/theme-toggle';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const formSchema = z.object({
  query: z.string().min(10, {
    message: "Por favor, ingresa una pregunta de al menos 10 caracteres.",
  }),
});

export default function HelpPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setAiResponse(null);
    try {
      const result = await askProctorHelp({ query: values.query });
      setAiResponse(result.answer);
    } catch (error) {
      console.error("Error asking for help:", error);
      toast({
        variant: "destructive",
        title: "Error del Asistente de IA",
        description: "No se pudo obtener una respuesta. Por favor, inténtalo de nuevo más tarde.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-section">
      <header style={{ backgroundColor: "#161F45" }} className="border-b border-white/20">
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
                  <p className="text-xs text-white/70">Centro de Ayuda</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Switch de tema */}
              <ThemeToggle />

              {/* Nombre del usuario */}
              <span className="text-white text-sm font-medium">
                {userProfile?.nombre || "Instructor"}
              </span>


              {/* Botón de cerrar sesión */}
              <Button
                className="bg-[#242F62] hover:bg-[#1a1d47] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium border-0"
                onClick={async () => {
                  const { signOut } = await import("firebase/auth");
                  const { auth } = await import("@/lib/firebase");
                  await signOut(auth);
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
      
      {/* Sección de navegación */}
      <div className="py-4 bg-container">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                className="bg-card hover:bg-card/80 text-foreground border border-border flex items-center gap-2 text-sm font-semibold"
                onClick={() => router.push('/instructor')}
              >
                <Monitor className="w-4 h-4" />
                Empezar monitoreo
              </Button>

              <Button
                className="bg-card hover:bg-card/80 text-foreground border border-border flex items-center gap-2 text-sm font-semibold"
                onClick={() => router.push('/instructor/live-monitor')}
              >
                <Users className="w-4 h-4" />
                Monitor en vivo
              </Button>

              <Button
                className="bg-card hover:bg-card/80 text-foreground border border-border flex items-center gap-2 text-sm font-semibold"
                onClick={() => router.push('/instructor/historic')}
              >
                <History className="w-4 h-4" />
                Histórico
              </Button>
            </div>

            <Button
              className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 text-sm font-semibold"
            >
              <HelpCircle className="w-4 h-4" />
              Ayuda
            </Button>
          </div>
        </div>
      </div>
      
      <main className="flex-1 bg-gray-100 dark:bg-gray-900 p-8">
        {/* Título principal - alineado a la izquierda de toda la página */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Asistente de IA para Docentes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            ¿Tienes alguna duda sobre el proceso? Escribe a nuestro asistente de IA para que te ayude.
          </p>
        </div>
        
        <div className="max-w-2xl mx-auto">
          {/* Card principal */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
            {/* Imagen de profesores */}
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center">
                <Image
                  src="/Profesores.png"
                  alt="Profesores asistentes"
                  width={128}
                  height={128}
                  className="object-cover w-full h-full object-top"
                />
              </div>
            </div>

            {/* Título del formulario */}
            <h2 className="text-lg font-semibold text-center text-gray-900 dark:text-white mb-6">
              Preguntar a nuestros Asistentes
            </h2>

            {/* Formulario */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="¿Cómo puedo unirme a un examen?"
                          {...field}
                          className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-center">
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
                    ) : (
                      <>Preguntar</>
                    )}
                  </Button>
                </div>
              </form>
            </Form>

            {isLoading && (
              <div className="mt-6 flex items-center justify-center text-gray-600 dark:text-gray-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span>El asistente está pensando...</span>
              </div>
            )}
          </div>

          {/* Sección de respuestas */}
          {aiResponse && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Respuestas del Asistente
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p style={{ whiteSpace: 'pre-wrap' }} className="text-gray-800 dark:text-gray-200">
                    {aiResponse}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
