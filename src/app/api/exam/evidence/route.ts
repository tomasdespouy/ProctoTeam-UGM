import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { db } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024; // 2 MB

// ─── Cliente de Supabase (server-side con service role) ───────────────────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase no configurado: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

const STORAGE_BUCKET = 'evidences';

// ─── POST: Recibe snapshot base64, lo sube a Supabase Storage y retorna la URL ─
// El guardado de la alerta en DB es responsabilidad del cliente (via reportAlert).
export async function POST(request: NextRequest) {
  try {
    // Tarea 2 — log the auth step so we know if a 401 is the culprit
    let authedUser: Awaited<ReturnType<typeof getAuthenticatedUser>>;
    try {
      authedUser = await getAuthenticatedUser(request);
    } catch (authErr: any) {
      throw authErr;
    }

    const body = await request.json();
    const { snapshot, participationId, alertType } = body;

    if (typeof snapshot !== 'string' || !snapshot) {
      return NextResponse.json({ error: 'snapshot es requerido' }, { status: 400 });
    }
    // Solo imágenes (data URI image/*), para no guardar bytes arbitrarios.
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(snapshot)) {
      return NextResponse.json({ error: 'snapshot debe ser una imagen base64' }, { status: 400 });
    }

    // El participationId (si viene) debe ser UUID y pertenecer al usuario:
    // cierra path traversal en la clave de storage y la subida en nombre de otro.
    let safeParticipation = '';
    if (participationId) {
      if (!UUID_RE.test(String(participationId))) {
        return NextResponse.json({ error: 'participationId inválido' }, { status: 400 });
      }
      const owner = await db.query(
        'SELECT student_id FROM exam_participations WHERE id = $1',
        [participationId],
      );
      const ownerId = owner.rows[0]?.student_id;
      if (!ownerId || (ownerId !== authedUser.uid && authedUser.role !== 'super-admin')) {
        return NextResponse.json({ error: 'No autorizado para esta participación' }, { status: 403 });
      }
      safeParticipation = String(participationId);
    }
    const safeAlertType = String(alertType ?? 'snapshot').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'snapshot';

    const supabase = getSupabaseAdmin();
    const base64Data = snapshot.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Límite de tamaño (evita DoS por memoria / abuso de storage).
    if (buffer.length === 0 || buffer.length > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json({ error: 'Imagen vacía o demasiado grande (máx 2 MB)' }, { status: 413 });
    }

    const timestamp = Date.now();
    const prefix = safeParticipation
      ? `${safeParticipation}_${safeAlertType}_${timestamp}`
      : `snapshot_${timestamp}`;
    const storagePath = `evidence/${prefix}.jpg`;

    console.log(`[Evidence] 📦 Intentando subir a bucket="${STORAGE_BUCKET}" path="${storagePath}" size=${buffer.length}B`);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    // Tarea 2 — log full Supabase error (message + statusCode + error name)
    if (uploadError) {
      console.error(
        `[Evidence] ❌ Supabase Storage upload FAILED` +
        ` | bucket="${STORAGE_BUCKET}" path="${storagePath}"` +
        ` | message="${uploadError.message}"` +
        ` | statusCode=${(uploadError as any).statusCode ?? 'N/A'}` +
        ` | error=${(uploadError as any).error ?? 'N/A'}`
      );
      throw new Error(`Error al subir evidencia: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    console.log(`[Evidence] ✅ Subida exitosa → publicUrl: ${data.publicUrl}`);

    return NextResponse.json({ success: true, publicUrl: data.publicUrl }, { status: 201 });

  } catch (error: any) {
    console.error('[Evidence] 💥 Error general en POST /api/exam/evidence:', error?.message ?? error);

    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (error.message?.startsWith('Supabase no configurado')) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ─── GET: Consultar alertas con evidencias (lee de la tabla alerts via live-session) ─
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (user.role !== 'instructor' && user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    // Las alertas ahora se consultan a través de /api/live o /api/exam-sessions/[examId]/alerts
    return NextResponse.json({ alerts: [] });

  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
