import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const [metricsResult, recentResult] = await Promise.all([
      // Global metrics
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours') AS total_today,
          COUNT(*) FILTER (WHERE severity = 'critical' AND timestamp >= NOW() - INTERVAL '24 hours') AS critical_today,
          COUNT(*) FILTER (WHERE severity = 'warning'  AND timestamp >= NOW() - INTERVAL '24 hours') AS warning_today,
          COUNT(*) FILTER (WHERE severity = 'info'     AND timestamp >= NOW() - INTERVAL '24 hours') AS info_today,
          (
            SELECT description
            FROM alerts
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY description
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) AS top_alert_type,
          COUNT(*) FILTER (WHERE evidence_url IS NOT NULL) AS with_evidence
        FROM alerts
      `),

      // Recent alerts (last 100) — mask student email for privacy
      db.query(`
        SELECT
          a.id,
          a.timestamp,
          a.severity,
          a.description,
          a.evidence_url,
          -- mask email: a***@domain.com
          CONCAT(
            LEFT(u.email, 1),
            '***@',
            SPLIT_PART(u.email, '@', 2)
          ) AS student_email_masked,
          es.subject AS exam_subject,
          es.title   AS exam_title
        FROM alerts a
        LEFT JOIN users u         ON a.student_id = u.uid
        LEFT JOIN exam_sessions es ON a.exam_session_id = es.id
        ORDER BY a.timestamp DESC
        LIMIT 100
      `)
    ]);

    const m = metricsResult.rows[0];
    return NextResponse.json({
      metrics: {
        totalToday:    parseInt(m.total_today    ?? '0'),
        criticalToday: parseInt(m.critical_today ?? '0'),
        warningToday:  parseInt(m.warning_today  ?? '0'),
        infoToday:     parseInt(m.info_today     ?? '0'),
        topAlertType:  m.top_alert_type ?? '—',
        withEvidence:  parseInt(m.with_evidence  ?? '0'),
      },
      alerts: recentResult.rows,
    });
  } catch (error: any) {
    console.error('Admin alerts API error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
