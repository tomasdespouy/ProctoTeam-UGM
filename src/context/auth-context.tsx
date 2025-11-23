'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AccountInfo } from '@azure/msal-browser';
import { initializeMsal, getMsalInstance, acquireTokenSilent } from '@/lib/azure-auth';
import { useRouter, usePathname } from 'next/navigation';

export interface UserProfile {
  id: string;
  uid: string;
  nombre: string;
  correo: string;
  role: 'student' | 'instructor' | 'super-admin';
  photoURL?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

interface MsalUser {
  account: AccountInfo;
  getIdToken: () => Promise<string | null>;
}

interface AuthContextType {
  user: MsalUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<MsalUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log("🔐 AuthContext: Iniciando...");
        await initializeMsal();
        const msalInstance = getMsalInstance();

        // --- CORRECCIÓN CRÍTICA AQUÍ ---
        // Intentamos obtener la cuenta activa
        let account = msalInstance.getActiveAccount();

        // Si es null, buscamos si hay alguna cuenta en caché y activamos la primera
        if (!account) {
            const allAccounts = msalInstance.getAllAccounts();
            if (allAccounts.length > 0) {
                console.log("⚠️ No hay cuenta activa, pero se encontraron cuentas en caché. Activando la primera...");
                msalInstance.setActiveAccount(allAccounts[0]);
                account = allAccounts[0];
            }
        }
        // -------------------------------

        if (account) {
          console.log("✅ Usuario detectado:", account.username);
          const msalUser: MsalUser = {
            account,
            getIdToken: acquireTokenSilent,
          };

          const uid = account.localAccountId;
          // Log para confirmar que vamos a llamar a la API
          console.log(`📡 Llamando a API get-user con UID: ${uid}`);

          const response = await fetch(`/api/auth/get-user?uid=${uid}`);

          if (response.ok) {
            const profileData = await response.json();

            if (profileData) {
              console.log("👤 Perfil encontrado en DB");
              setUserProfile({
                id: profileData.id,
                uid: profileData.uid,
                nombre: profileData.nombre,
                correo: profileData.email,
                role: profileData.role,
                photoURL: profileData.photo_url,
                created_at: profileData.created_at ? new Date(profileData.created_at) : undefined,
                updated_at: profileData.updated_at ? new Date(profileData.updated_at) : undefined,
              });
            } else {
              console.log("🆕 Usuario nuevo - Creando perfil...");
              const createResponse = await fetch('/api/auth/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uid: uid,
                  email: account.username || '',
                  nombre: account.name || account.username?.split('@')[0] || 'Usuario',
                  role: 'student', // OJO: Aquí podrías ajustar lógica si quieres roles dinámicos
                  photo_url: null,
                }),
              });

              if (createResponse.ok) {
                const newProfile = await createResponse.json();
                setUserProfile({
                  id: newProfile.id,
                  uid: newProfile.uid,
                  nombre: newProfile.nombre,
                  correo: newProfile.email,
                  role: newProfile.role,
                  photoURL: newProfile.photo_url,
                  created_at: newProfile.created_at ? new Date(newProfile.created_at) : undefined,
                  updated_at: newProfile.updated_at ? new Date(newProfile.updated_at) : undefined,
                });
              } else {
                console.error('❌ Falló la creación del usuario');
                setUserProfile(null);
              }
            }
          } else {
            console.error('❌ Error API get-user:', response.status);
            setUserProfile(null);
          }

          setUser(msalUser);
        } else {
          console.log("⚪ No hay usuario logueado.");
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('💥 Error fatal en initAuth:', error);
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const msalInstance = getMsalInstance();
    const callbackId = msalInstance.addEventCallback((event: any) => {
      // Si el login es exitoso, volvemos a ejecutar initAuth para capturar la cuenta
      if (event.eventType === 'msal:loginSuccess' || event.eventType === 'msal:acquireTokenSuccess') {
        const account = event.payload.account;
        if (account) {
            msalInstance.setActiveAccount(account); // Asegurar que se active al recibir evento
        }
        initAuth();
      } else if (event.eventType === 'msal:logoutSuccess') {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => {
      if (callbackId) {
        msalInstance.removeEventCallback(callbackId);
      }
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const publicPaths = ['/', '/student/login', '/instructor/login', '/auth/callback'];
    const isPublicPath = publicPaths.includes(pathname);

    if (!user && !isPublicPath) {
      const loginPath = pathname.startsWith('/instructor') || pathname.startsWith('/super-admin') 
        ? '/instructor/login' 
        : '/student/login';
      router.push(loginPath);
    }
  }, [user, pathname, loading, router]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};