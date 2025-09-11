"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User } from "lucide-react";
import Image from "next/image";

export default function StudentLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data().role === "student") {
        router.push("/student");
      } else {
        await signOut(auth);
        toast({
          variant: "destructive",
          title: "Acceso incorrecto",
          description:
            "Esta cuenta no es de un estudiante o tiene un rol de docente. Por favor, usa el portal del docente si corresponde.",
        });
      }
    } catch (error: any) {
      let errorMessage = "Ocurrió un error inesperado.";
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        errorMessage =
          "Credenciales incorrectas. Por favor, verifica tu correo y contraseña.";
      }
      toast({
        variant: "destructive",
        title: "Error de autenticación",
        description: errorMessage,
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
            width: "100%", // Ancho al 80%
            height: "100%", // Alto al 80%
            filter: "brightness(0.9) contrast(1.1)", // Ajuste más suave
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

          {/* Título del formulario */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-[#242F62]" />
              </div>
              <h1 className="text-white text-xl font-bold">Iniciar Sesión</h1>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-white text-sm mb-2 block">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder=""
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-0 bg-white text-gray-800 placeholder-gray-500"
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="text-white text-sm mb-2 block"
              >
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-0 bg-white text-gray-800"
              />
            </div>

            <div className="text-left">
              <a href="#" className="text-[#00BFFF] text-sm hover:underline">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <Button
              className="w-full bg-[#00BFFF] hover:bg-[#0099CC] text-white py-3 rounded-lg font-semibold text-lg transition-colors"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar a la plataforma"
              )}
            </Button>
          </form>
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
            Estudiante
          </h2>
          <p className="text-[#2B3A67] text-base">Accede para rendir tu examen</p>
        </div>

        {/* Placeholder para las ilustraciones de estudiantes */}
        <div className="relative flex-1 flex items-center justify-center max-h-[65vh]">
          {/* Estudiante principal con laptop - Aumentado al doble y adaptado al viewport */}
          <div className="relative z-10 bg-[#00BFFF] rounded-full p-8">
            <div className="w-96 h-96 max-w-[45vw] max-h-[45vh] bg-white/20 rounded-full flex items-center justify-center">
              <Image
                src="/Estudiante.png"
                alt="Estudiante"
                width={600}
                height={600}
                className="object-contain"
              />
            </div>
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-[#1a1d47]/20 rounded-full"></div>
            <div className="absolute -bottom-3 -left-3 w-16 h-16 bg-white/30 rounded-full"></div>
          </div>

          {/* Imagen del profesor y profesora eliminadas */}

        </div>
      </div>
    </main>
  );
}