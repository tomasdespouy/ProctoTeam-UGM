// ── Realtime Broadcast (server-side) ────────────────────────────────────────
// Emite eventos al canal Realtime de un examen vía la API HTTP de Broadcast de
// Supabase, autenticando con la service_role key. Reemplaza la suscripción
// `postgres_changes` sobre `public.alerts`, que dejó de entregar eventos al rol
// `anon` cuando se activó RLS en esa tabla (ver database/security-rls.sql).
//
// Se usa fetch directo al endpoint /realtime/v1/api/broadcast (en lugar de un
// canal websocket) porque es lo correcto en funciones serverless: no requiere
// mantener una conexión abierta.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Emite una alerta al canal `exam-room-${examId}` como evento `new-alert`.
 *
 * A prueba de fallos: si el broadcast falla (red, config ausente, etc.) se
 * loguea y NO se propaga el error. La alerta ya quedó persistida y el panel del
 * proctor tiene polling de 30s como respaldo, así que un broadcast fallido solo
 * degrada la latencia, nunca pierde datos.
 */
export async function broadcastAlert(
  examId: string,
  alert: object
): Promise<void> {
  if (!examId || !alert) return;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn('[Broadcast] NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY ausentes — se omite broadcast de alerta.');
    return;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            // El topic es el nombre del canal sin el prefijo interno `realtime:`.
            topic: `exam-room-${examId}`,
            event: 'new-alert',
            payload: alert,
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[Broadcast] Falló el broadcast de alerta (${res.status}): ${detail}`);
    }
  } catch (err) {
    console.warn('[Broadcast] Error de red al emitir alerta:', err);
  }
}
