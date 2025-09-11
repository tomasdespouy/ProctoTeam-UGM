'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';

export interface UserProfile {
  nombre: string;
  correo: string;
  role: 'student' | 'instructor' | 'super-admin';
  photoURL?: string | null;
  creadoEn?: Timestamp;
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
          const userDocRef = doc(db, "users", user.uid);
          
          // Add retry logic for Firestore operations
          let retries = 3;
          let userDocSnap;
          
          while (retries > 0) {
            try {
              userDocSnap = await getDoc(userDocRef);
              break; // Success, exit retry loop
            } catch (error: any) {
              console.log(`Firestore fetch attempt failed, retries left: ${retries - 1}`);
              retries--;
              
              if (retries === 0) {
                console.error('Failed to fetch user profile after retries:', error);
                // Set basic user info without profile if Firestore fails
                setUser(user);
                setUserProfile(null);
                setLoading(false);
                return;
              }
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (userDocSnap && userDocSnap.exists()) {
              const profileData = userDocSnap.data() as UserProfile;
              const updates: Partial<UserProfile> = {};
              let needsUpdate = false;

              // Sync from Auth to Firestore if fields are missing in Firestore
              if (!profileData.nombre && user.displayName) {
                  updates.nombre = user.displayName;
                  needsUpdate = true;
              }
              if (!profileData.correo && user.email) {
                  updates.correo = user.email;
                  needsUpdate = true;
              }
              if (profileData.photoURL === undefined && user.photoURL) {
                  updates.photoURL = user.photoURL;
                  needsUpdate = true;
              }
               if (!profileData.creadoEn && user.metadata.creationTime) {
                  updates.creadoEn = Timestamp.fromDate(new Date(user.metadata.creationTime));
                  needsUpdate = true;
              }

              if (needsUpdate) {
                  try {
                    await setDoc(userDocRef, updates, { merge: true });
                    setUserProfile({ ...profileData, ...updates });
                  } catch (error) {
                    console.error('Failed to update user profile:', error);
                    // Still set the profile data even if update fails
                    setUserProfile(profileData);
                  }
              } else {
                  setUserProfile(profileData);
              }
          } else {
            setUserProfile(null);
          }
          setUser(user);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        // In case of error, still update loading state
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
