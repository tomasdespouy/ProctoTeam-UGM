// Obtiene la lista de ICE servers (STUN + TURN si está configurado) desde
// /api/turn-credentials. Cachea el resultado en memoria por sesión y cae a
// STUN-only si el fetch falla, para nunca romper la conexión.

const STUN_FALLBACK: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

let cached: RTCIceServer[] | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cached) return cached;
  try {
    const res = await fetch('/api/turn-credentials', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
        cached = data.iceServers as RTCIceServer[];
        return cached;
      }
    }
  } catch {
    /* red caída → usamos STUN */
  }
  cached = STUN_FALLBACK;
  return cached;
}
