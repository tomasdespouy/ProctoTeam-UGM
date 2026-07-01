import { createClient } from '@supabase/supabase-js';

// El bucket de evidencias es PRIVADO. Las filas de `alerts` guardan una URL
// "pública" (getPublicUrl) que en un bucket privado devuelve HTTP 400 y por eso
// las <img> no cargaban. Aquí firmamos la URL al momento de servirla: la URL
// firmada lleva su propio token, así que el navegador la carga sin cabeceras.
const STORAGE_BUCKET = 'evidences';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Extrae el path del objeto desde el valor almacenado, que puede ser una URL
// (pública o firmada) o ya un path relativo.
export function evidenceObjectPath(stored?: string | null): string | null {
  if (!stored) return null;
  if (!/^https?:\/\//.test(stored)) return stored.replace(/^\/+/, '');
  const marker = `/${STORAGE_BUCKET}/`;
  const i = stored.indexOf(marker);
  if (i === -1) return null;
  // corta querystring de una firma previa
  return stored.slice(i + marker.length).split('?')[0];
}

// Firma un único valor de evidencia. Devuelve el valor original si no se puede.
export async function signEvidenceUrl(stored?: string | null, expiresIn = 3600): Promise<string | null> {
  if (!stored) return stored ?? null;
  const sb = admin();
  const path = evidenceObjectPath(stored);
  if (!sb || !path) return stored;
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return stored;
  return data.signedUrl;
}

// Firma `evidence_url` en un arreglo de filas de alerta (en lote).
export async function signEvidenceRows<T extends { evidence_url?: string | null }>(
  rows: T[],
  expiresIn = 3600,
): Promise<T[]> {
  return Promise.all(
    rows.map(async r =>
      r.evidence_url ? { ...r, evidence_url: await signEvidenceUrl(r.evidence_url, expiresIn) } : r,
    ),
  );
}
