
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [selectedPortal, setSelectedPortal] = useState<
    "student" | "instructor" | null
  >(null);
  const router = useRouter();

  const handleCardClick = (portal: "student" | "instructor") => {
    console.log('[HomePage] Seleccionando portal:', portal);
    setSelectedPortal(portal);
  };

  const handleSiguiente = () => {
    console.log('[HomePage] ========== CLICK EN SIGUIENTE ==========');
    console.log('[HomePage] selectedPortal actual:', selectedPortal);
    console.log('[HomePage] Navegando según portal:', selectedPortal);
    
    if (selectedPortal === "student") {
      console.log('[HomePage] Navegando a /student/login');
      router.push("/student/login");
    } else if (selectedPortal === "instructor") {
      console.log('[HomePage] Navegando a /instructor/login');
      router.push("/instructor/login");
    } else {
      console.log('[HomePage] No hay portal seleccionado!');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8 py-6 relative overflow-hidden">
      {/* Fondo con imagen personalizada de Gabriela Mistral */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('/Fondo Plataforma.png')`,
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundColor: "#00d4ff", // Color de respaldo si la imagen no carga
        }}
      />

      {/* Overlay para mejorar legibilidad del texto */}
      <div className="absolute inset-0 bg-black/20"></div>

      {/* Header con logo y título */}
      <div className="text-center mb-8 relative z-10">
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-[#242F62]">Procto</span>
          <span className="text-white">Team</span>
        </h1>
        <p className="text-[#242F62] text-lg font-medium">Sistema de Vigilancia de Exámenes en Línea</p>
      </div>

      {/* Pregunta principal */}
      <div className="text-center mb-6 relative z-10">
        <h2 className="text-xl font-semibold text-[#242F62]">
          ¿Cómo deseas ingresar?
        </h2>
      </div>

      {/* Cards de selección */}
      <div className="flex gap-6 mb-8 max-w-4xl relative z-10">
        {/* Portal de Estudiante */}
        <Card 
          className={cn(
            "w-72 bg-card/95 backdrop-blur-sm hover:bg-card transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer relative",
            selectedPortal === "student" && "ring-2 ring-blue-500 bg-card"
          )}
          onClick={() => handleCardClick("student")}
        >
          {/* Checkmark */}
          {selectedPortal === "student" && (
            <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}

          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-[#1a1d47] rounded-full flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Portal de estudiante
            </h3>
            <p className="text-sm text-blue-600 font-medium mb-4">
              Accede para rendir tu examen
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ingresa con tus credenciales para realizar tus exámenes en línea de forma segura y monitoreada.
            </p>
          </CardContent>
        </Card>

        {/* Panel del Docente */}
        <Card 
          className={cn(
            "w-72 bg-card/95 backdrop-blur-sm hover:bg-card transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer relative",
            selectedPortal === "instructor" && "ring-2 ring-blue-500 bg-card"
          )}
          onClick={() => handleCardClick("instructor")}
        >
          {/* Checkmark */}
          {selectedPortal === "instructor" && (
            <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}

          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Panel del Docente
            </h3>
            <p className="text-sm text-blue-600 font-medium mb-4">
              Configura y supervisa los exámenes
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Supervisa y gestiona los exámenes en tiempo real, con herramientas de vigilancia y seguimiento.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Botón Siguiente */}
      <div className="text-center relative z-10 mb-8">
        <button 
          onClick={(e) => {
            console.log('[HomePage] onClick ejecutado en button nativo!');
            e.preventDefault();
            handleSiguiente();
          }}
          className={cn(
            "bg-[#1a1d47] hover:bg-[#242f62] text-white px-8 py-3 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center justify-center",
            !selectedPortal && "opacity-50 cursor-not-allowed"
          )}
          disabled={!selectedPortal}
          type="button"
        >
          Siguiente →
        </button>
        
        {/* Botón alternativo de prueba - SIEMPRE ACTIVO */}
        <div className="mt-4">
          <button
            onClick={() => {
              console.log('[HomePage] TEST BUTTON - Navegando DIRECTO a /student/login');
              router.push('/student/login');
            }}
            className="bg-green-500 text-white px-4 py-2 rounded"
            type="button"
          >
            TEST: Ir directo a Student Login
          </button>
        </div>
        
        {/* Debug: Mostrar estado actual */}
        <div className="mt-2 text-sm text-gray-600">
          Portal seleccionado: {selectedPortal || 'ninguno'}
        </div>
      </div>

      {/* Footer */}
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
