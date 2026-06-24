import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STORAGE_BUCKET = 'evidences';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase no configurado: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── POST: recibe un chunk de video (webm) y lo sube a Supabase Storage ───────
// Cada grabación se guarda como recordings/<participationId>/<indice>.webm.
// Los chunks provienen de un único MediaRecorder con timeslice, por lo que,
// concatenados en orden, reconstruyen un webm reproducible.
export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request); // lanza si no está autenticado

    const form = await request.formData();
    const chunk = form.get('chunk');
    const participationId = String(form.get('participationId') ?? '').trim();
    const indexRaw = String(form.get('index') ?? '0');

    if (!(chunk instanceof Blob)) {
      return NextResponse.json({ error: 'chunk requerido' }, { status: 400 });
    }

    const safeId = participationId || 'sin-participacion';
    const index = String(parseInt(indexRaw, 10) || 0).padStart(5, '0');
    const storagePath = `recordings/${safeId}/${index}.webm`;

    const buffer = Buffer.from(await chunk.arrayBuffer());
    const supabase = getSupabaseAdmin();

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType: 'video/webm', upsert: true });

    if (uploadError) {
      console.error(`[Recording] upload FAILED path="${storagePath}" msg="${uploadError.message}"`);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path: storagePath }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (error.message?.startsWith('Supabase no configurado')) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[Recording] error general:', error?.message ?? error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ─── GET: lista los chunks de un estudiante y devuelve URLs firmadas en orden ──
// Solo docentes/super-admin. El bucket es privado, así que firmamos cada chunk
// (1h de validez). El cliente los descarga en orden, los concatena en un Blob y
// los reproduce como un único webm.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'instructor' && user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const participationId = String(new URL(request.url).searchParams.get('participationId') ?? '').trim();
    if (!participationId) {
      return NextResponse.json({ error: 'participationId requerido' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const folder = `recordings/${participationId}`;
    const { data: files, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(folder, { limit: 5000, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      console.error(`[Recording] list FAILED folder="${folder}" msg="${error.message}"`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const webm = (files ?? [])
      .filter(f => f.name.toLowerCase().endsWith('.webm'))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (webm.length === 0) {
      return NextResponse.json({ chunks: [], count: 0 });
    }

    const signed = await Promise.all(
      webm.map(f =>
        supabase.storage.from(STORAGE_BUCKET).createSignedUrl(`${folder}/${f.name}`, 3600)
      )
    );
    const chunks = signed.map(s => s.data?.signedUrl).filter((u): u is string => !!u);

    return NextResponse.json({ chunks, count: chunks.length });
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (error.message?.startsWith('Supabase no configurado')) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[Recording] GET error:', error?.message ?? error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
