"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  KeyRound,
  History,
  Calendar,
  LogOut,
  HelpCircle,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

export default function StudentHomePage() {
  const { user, userProfile, loading } = useAuth();
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isModalOpen]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── ALL ORIGINAL LOGIC UNTOUCHED ─────────────────────────────────────────
  const handleJoinExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !accessCode.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/exam-sessions/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({ accessCode: accessCode.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al unirse al examen');
      }

      toast({
        title: "¡Éxito!",
        description: `Uniéndote a: ${data.title || 'Examen'}`,
      });

      setIsModalOpen(false);
      setAccessCode("");

      router.push(`/student/exam/${data.examId}`);

    } catch (error: any) {
      console.error("Error joining exam session: ", error);
      toast({
        variant: "destructive",
        title: "No se pudo ingresar",
        description: error.message || "Verifica el código e inténtalo de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#00BBFF]" />
      </div>
    );
  }

  const firstName = userProfile?.nombre
    ? userProfile.nombre.split(' ')[0]
    : (user?.email?.split('@')[0] ?? '');

  const today = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen flex bg-gray-100">

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-[200px] flex flex-col z-30"
        style={{ background: '#1A1D47' }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-8">
          <h1 className="text-xl font-black leading-none">
            <span className="text-[#00BBFF]">Procto</span>
            <span className="text-white">Team</span>
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6B5BCD 0%, #4A5BC8 100%)',
            }}
          >
            <KeyRound className="h-4 w-4 flex-shrink-0" />
            <span>Unirse a un examen</span>
          </button>

          <button
            onClick={() => router.push("/student/historic")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <History className="h-4 w-4 flex-shrink-0" />
            <span>Histórico</span>
          </button>

          <button
            onClick={() => router.push("/student/help")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <HelpCircle className="h-4 w-4 flex-shrink-0" />
            <span>Ayuda</span>
          </button>
        </nav>

        {/* Bottom: Salir */}
        <div className="px-4 py-5 border-t border-white/10">
          <button
            onClick={async () => {
              const { signOut } = await import("@/lib/azure-auth");
              await signOut();
              router.push("/");
            }}
            className="w-full flex items-center justify-between text-white/60 hover:text-white transition-colors text-sm font-medium"
          >
            <span>Salir</span>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────── */}
      <div className="ml-[200px] flex-1 flex flex-col min-h-screen">

        {/* Top header bar */}
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 sticky top-0 z-20">
          <h2 className="font-bold text-[#1A1D47] text-base">
            Portal de estudiante
          </h2>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: '#1A1D47' }}
              title={userProfile?.correo ?? user?.email ?? ''}
            >
              {firstName ? firstName[0].toUpperCase() : <User className="h-4 w-4" />}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 space-y-6">

          {/* Welcome Hero Banner */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(110deg, #00BBFF 0%, #0077CC 100%)',
              minHeight: '150px',
            }}
          >
            <div className="relative z-10 p-6 pr-[240px]">
              <div className="flex items-center gap-1.5 text-white/80 text-sm mb-3 font-medium">
                <Calendar className="h-4 w-4" />
                <span>{today}</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Bienvenid@ {firstName}
              </h2>
              <p className="text-white/90 text-sm font-light">
                Al Portal del Estudiante Proctor UGM
              </p>
            </div>

            {/* Paper plane decorative */}
            <div className="absolute top-1/2 left-[45%] -translate-y-1/2 opacity-30 pointer-events-none">
              <svg viewBox="0 0 40 40" className="w-12 h-12 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 20L38 4L26 38L18 24L2 20ZM18 24L24 18" strokeLinecap="round"/>
              </svg>
            </div>

            {/* Decorative purple circle */}
            <div
              className="absolute right-16 top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{ width: '140px', height: '140px', background: 'rgba(90,60,180,0.35)' }}
            />

            {/* Characters image */}
            <div className="absolute right-0 bottom-0 h-full flex items-end pointer-events-none" style={{ width: '230px' }}>
              <Image
                src="/Profesores.png"
                alt="Estudiantes UGM"
                width={230}
                height={150}
                className="object-contain object-bottom"
                style={{ maxHeight: '160px', width: 'auto' }}
                priority
              />
            </div>
          </div>

          {/* ── CTA: open join-exam modal ─────────────────────────────────── */}
          <div className="flex justify-center pt-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-3 px-8 py-3.5 rounded-2xl text-white font-semibold text-base shadow-lg transition-all hover:scale-105 active:scale-100"
              style={{
                background: 'linear-gradient(135deg, #6B5BCD 0%, #4A70D8 100%)',
                boxShadow: '0 4px 20px rgba(75,80,200,0.35)',
              }}
            >
              <KeyRound className="h-5 w-5" />
              Unirse a un examen
            </button>
          </div>
        </main>
      </div>

      {/* ── CUSTOM CYAN-BLUR MODAL OVERLAY ────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setIsModalOpen(false)}
        >
          {/* Blur + cyan gradient overlay — matches Figma screenshot */}
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              background: 'linear-gradient(135deg, rgba(0,140,220,0.55) 0%, rgba(90,80,200,0.45) 100%)',
            }}
          />

          {/* Modal card */}
          <div
            className="relative z-10 bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleJoinExam}>
              <div className="p-6 space-y-5">
                {/* Header */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="h-5 w-5 text-[#5B5ECD]" />
                    <h3 className="text-lg font-bold text-[#1A1D47]">
                      Unirse a un examen
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-snug">
                    Ingresa el código de acceso proporcionado por tu docente para comenzar la sesión de monitoreo.
                  </p>
                </div>

                {/* Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="modal-access-code" className="text-[#1A1D47] font-medium text-sm">
                    Código de Acceso:
                  </Label>
                  <Input
                    ref={inputRef}
                    id="modal-access-code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder=""
                    required
                    className="font-mono text-base tracking-widest text-[#1A1D47] border-gray-300 focus:border-[#5B5ECD] focus:ring-[#5B5ECD]"
                  />
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  className="w-full h-11 text-white font-semibold rounded-full text-base"
                  style={{ background: '#1A1D47' }}
                  disabled={isLoading || !accessCode.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Unirse al Examen'
                  )}
                </Button>
              </div>

              {/* Bottom cyan accent bar */}
              <div className="h-1.5 w-full" style={{ background: '#00BBFF' }} />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
