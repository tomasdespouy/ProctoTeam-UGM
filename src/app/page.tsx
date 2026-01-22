"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';
import { signInWithAzurePopup, signInWithAzureRedirect } from '@/lib/azure-auth';
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-[#242F62] mb-2">
            Bienvenido
          </h2>
          <p className="text-gray-600 text-sm">
            Ingresa con tu cuenta institucional UGM. El sistema detectará automáticamente si eres estudiante o docente.
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

        <div className="mt-4 text-center text-xs text-gray-500">
          <p>Autenticación segura vía Microsoft Azure AD</p>
        </div>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm text-white py-3 z-10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm opacity-70">
            Universidad Gabriela Mistral - 2025. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
