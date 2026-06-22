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

export interface MsalUser {
  account: AccountInfo;
  getIdToken: () => Promise<string | null>;
}

interface AuthContextType {
  user: MsalUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  setDevUser: (profile: UserProfile | null, devToken?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  setDevUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

const DEV_USER_KEY = 'dev_user_profile';
const DEV_TOKEN_KEY = 'dev_token';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<MsalUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const setDevUser = (profile: UserProfile | null, devToken?: string) => {
    if (profile) {
      sessionStorage.setItem(DEV_USER_KEY, JSON.stringify(profile));
      // Persist the JWT so it survives page refreshes
      if (devToken) {
        sessionStorage.setItem(DEV_TOKEN_KEY, devToken);
      }
      const storedToken = devToken ?? sessionStorage.getItem(DEV_TOKEN_KEY) ?? null;
      setUserProfile(profile);
      const mockMsalUser: MsalUser = {
        account: {
          homeAccountId: profile.uid,
          localAccountId: profile.uid,
          environment: 'dev',
          tenantId: 'dev-tenant',
          username: profile.correo,
          name: profile.nombre,
        } as AccountInfo,
        // Return the real JWT so auth-middleware.ts can decode it
        getIdToken: async () => storedToken,
      };
      setUser(mockMsalUser);
    } else {
      sessionStorage.removeItem(DEV_USER_KEY);
      sessionStorage.removeItem(DEV_TOKEN_KEY);
      setUserProfile(null);
      setUser(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedDevUser = sessionStorage.getItem(DEV_USER_KEY);
        if (storedDevUser) {
          const devProfile = JSON.parse(storedDevUser) as UserProfile;
          const restoredToken = sessionStorage.getItem(DEV_TOKEN_KEY);
          setUserProfile(devProfile);
          const mockMsalUser: MsalUser = {
            account: {
              homeAccountId: devProfile.uid,
              localAccountId: devProfile.uid,
              environment: 'dev',
              tenantId: 'dev-tenant',
              username: devProfile.correo,
              name: devProfile.nombre,
            } as AccountInfo,
            // Restore the real JWT from sessionStorage
            getIdToken: async () => restoredToken,
          };
          setUser(mockMsalUser);
          setLoading(false);
          return;
        }

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
    const publicPaths = ['/', '/test', '/student/login', '/instructor/login', '/auth/callback'];

    // Permitir acceso si es ruta pública o si el usuario está logueado
    if (!user && !publicPaths.includes(pathname)) {
      // Single unified login — always redirect to root
      router.push('/');
    }
  }, [user, pathname, loading, router]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, setDevUser }}>
      {children}
    </AuthContext.Provider>
  );
};
