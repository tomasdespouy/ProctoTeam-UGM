import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { signEvidenceUrl } from '@/lib/evidence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS_LABEL: Record<string, string> = {
  joined: 'Unido',
  'in-progress': 'En progreso',
  submitted: 'Finalizado',
  blocked: 'Bloqueado',
};
const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Crítica',
  warning: 'Advertencia',
  info: 'Info',
};

function fmt(d: any): string {
  if (!d) return '';
  try { return new Date(d).toLocaleString('es-CL'); } catch { return String(d); }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> },
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'instructor' && user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { examId } = await params;

    // ── Datos ────────────────────────────────────────────────────────────────
    const examRes = await db.query(
      `SELECT es.title, es.subject, es.section, es.access_code, es.status,
              es.duration, es.created_at, es.instructor_id,
              u.nombre AS instructor_name, u.email AS instructor_email
         FROM exam_sessions es
         LEFT JOIN users u ON es.instructor_id = u.uid
        WHERE es.id = $1`,
      [examId],
    );
    if (examRes.rows.length === 0) {
      return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    }
    const exam = examRes.rows[0];

    // Un docente solo puede exportar sus propios exámenes; el super-admin, todos.
    if (user.role === 'instructor' && exam.instructor_id !== user.uid) {
      return NextResponse.json({ error: 'Este examen no te pertenece' }, { status: 403 });
    }

    const [partsRes, alertsRes] = await Promise.all([
      db.query(
        `SELECT ep.student_name, ep.student_id, ep.status, ep.started_at, ep.finished_at,
                u.email AS student_email
           FROM exam_participations ep
           LEFT JOIN users u ON ep.student_id = u.uid
          WHERE ep.exam_session_id = $1
          ORDER BY ep.student_name`,
        [examId],
      ),
      db.query(
        `SELECT a.student_id, ep.student_name, a.severity, a.description, a.evidence_url, a.timestamp
           FROM alerts a
           LEFT JOIN exam_participations ep
             ON ep.exam_session_id = a.exam_session_id AND ep.student_id = a.student_id
          WHERE a.exam_session_id = $1
          ORDER BY a.timestamp ASC`,
        [examId],
      ),
    ]);

    const participations = partsRes.rows;
    const alerts = alertsRes.rows;

    // Índices por estudiante
    const alertsByStudent = new Map<string, any[]>();
    for (const a of alerts) {
      const arr = alertsByStudent.get(a.student_id) ?? [];
      arr.push(a);
      alertsByStudent.set(a.student_id, arr);
    }
    const identityVerified = new Set(
      alerts.filter(a => /verificaci[oó]n de identidad/i.test(a.description ?? '')).map(a => a.student_id),
    );

    const sevCount = (sev: string) => alerts.filter(a => a.severity === sev).length;

    // ── Workbook ───────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ProctoTeam UGM';

    const headerStyle = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161F45' } }; });
    };

    // Hoja 1: Resumen
    const s1 = wb.addWorksheet('Resumen');
    s1.columns = [{ width: 26 }, { width: 50 }];
    const resumen: [string, any][] = [
      ['Examen', exam.title],
      ['Asignatura', exam.subject],
      ['Sección', exam.section],
      ['Código de acceso', exam.access_code],
      ['Estado', STATUS_LABEL[exam.status] ?? exam.status],
      ['Duración (min)', exam.duration],
      ['Fecha de creación', fmt(exam.created_at)],
      ['Docente', `${exam.instructor_name ?? ''} (${exam.instructor_email ?? ''})`],
      ['Nº de estudiantes', participations.length],
      ['Nº de alertas', alerts.length],
      ['  · Críticas', sevCount('critical')],
      ['  · Advertencias', sevCount('warning')],
      ['  · Info', sevCount('info')],
    ];
    s1.addRow(['Campo', 'Valor']);
    headerStyle(s1.getRow(1));
    resumen.forEach(([k, v]) => s1.addRow([k, v]));

    // Hoja 2: Estudiantes
    const s2 = wb.addWorksheet('Estudiantes');
    s2.columns = [
      { header: 'Nombre', key: 'nombre', width: 28 },
      { header: 'Correo', key: 'correo', width: 30 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Ingreso', key: 'ingreso', width: 20 },
      { header: 'Fin', key: 'fin', width: 20 },
      { header: 'Nº alertas', key: 'nalertas', width: 12 },
      { header: 'Críticas', key: 'ncrit', width: 10 },
      { header: 'Identidad verificada', key: 'identidad', width: 20 },
    ];
    headerStyle(s2.getRow(1));
    for (const p of participations) {
      const list = alertsByStudent.get(p.student_id) ?? [];
      s2.addRow({
        nombre: p.student_name,
        correo: p.student_email ?? '',
        estado: STATUS_LABEL[p.status] ?? p.status,
        ingreso: fmt(p.started_at),
        fin: fmt(p.finished_at),
        nalertas: list.length,
        ncrit: list.filter(a => a.severity === 'critical').length,
        identidad: identityVerified.has(p.student_id) ? 'Sí' : 'No',
      });
    }

    // Hoja 3: Alertas (con enlace de evidencia firmado)
    const s3 = wb.addWorksheet('Alertas');
    s3.columns = [
      { header: 'Fecha/Hora', key: 'fecha', width: 22 },
      { header: 'Estudiante', key: 'estudiante', width: 28 },
      { header: 'Severidad', key: 'sev', width: 14 },
      { header: 'Descripción', key: 'desc', width: 60 },
      { header: 'Evidencia', key: 'evidencia', width: 40 },
    ];
    headerStyle(s3.getRow(1));
    const signed = await Promise.all(
      alerts.map(a => (a.evidence_url ? signEvidenceUrl(a.evidence_url, 60 * 60 * 24 * 7) : Promise.resolve(null))),
    );
    alerts.forEach((a, i) => {
      const row = s3.addRow({
        fecha: fmt(a.timestamp),
        estudiante: a.student_name ?? a.student_id,
        sev: SEVERITY_LABEL[a.severity] ?? a.severity,
        desc: a.description,
        evidencia: signed[i] ? 'Ver foto' : '',
      });
      if (signed[i]) {
        const cell = row.getCell('evidencia');
        cell.value = { text: 'Ver foto', hyperlink: signed[i]! };
        cell.font = { color: { argb: 'FF1D4ED8' }, underline: true };
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const safeTitle = String(exam.title ?? 'examen').replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte_${safeTitle}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[Report] error generando Excel:', error?.message ?? error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error al generar el reporte' }, { status: 500 });
  }
}
