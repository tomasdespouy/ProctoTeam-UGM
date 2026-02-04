"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LogIn, Bug, GraduationCap, BookOpen } from 'lucide-react';
import { signInWithAzurePopup, signInWithAzureRedirect } from '@/lib/azure-auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserProfile } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

const SHOW_DEV_LOGIN = process.env.NEXT_PUBLIC_SHOW_DEV_LOGIN === 'true';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const { toast } = useToast();
  const { setDevUser } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const result = await signInWithAzurePopup();

      if (result.error) {
        console.warn("Popup falló, intentando redirección...", result.error);
        await signInWithAzureRedirect();
      }
    } catch (error) {
      console.error("Error en login:", error);
      toast({
        variant: "destructive",
        title: "Error de conexión",
        description: "No se pudo iniciar sesión con Microsoft.",
      });
      setIsLoading(false);
    }
  };

  const handleDevLogin = async (email: string) => {
    if (devLoading) return;
    setDevLoading(true);

    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en dev login');
      }

      const profile: UserProfile = {
        id: data.user.id,
        uid: data.user.uid,
        nombre: data.user.nombre,
        correo: data.user.email,
        role: data.user.role,
        photoURL: data.user.photo_url,
      };

      setDevUser(profile);

      toast({
        title: "Dev Login exitoso",
        description: `Entrando como ${profile.role}: ${profile.correo}`,
      });

      if (profile.role === 'student') {
        router.push('/student');
      } else {
        router.push('/instructor');
      }
    } catch (error: any) {
      console.error("Error en dev login:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo iniciar sesión de desarrollo.",
      });
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8 py-6 relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('/Fondo Plataforma.png')`,
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundColor: "#00d4ff",
        }}
      />

      <div className="absolute inset-0 bg-black/20"></div>

      <div className="text-center mb-8 relative z-10">
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-[#242F62]">Procto</span>
          <span className="text-white">Team</span>
        </h1>
        <p className="text-[#242F62] text-lg font-medium">Sistema de Vigilancia de Exámenes en Línea</p>
      </div>

      <div className="bg-white border-2 border-[#00BBFF] rounded-[15px] shadow-[0px_3px_10px_2px_rgba(0,0,0,0.27)] p-8 max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="bg-[#D9D9D9] rounded-full p-4 w-24 h-24 flex items-center justify-center relative">
              <LogIn className="h-12 w-12 text-[#242F62]" />
              <div className="absolute top-0 right-0">
                <div className="bg-[#4CAF50] rounded-full p-1 border-2 border-white">
                  <div className="h-2 w-2 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
          <h2 className="text-[22px] font-extrabold text-[#242F62] mb-1">
            Portal de estudiante
          </h2>
          <p className="text-[#242F62] text-base mb-4">
            Accede para rendir tu examen
          </p>
          <div className="w-full h-px bg-[#D9D9D9] mb-6"></div>
          <p className="text-[#242F62] text-sm leading-relaxed mb-6 italic">
            Para ingresar a la plataforma, utiliza tus credenciales institucionales de la Universidad Gabriela Mistral.
          </p>
        </div>

        <Button 
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-[#1a1d47] hover:bg-[#242f62] text-white h-14 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-5 w-5" />
              Ingresar a la Plataforma
            </>
          )}
        </Button>
      </div>

      {SHOW_DEV_LOGIN && (
        <div className="mt-6 bg-amber-50 border-2 border-amber-400 rounded-xl p-4 max-w-md w-full relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Bug className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Modo Desarrollo</h3>
          </div>
          
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email de prueba..."
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              className="bg-white border-amber-300 focus:border-amber-500"
            />
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDevEmail('test@estudiante.ugm.cl');
                  handleDevLogin('test@estudiante.ugm.cl');
                }}
                disabled={devLoading}
                className="flex-1 border-blue-400 text-blue-700 hover:bg-blue-50"
              >
                <GraduationCap className="h-4 w-4 mr-1" />
                Estudiante
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDevEmail('test@ugm.cl');
                  handleDevLogin('test@ugm.cl');
                }}
                disabled={devLoading}
                className="flex-1 border-green-400 text-green-700 hover:bg-green-50"
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Instructor
              </Button>
            </div>
            
            <Button
              onClick={() => handleDevLogin(devEmail)}
              disabled={devLoading || !devEmail}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            >
              {devLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar con email personalizado'
              )}
            </Button>
          </div>
        </div>
      )}

      <footer className="absolute bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm text-white py-3 z-10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm opacity-70">
            Universidad Gabriela Mistral - 2026. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
