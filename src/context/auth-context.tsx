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
        const account = msalInstance.getActiveAccount();

        if (account) {
          const msalUser: MsalUser = {
            account,
            getIdToken: acquireTokenSilent,
          };

          const uid = account.localAccountId;
          const response = await fetch(`/api/auth/get-user?uid=${uid}`);
          
          if (response.ok) {
            const profileData = await response.json();
            
            if (profileData) {
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
              const createResponse = await fetch('/api/auth/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uid: uid,
                  email: account.username || '',
                  nombre: account.name || account.username?.split('@')[0] || 'Usuario',
                  role: 'student',
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
                console.error('Failed to create user profile');
                setUserProfile(null);
              }
            }
          } else {
            console.error('Failed to fetch user profile');
            setUserProfile(null);
          }
          
          setUser(msalUser);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const msalInstance = getMsalInstance();
    const callbackId = msalInstance.addEventCallback((event: any) => {
      if (event.eventType === 'msal:loginSuccess' || event.eventType === 'msal:acquireTokenSuccess') {
        const account = msalInstance.getActiveAccount();
        if (account) {
          initAuth();
        }
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

    const publicPaths = ['/', '/student/login', '/instructor/login'];
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
