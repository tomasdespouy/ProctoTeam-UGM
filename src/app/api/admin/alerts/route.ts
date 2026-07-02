import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { signEvidenceRows } from '@/lib/evidence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Filtro por fecha (YYYY-MM-DD). Sin parámetros → últimas 24 h (hoy).
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to   = searchParams.get('to');

    const params: any[] = [];
    if (from) params.push(from);
    const idxFrom = from ? params.length : 0;
    if (to) params.push(to);
    const idxTo = to ? params.length : 0;

    const cond = (col: string) => {
      if (!from && !to) return ` AND ${col} >= NOW() - INTERVAL '24 hours'`;
      let c = '';
      if (from) c += ` AND ${col} >= $${idxFrom}::date`;
      if (to)   c += ` AND ${col} < ($${idxTo}::date + INTERVAL '1 day')`;
      return c;
    };
    // Ojo: en template literal de JS hay que duplicar las barras para que el SQL
    // reciba \s / \[ y el regexp funcione (si no, se pierden).
    const STRIP = `regexp_replace(description, '^\\s*\\[[^\\]]*\\]\\s*', '')`;

    const [metricsResult, recentResult] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
          COUNT(*) FILTER (WHERE severity = 'warning')  AS warning,
          COUNT(*) FILTER (WHERE severity = 'info')      AS info,
          COUNT(*) FILTER (WHERE evidence_url IS NOT NULL) AS with_evidence,
          (
            SELECT ${STRIP}
            FROM alerts
            WHERE TRUE ${cond('timestamp')}
            GROUP BY ${STRIP}
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) AS top_alert_type
        FROM alerts
        WHERE TRUE ${cond('timestamp')}
      `, params),

      db.query(`
        SELECT
          a.id, a.timestamp, a.severity, a.description, a.evidence_url,
          CONCAT(LEFT(u.email, 1), '***@', SPLIT_PART(u.email, '@', 2)) AS student_email_masked,
          es.subject AS exam_subject, es.title AS exam_title
        FROM alerts a
        LEFT JOIN users u          ON a.student_id = u.uid
        LEFT JOIN exam_sessions es ON a.exam_session_id = es.id
        WHERE TRUE ${cond('a.timestamp')}
        ORDER BY a.timestamp DESC
        LIMIT 300
      `, params)
    ]);

    const m = metricsResult.rows[0];
    return NextResponse.json({
      metrics: {
        total:        parseInt(m.total        ?? '0'),
        critical:     parseInt(m.critical     ?? '0'),
        warning:      parseInt(m.warning      ?? '0'),
        info:         parseInt(m.info         ?? '0'),
        topAlertType: m.top_alert_type ?? '—',
        withEvidence: parseInt(m.with_evidence ?? '0'),
      },
      period: { from: from ?? null, to: to ?? null },
      alerts: await signEvidenceRows(recentResult.rows),
    });
  } catch (error: any) {
    console.error('Admin alerts API error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
