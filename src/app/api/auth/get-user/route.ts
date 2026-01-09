import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { upsertUser } from '@/lib/auth-postgres'; // Asegúrate que importe upsertUser

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener token del Header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token missing' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    // Evitar procesar tokens nulos o indefinidos que a veces envía el frontend
    if (!token || token === 'null' || token === 'undefined') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Decodificar Token (Sin verificar firma, confiamos en Azure)
    const decoded: any = jwt.decode(token);

    if (!decoded) {
      return NextResponse.json({ error: 'Token decoding failed' }, { status: 401 });
    }

    // 3. Extraer datos (Azure AD usa 'oid', otros 'sub')
    const uid = decoded.oid || decoded.sub || decoded.uid;
    const email = decoded.email || decoded.preferred_username || decoded.upn;
    // Intentar obtener nombre, o usar parte del email
    const name = decoded.name || (email ? email.split('@')[0] : 'Usuario');

    if (!uid) {
        return NextResponse.json({ error: 'Token missing UID' }, { status: 400 });
    }

    // 4. MAGIA: Upsert (Crea el usuario si no existe, o lo actualiza)
    // El rol se determinará automáticamente en upsertUser basándose en el email
    const user = await upsertUser({
      uid,
      email,
      nombre: name
    });

    return NextResponse.json({ user });

  } catch (error: any) {
    console.error('API get-user Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message }, 
      { status: 500 }
    );
  }
}