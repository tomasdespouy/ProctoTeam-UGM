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
        await initializeMsal();
        const msalInstance = getMsalInstance();
        let account = msalInstance.getActiveAccount();

        if (!account) {
            const allAccounts = msalInstance.getAllAccounts();
            if (allAccounts.length > 0) {
                msalInstance.setActiveAccount(allAccounts[0]);
                account = allAccounts[0];
            }
        }

        if (account) {
          // Función reutilizable para obtener el ID Token
          const getIdTokenFn = async (): Promise<string | null> => {
            try {
              const response = await msalInstance.acquireTokenSilent({
                account: account,
                scopes: ["User.Read", "openid", "profile", "email"]
              });
              return response.idToken; // Usamos idToken, no accessToken
            } catch (err) {
              console.warn("No se pudo obtener token silencioso", err);
              return null;
            }
          };

          // Obtener token inicial para sincronizar usuario
          const token = await getIdTokenFn();

          const msalUser: MsalUser = {
            account,
            getIdToken: getIdTokenFn, // Función que obtiene token fresco cada vez
          };

          // 2. Llamar al Backend (PostgreSQL) para sincronizar usuario
          if (token) {
              try {
                  const response = await fetch('/api/auth/get-user', {
                      method: 'GET',
                      headers: {
                          'Authorization': `Bearer ${token}`
                      }
                  });

                  if (response.ok) {
                      const data = await response.json();
                      if (data.user) {
                          console.log("✅ Usuario sincronizado con Postgres:", data.user.role);
                          setUserProfile({
                              id: data.user.id,
                              uid: data.user.uid,
                              nombre: data.user.nombre,
                              correo: data.user.email,
                              role: data.user.role,
                              photoURL: data.user.photo_url,
                              created_at: data.user.created_at,
                              updated_at: data.user.updated_at
                          });
                      }
                  } else {
                      console.error("Error al sincronizar con backend:", response.status);
                  }
              } catch (backendError) {
                  console.error("Error de conexión con API:", backendError);
              }
          }

          setUser(msalUser);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Error en initAuth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const msalInstance = getMsalInstance();
    // Listener para cuando el login popup termina exitosamente
    const callbackId = msalInstance.addEventCallback((event: any) => {
      if (event.eventType === 'msal:loginSuccess') {
        const account = event.payload.account;
        msalInstance.setActiveAccount(account);
        initAuth(); // Recargar perfil
      } else if (event.eventType === 'msal:logoutSuccess') {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => {
      if (callbackId) msalInstance.removeEventCallback(callbackId);
    };
  }, []);

  // Protección de rutas
  useEffect(() => {
    if (loading) return;
    const publicPaths = ['/', '/student/login', '/instructor/login', '/auth/callback'];

    // Permitir acceso si es ruta pública o si el usuario está logueado
    if (!user && !publicPaths.includes(pathname)) {
       // Redirección inteligente
       if (pathname.includes('instructor')) router.push('/instructor/login');
       else router.push('/student/login');
    }
  }, [user, pathname, loading, router]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};