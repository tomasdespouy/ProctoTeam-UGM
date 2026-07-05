// Obtiene la lista de ICE servers (STUN + TURN si está configurado) desde
// /api/turn-credentials. Cachea el resultado en memoria por sesión y cae a
// STUN-only si el fetch falla, para nunca romper la conexión.

const STUN_FALLBACK: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

let cached: RTCIceServer[] | null = null;

export async function getIceServers(token?: string | null): Promise<RTCIceServer[]> {
  if (cached) return cached;
  try {
    const res = await fetch('/api/turn-credentials', {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
        cached = data.iceServers as RTCIceServer[]; // solo cacheamos ÉXITO
        return cached;
      }
    }
  } catch {
    /* red caída → usamos STUN */
  }
  // NO cachear el fallo: un 401 transitorio (token aún no listo) o un blip no debe
  // dejar la sesión en STUN-only para siempre; el próximo intento con token válido
  // sí puede traer TURN.
  return STUN_FALLBACK;
}
