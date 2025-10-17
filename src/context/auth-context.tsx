'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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

interface AuthContextType {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Obtener perfil de usuario desde PostgreSQL
          const response = await fetch(`/api/auth/get-user?uid=${user.uid}`);
          
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
              // Si no existe en PostgreSQL, crear perfil básico
              const createResponse = await fetch('/api/auth/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uid: user.uid,
                  email: user.email || '',
                  nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
                  role: 'student', // Rol por defecto
                  photo_url: user.photoURL || null,
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
          
          setUser(user);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const isAuthRoute = pathname.startsWith('/instructor') || pathname.startsWith('/student') || pathname.startsWith('/super-admin');
    const isLoginPage = pathname.endsWith('/login');

    // CRITICAL SECURITY: Validate role matches portal access
    if (user && userProfile && isAuthRoute && !isLoginPage) {
      const userRole = userProfile.role;
      
      // Check for role mismatch and force logout if detected
      if (pathname.startsWith('/instructor') && userRole !== 'instructor') {
        console.warn(`SECURITY: User with role '${userRole}' attempted to access instructor portal. Forcing logout.`);
        signOut(auth).then(() => {
          router.push('/instructor/login');
        });
        return;
      }
      
      if (pathname.startsWith('/student') && userRole !== 'student') {
        console.warn(`SECURITY: User with role '${userRole}' attempted to access student portal. Forcing logout.`);
        signOut(auth).then(() => {
          router.push('/student/login');
        });
        return;
      }
      
      if (pathname.startsWith('/super-admin') && userRole !== 'super-admin') {
        console.warn(`SECURITY: User with role '${userRole}' attempted to access super-admin portal. Forcing logout.`);
        signOut(auth).then(() => {
          router.push('/instructor/login');
        });
        return;
      }
    }

    // Redirect unauthenticated users to appropriate login
    if (!user && isAuthRoute && !isLoginPage) {
        if (pathname.startsWith('/instructor')) {
            router.push('/instructor/login');
        } else if (pathname.startsWith('/student')) {
            router.push('/student/login');
        } else if (pathname.startsWith('/super-admin')) {
            router.push('/instructor/login');
        }
    }
    
    // Redirect authenticated users away from login pages to their portals
    if (user && userProfile && isLoginPage) {
        const userRole = userProfile.role;
        if (userRole === 'instructor') {
            router.push('/instructor');
        } else if (userRole === 'student') {
            router.push('/student');
        } else if (userRole === 'super-admin') {
            router.push('/super-admin/dashboard');
        }
    }

  }, [user, userProfile, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
