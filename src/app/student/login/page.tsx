"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/azure-auth'; // Asegúrate de tener esta función exportada
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, GraduationCap, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function StudentLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // 🛑 CRÍTICO: Prevenir el comportamiento por defecto (refresh)
    e.preventDefault();

    if (isLoading) return;
    setIsLoading(true);

    try {
      // Iniciar el popup de MSAL
      await signIn(); 
      // Si el login es exitoso, el AuthContext detectará el evento 'loginSuccess'
      // y redirigirá automáticamente, o podemos forzarlo aquí:
      router.push('/student');
    } catch (error) {
      console.error("Error en login:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-section relative overflow-hidden">
      {/* Fondo decorativo igual que home */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#161F45] to-[#242F62]" />

      <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl relative z-10 border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-[#e6f9ff] p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
            <GraduationCap className="w-10 h-10 text-[#00d4ff]" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#161F45]">Portal Estudiante</CardTitle>
          <CardDescription>Ingresa con tu cuenta institucional UGM</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col items-center gap-4">
             {/* Logo de Microsoft para dar contexto */}
             <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <span>Autenticación segura vía</span>
                <Image src="/microsoft-logo.png" alt="Microsoft" width={20} height={20} className="w-5 h-5"/> 
                <span className="font-semibold">Azure AD</span>
             </div>

             {/* BOTÓN CORREGIDO */}
             <Button 
                onClick={handleLogin}
                type="button" // 🛑 IMPORTANTE: Evita submit del formulario
                className="w-full bg-[#2F2F2F] hover:bg-[#1a1a1a] text-white h-12 text-lg font-medium shadow-md transition-all hover:scale-[1.02]"
                disabled={isLoading}
             >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Conectando...
                  </>
                ) : (
                  "Iniciar Sesión con Microsoft"
                )}
             </Button>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center border-t pt-6">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-[#161F45]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al inicio
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}