import { NextRequest, NextResponse } from 'next/server';
import { auth as firebaseAuth } from './firebase';
import { getUserByUid } from './auth-postgres';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    uid: string;
    email: string;
    role: 'student' | 'instructor' | 'super-admin';
  };
}

/**
 * Middleware para verificar autenticación con Firebase/Azure AD
 * Extrae el token del header Authorization y verifica el usuario
 */
export async function verifyAuth(request: NextRequest): Promise<{
  user: { uid: string; email: string; role: 'student' | 'instructor' | 'super-admin' } | null;
  error: string | null;
}> {
  try {
    // Obtener token del header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'No authorization token provided' };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verificar token con Firebase Admin SDK
    const admin = await import('firebase-admin');
    
    // Inicializar Firebase Admin si no está inicializado
    if (!admin.apps.length) {
      // En producción, usar credenciales de servicio
      // En desarrollo, usar emulador o credenciales por defecto
      admin.initializeApp();
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Obtener perfil de usuario desde PostgreSQL
    const userProfile = await getUserByUid(uid);

    if (!userProfile) {
      return { user: null, error: 'User profile not found' };
    }

    return {
      user: {
        uid: userProfile.uid,
        email: userProfile.email,
        role: userProfile.role,
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return { user: null, error: 'Authentication required' };
  }
}

/**
 * Middleware para verificar rol de usuario
 */
export function requireRole(allowedRoles: ('student' | 'instructor' | 'super-admin')[]) {
  return async (request: NextRequest) => {
    const { user, error } = await verifyAuth(request);

    if (error || !user) {
      return NextResponse.json(
        { error: error || 'Authentication required' },
        { status: 401 }
      );
    }

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return null; // Autenticación exitosa
  };
}

/**
 * Helper para extraer usuario autenticado de la request
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const { user, error } = await verifyAuth(request);
  
  if (error || !user) {
    // Siempre lanzar el mismo mensaje para manejarlo consistentemente
    throw new Error('Authentication required');
  }
  
  return user;
}
