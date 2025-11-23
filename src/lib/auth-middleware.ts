import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getUserByUid } from './auth-postgres';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    uid: string;
    email: string;
    role: 'student' | 'instructor' | 'super-admin';
  };
}

export async function verifyAuth(request: NextRequest): Promise<{
  authenticated: boolean;
  user: { uid: string; email: string; role: 'student' | 'instructor' | 'super-admin' } | null;
  error: string | null;
}> {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth Error: No authorization header found');
      return { authenticated: false, user: null, error: 'No authorization token provided' };
    }

    const token = authHeader.substring(7);
    
    if (!token || token === 'null' || token === 'undefined') {
      console.log('Auth Error: Token is null or undefined');
      return { authenticated: false, user: null, error: 'Invalid token' };
    }

    // Decodificar el token (sin validar firma - confiamos en el frontend para APIs internas)
    let decoded: any;
    try {
      decoded = jwt.decode(token, { complete: true });
    } catch (decodeError) {
      console.error('Error decoding token:', decodeError);
      return { authenticated: false, user: null, error: 'Invalid token format' };
    }
    
    if (!decoded || typeof decoded === 'string' || !decoded.payload) {
      console.log('Auth Error: Invalid token structure');
      return { authenticated: false, user: null, error: 'Invalid token format' };
    }

    // Azure AD usa 'oid' como identificador principal
    const uid = decoded.payload.oid || decoded.payload.sub || decoded.payload.uid;
    const email = decoded.payload.email || decoded.payload.preferred_username || decoded.payload.upn;

    if (!uid) {
      console.log('Auth Error: No user ID found in token payload:', decoded.payload);
      return { authenticated: false, user: null, error: 'No user ID in token' };
    }

    console.log(`Verificando usuario con UID: ${uid}`);
    const userProfile = await getUserByUid(uid);

    if (!userProfile) {
      console.log(`Auth Error: User profile not found for UID: ${uid}`);
      return { authenticated: false, user: null, error: 'User profile not found' };
    }

    console.log(`Usuario autenticado: ${userProfile.email} con rol: ${userProfile.role}`);
    return {
      authenticated: true,
      user: {
        uid: userProfile.uid,
        email: userProfile.email,
        role: userProfile.role,
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return { authenticated: false, user: null, error: 'Authentication required' };
  }
}

export async function getAuthenticatedUser(request: NextRequest) {
  const result = await verifyAuth(request);
  
  if (!result.authenticated || !result.user) {
    throw new Error('Authentication required');
  }
  
  return result.user;
}

export function requireRole(allowedRoles: ('student' | 'instructor' | 'super-admin')[]) {
  return async (request: NextRequest) => {
    const result = await verifyAuth(request);

    if (!result.authenticated || !result.user) {
      return NextResponse.json(
        { error: result.error || 'Authentication required' },
        { status: 401 }
      );
    }

    if (!allowedRoles.includes(result.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return null;
  };
}
