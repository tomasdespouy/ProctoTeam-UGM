import { NextRequest, NextResponse } from 'next/server';
import { liveSessionService } from '@/services/live-session.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Cron: cierra los exámenes abandonados (sin actividad >30 min o abiertos >6 h).
 * Antes esto solo corría de forma perezosa cuando alguien abría un dashboard.
 * Vercel Cron llama a este endpoint (ver vercel.json).
 *
 * Seguridad: si CRON_SECRET está definido, se exige `Authorization: Bearer <secret>`
 * (Vercel lo envía automáticamente). Si no está definido, se permite pero se avisa
 * — la acción solo cierra exámenes YA vencidos, de bajo impacto.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');

  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  } else {
    console.warn('[cron/auto-close] CRON_SECRET no configurado — endpoint sin protección');
  }

  try {
    const closed = await liveSessionService.autoCloseStaleExams();
    return NextResponse.json({ ok: true, closed });
  } catch (e: any) {
    console.error('[cron/auto-close] error:', e?.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
