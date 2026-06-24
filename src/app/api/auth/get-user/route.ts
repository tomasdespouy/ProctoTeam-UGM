import { NextRequest, NextResponse } from 'next/server';
import { verifyAzureToken } from '@/lib/auth-middleware';
import { upsertUser } from '@/lib/auth-postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener token del Header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token missing' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Verificar CRIPTOGRÁFICAMENTE el id_token de Azure (firma RS256 + audience + tenant)
    //    ANTES de crear/actualizar al usuario. Esto evita que un token forjado
    //    (alg:none o firmado con otra llave) inyecte usuarios en la base.
    const identity = await verifyAzureToken(token);
    if (!identity) {
      return NextResponse.json({ error: 'Token inválido o no verificable' }, { status: 401 });
    }

    // 3. Upsert (crea el usuario si no existe; el rol se asigna en upsertUser = 'student')
    const user = await upsertUser({
      uid: identity.uid,
      email: identity.email,
      nombre: identity.name,
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
