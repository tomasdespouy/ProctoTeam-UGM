"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signInWithAzurePopup, handleAzureRedirectResult } from "@/lib/azure-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2 } from "lucide-react";
import Image from "next/image";

export default function InstructorLoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Verificar si venimos de un redirect de Azure
  useEffect(() => {
    const checkRedirect = async () => {
      const { user, error } = await handleAzureRedirectResult();
      if (user) {
        await verifyAndRedirect(user);
      } else if (error) {
        toast({
          variant: "destructive",
          title: "Error de autenticación",
          description: "No se pudo completar el inicio de sesión con SSO.",
        });
      }
    };
    checkRedirect();
  }, []);

  const verifyAndRedirect = async (user: any) => {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userRole = userDocSnap.data().role;
        if (userRole === "instructor") {
          router.push("/instructor");
        } else if (userRole === "super-admin") {
          router.push("/super-admin/dashboard");
        } else {
          await signOut(auth);
          toast({
            variant: "destructive",
            title: "Acceso denegado",
            description: "Esta cuenta no tiene permisos de docente o administrador.",
          });
        }
      } else {
        await signOut(auth);
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "No se encontró información de usuario.",
        });
      }
    } catch (error) {
      console.error("Error verificando usuario:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo verificar tu cuenta.",
      });
    }
  };

  const handleSSOLogin = async () => {
    setLoading(true);
    try {
      const { user, error } = await signInWithAzurePopup();
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Error de autenticación",
          description: "No se pudo conectar con el sistema SSO de la UGM.",
        });
        setLoading(false);
        return;
      }

      if (user) {
        await verifyAndRedirect(user);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de autenticación",
        description: "Ocurrió un error al intentar iniciar sesión.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-screen flex overflow-hidden">
      {/* Lado izquierdo - Formulario de Login */}
      <div
        className="flex-1 flex flex-col justify-center items-center p-8 relative overflow-hidden"
        style={{
          backgroundColor: "#242F62",
        }}
      >
        {/* Imagen PNG al 80% con ajustes de visibilidad */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundImage: `url('/UGM.png')`,
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            width: "100%",
            height: "100%",
            filter: "brightness(0.9) contrast(1.1)",
          }}
        ></div>

        {/* Overlay más suave para mejor visibilidad */}
        <div className="absolute inset-0 bg-[#242F62] bg-opacity-40"></div>

        <div className="w-full max-w-md relative z-10">
          {/* Logo de la Universidad */}
          <div className="flex items-center justify-start mb-8">
            <Image
              src="/Logo lineas.png"
              alt="Universidad Gabriela Mistral"
              width={160}
              height={54}
              className="object-contain"
            />
          </div>

          {/* Título */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[#242F62]" />
              </div>
              <h1 className="text-white text-xl font-bold">Iniciar Sesión</h1>
            </div>
            <p className="text-white/80 text-sm">
              Portal del Docente - Universidad Gabriela Mistral
            </p>
          </div>

          {/* Botón SSO de Azure */}
          <div className="space-y-6">
            <div className="bg-white/10 border border-white/20 rounded-lg p-6 mb-6">
              <p className="text-white/90 text-sm mb-4 text-center">
                Inicia sesión con tu cuenta institucional de la UGM
              </p>
              <Button
                onClick={handleSSOLogin}
                className="w-full bg-white hover:bg-gray-100 text-[#242F62] py-4 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-3 shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Conectando con SSO...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="h-5 w-5" />
                    <span>Iniciar Sesión con UGM</span>
                  </>
                )}
              </Button>
            </div>

            <div className="text-center">
              <p className="text-white/60 text-xs">
                ¿Problemas para acceder? Contacta a soporte técnico
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lado derecho - Área visual */}
      <div className="flex-1 bg-[#00BFFF] flex flex-col items-center p-6 relative">
        {/* Contenido del lado derecho - Movido al tope */}
        <div className="text-center mb-3 mt-2">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-[#2B3A67]">Procto</span>
            <span className="text-white">Team</span>
          </h1>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-[#2B3A67] text-4xl font-bold mb-3">
            Portal del
            <br />
            Docente
          </h2>
          <p className="text-[#2B3A67] text-base">
            Accede para supervisar exámenes
          </p>
        </div>

        {/* Placeholder para las ilustraciones - Adaptado para instructor */}
        <div className="relative flex-1 flex items-center justify-center max-h-[65vh]">
          {/* Imagen principal - profesor supervisando */}
          <div className="relative z-10 bg-[#00BFFF] rounded-full p-8">
            <div className="w-72 h-72 bg-white/20 rounded-full flex items-center justify-center">
              <Image
                src="/Profesores.png"
                alt="Profesor"
                width={500}
                height={500}
                className="object-contain"
              />
            </div>
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-[#1a1d47]/20 rounded-full"></div>
            <div className="absolute -bottom-3 -left-3 w-16 h-16 bg-white/30 rounded-full"></div>
          </div>
        </div>
      </div>
    </main>
  );
}
