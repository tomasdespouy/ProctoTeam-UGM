import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// STUN siempre presente (gratis, sin cuota). TURN se agrega solo si hay
// credenciales configuradas; si no, se devuelve solo STUN (comportamiento
// actual, sin regresión).
const STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export async function GET() {
  // ── Opción A: API de Metered (recomendada) ────────────────────────────────
  // Requiere METERED_APP_NAME (el subdominio, p.ej. "miapp" de miapp.metered.live)
  // y METERED_API_KEY (tu API key). Devuelve iceServers frescos.
  const app = process.env.METERED_APP_NAME;
  const apiKey = process.env.METERED_API_KEY;
  if (app && apiKey) {
    try {
      const r = await fetch(
        `https://${app}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
        { cache: 'no-store' },
      );
      if (r.ok) {
        const servers = await r.json();
        if (Array.isArray(servers) && servers.length > 0) {
          return NextResponse.json({ iceServers: [...STUN, ...servers] });
        }
      } else {
        console.error('[TURN] Metered API respondió', r.status);
      }
    } catch (e: any) {
      console.error('[TURN] Error consultando Metered:', e?.message ?? e);
    }
  }

  // ── Opción B: credenciales estáticas por env ──────────────────────────────
  // TURN_URLS separadas por coma, p.ej.
  //   "turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443,turns:a.relay.metered.ca:443?transport=tcp"
  const urls = process.env.TURN_URLS;
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  if (urls && username && credential) {
    return NextResponse.json({
      iceServers: [...STUN, { urls: urls.split(',').map(u => u.trim()), username, credential }],
    });
  }

  // Sin TURN configurado → solo STUN.
  return NextResponse.json({ iceServers: STUN });
}
