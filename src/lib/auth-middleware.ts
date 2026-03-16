import { NextRequest, NextResponse } from 'next/server';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import { promisify } from 'util';
import jwksClient from 'jwks-rsa';
import { getUserByUid } from './auth-postgres';

// ─────────────────────────────────────────────────────────────────────────────
// JWKS Client — Azure AD (RS256)
// Caché habilitada: las llaves se reutilizan 10 min antes de re-fetchear.
// ─────────────────────────────────────────────────────────────────────────────
const AZURE_TENANT_ID = '05970e72-c674-4f1f-8033-6e35dd7f76aa';
const JWKS_URI = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/discovery/v2.0/keys`;

const jwks = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutos
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

// ─────────────────────────────────────────────────────────────────────────────
// Dev secret — mismo que firma el token en /api/auth/dev-login/route.ts
// ─────────────────────────────────────────────────────────────────────────────
const DEV_JWT_SECRET = 'ugm-proctor-dev-secret-2024';

// ─────────────────────────────────────────────────────────────────────────────
// getKey — callback para jwt.verify en la ruta de Azure (RS256)
// Recupera la signing key pública usando el `kid` del header del token.
// ─────────────────────────────────────────────────────────────────────────────
function getKey(header: JwtHeader, callback: SigningKeyCallback): void {
  if (!header.kid) {
    callback(new Error('Token header no contiene kid'));
    return;
  }
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      callback(err ?? new Error('Signing key no encontrada'));
      return;
    }
    callback(null, key.getPublicKey());
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces públicas
// ─────────────────────────────────────────────────────────────────────────────
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
    // 1. Extraer Bearer token
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

    // 2. Decode sin verificar — solo para inspeccionar header y payload
    let decoded: any;
    try {
      decoded = jwt.decode(token, { complete: true });
    } catch (decodeError) {
      console.error('Error decoding token:', decodeError);
      return { authenticated: false, user: null, error: 'Invalid token format' };
    }

    if (!decoded || typeof decoded === 'string' || !decoded.payload || !decoded.header) {
      console.log('Auth Error: Invalid token structure');
      return { authenticated: false, user: null, error: 'Invalid token format' };
    }

    // 3. Bifurcación: ¿token de desarrollo (HS256 + claim dev:true) o Azure (RS256)?
    let verifiedPayload: any;

    const isDevToken =
      decoded.payload.dev === true &&
      decoded.header.alg === 'HS256';

    if (isDevToken) {
      // ── Ruta de Desarrollo ────────────────────────────────────────────────
      // Validamos con el secret simétrico local.
      // Si NEXT_PUBLIC_SHOW_DEV_LOGIN no está activo rechazamos igualmente.
      if (process.env.NEXT_PUBLIC_SHOW_DEV_LOGIN !== 'true') {
        console.warn('Auth Error: Dev token recibido en entorno de producción');
        return { authenticated: false, user: null, error: 'Dev tokens no permitidos en producción' };
      }

      try {
        verifiedPayload = jwt.verify(token, DEV_JWT_SECRET, { algorithms: ['HS256'] });
        console.log('[Auth] ✅ Token de desarrollo verificado (HS256)');
      } catch (err: any) {
        const msg = err.name === 'TokenExpiredError'
          ? 'Token de desarrollo expirado'
          : 'Firma de token de desarrollo inválida';
        console.error('Auth Error (dev):', err.message);
        return { authenticated: false, user: null, error: msg };
      }
    } else {
      // ── Ruta de Producción: Azure AD (RS256) ──────────────────────────────
      // Usamos getKey + promisify para obtener la llave pública desde el JWKS.
      const jwtVerifyAsync = promisify<string, jwt.Secret | jwt.GetPublicKeyOrSecret, jwt.VerifyOptions, any>(
        jwt.verify.bind(jwt) as any
      );

      try {
        verifiedPayload = await jwtVerifyAsync(token, getKey as jwt.GetPublicKeyOrSecret, {
          algorithms: ['RS256'],
        });
        console.log('[Auth] ✅ Token de Azure AD verificado (RS256)');
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          console.warn('Auth Error: Token de Azure AD expirado');
          return { authenticated: false, user: null, error: 'Sesión expirada. Por favor inicia sesión de nuevo.' };
        }
        if (err.name === 'JsonWebTokenError') {
          console.error('Auth Error: Firma de Azure AD inválida:', err.message);
          return { authenticated: false, user: null, error: 'Token inválido. Posible manipulación detectada.' };
        }
        // Otros errores (NetworkError del JWKS fetch, etc.)
        console.error('Auth Error (azure):', err.message);
        return { authenticated: false, user: null, error: 'Error al verificar el token' };
      }
    }

    // 4. Extraer identidad del payload ya verificado
    // Azure AD usa 'oid' como identificador estable; los tokens dev usan sub/oid/uid.
    const uid = verifiedPayload.oid || verifiedPayload.sub || verifiedPayload.uid;
    const email = verifiedPayload.email || verifiedPayload.preferred_username || verifiedPayload.upn;

    if (!uid) {
      console.log('Auth Error: No user ID found in verified payload');
      return { authenticated: false, user: null, error: 'No user ID in token' };
    }

    // 5. Lookup en base de datos para obtener rol
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
