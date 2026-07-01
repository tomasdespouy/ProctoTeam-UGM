import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { signEvidencePaths } from '@/lib/evidence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  finished: 'Finalizado',
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

const ALERTS_LIMIT = 1000;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const [statsRes, examsRes, teachersRes, alertsRes] = await Promise.all([
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM exam_sessions) AS total_exams,
          (SELECT COUNT(*) FROM exam_sessions WHERE status = 'active') AS active_exams,
          (SELECT COUNT(*) FROM exam_sessions WHERE status = 'finished') AS finished_exams,
          (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
          (SELECT COUNT(*) FROM users WHERE role = 'instructor') AS total_instructors,
          (SELECT COUNT(*) FROM exam_participations) AS total_participations,
          (SELECT COUNT(*) FROM alerts) AS total_alerts,
          (SELECT COUNT(*) FROM alerts WHERE severity = 'critical') AS critical_alerts,
          (SELECT COUNT(*) FROM alerts WHERE severity = 'warning') AS warning_alerts,
          (SELECT COUNT(*) FROM alerts WHERE severity = 'info') AS info_alerts
      `),
      db.query(`
        SELECT es.id, es.title, es.subject, es.section, es.status, es.duration, es.created_at,
               es.access_code, u.nombre AS instructor_name, u.email AS instructor_email,
               (SELECT COUNT(*) FROM exam_participations ep WHERE ep.exam_session_id = es.id) AS student_count,
               (SELECT COUNT(*) FROM alerts a WHERE a.exam_session_id = es.id) AS alert_count,
               (SELECT COUNT(*) FROM alerts a WHERE a.exam_session_id = es.id AND a.severity = 'critical') AS critical_count
        FROM exam_sessions es
        LEFT JOIN users u ON es.instructor_id = u.uid
        ORDER BY es.created_at DESC
      `),
      db.query(`
        SELECT u.nombre, u.email,
               (SELECT COUNT(*) FROM exam_sessions es WHERE es.instructor_id = u.uid) AS exams,
               (SELECT COUNT(*) FROM alerts a JOIN exam_sessions es ON a.exam_session_id = es.id
                 WHERE es.instructor_id = u.uid) AS alerts
        FROM users u
        WHERE u.role = 'instructor'
        ORDER BY u.nombre
      `),
      db.query(`
        SELECT a.timestamp, a.severity, a.description, a.evidence_url,
               es.title AS exam_title, es.subject AS exam_subject,
               COALESCE(ep.student_name, u.nombre, a.student_id) AS student_name
        FROM alerts a
        LEFT JOIN exam_sessions es ON a.exam_session_id = es.id
        LEFT JOIN exam_participations ep ON ep.exam_session_id = a.exam_session_id AND ep.student_id = a.student_id
        LEFT JOIN users u ON u.uid = a.student_id
        ORDER BY a.timestamp DESC
        LIMIT ${ALERTS_LIMIT}
      `),
    ]);

    const stats = statsRes.rows[0];
    const exams = examsRes.rows;
    const teachers = teachersRes.rows;
    const alerts = alertsRes.rows;
    const signed = await signEvidencePaths(alerts.map(a => a.evidence_url), 60 * 60 * 24 * 7);

    // ── Workbook ───────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ProctoTeam UGM';

    const headerStyle = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161F45' } }; });
    };

    // Hoja 1: Resumen global
    const s1 = wb.addWorksheet('Resumen global');
    s1.columns = [{ width: 30 }, { width: 20 }];
    s1.addRow(['Métrica', 'Valor']);
    headerStyle(s1.getRow(1));
    ([
      ['Exámenes totales', stats.total_exams],
      ['  · Activos', stats.active_exams],
      ['  · Finalizados', stats.finished_exams],
      ['Docentes', stats.total_instructors],
      ['Estudiantes', stats.total_students],
      ['Participaciones', stats.total_participations],
      ['Alertas totales', stats.total_alerts],
      ['  · Críticas', stats.critical_alerts],
      ['  · Advertencias', stats.warning_alerts],
      ['  · Info', stats.info_alerts],
    ] as [string, any][]).forEach(r => s1.addRow(r));

    // Hoja 2: Exámenes
    const s2 = wb.addWorksheet('Exámenes');
    s2.columns = [
      { header: 'Examen', key: 'titulo', width: 30 },
      { header: 'Asignatura', key: 'asignatura', width: 22 },
      { header: 'Sección', key: 'seccion', width: 12 },
      { header: 'Docente', key: 'docente', width: 26 },
      { header: 'Correo docente', key: 'correo', width: 28 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Creado', key: 'creado', width: 20 },
      { header: 'Alumnos', key: 'alumnos', width: 10 },
      { header: 'Alertas', key: 'alertas', width: 10 },
      { header: 'Críticas', key: 'criticas', width: 10 },
    ];
    headerStyle(s2.getRow(1));
    for (const e of exams) {
      s2.addRow({
        titulo: e.title,
        asignatura: e.subject,
        seccion: e.section,
        docente: e.instructor_name ?? '',
        correo: e.instructor_email ?? '',
        estado: STATUS_LABEL[e.status] ?? e.status,
        creado: fmt(e.created_at),
        alumnos: Number(e.student_count ?? 0),
        alertas: Number(e.alert_count ?? 0),
        criticas: Number(e.critical_count ?? 0),
      });
    }

    // Hoja 3: Docentes
    const s3 = wb.addWorksheet('Docentes');
    s3.columns = [
      { header: 'Docente', key: 'nombre', width: 28 },
      { header: 'Correo', key: 'correo', width: 30 },
      { header: 'Exámenes', key: 'examenes', width: 12 },
      { header: 'Alertas', key: 'alertas', width: 12 },
    ];
    headerStyle(s3.getRow(1));
    for (const t of teachers) {
      s3.addRow({
        nombre: t.nombre,
        correo: t.email,
        examenes: Number(t.exams ?? 0),
        alertas: Number(t.alerts ?? 0),
      });
    }

    // Hoja 4: Alertas (últimas 1000, con enlace de evidencia firmado)
    const s4 = wb.addWorksheet('Alertas');
    s4.columns = [
      { header: 'Fecha/Hora', key: 'fecha', width: 22 },
      { header: 'Examen', key: 'examen', width: 28 },
      { header: 'Asignatura', key: 'asignatura', width: 20 },
      { header: 'Estudiante', key: 'estudiante', width: 26 },
      { header: 'Severidad', key: 'sev', width: 14 },
      { header: 'Descripción', key: 'desc', width: 55 },
      { header: 'Evidencia', key: 'evidencia', width: 40 },
    ];
    headerStyle(s4.getRow(1));
    alerts.forEach((a, i) => {
      const row = s4.addRow({
        fecha: fmt(a.timestamp),
        examen: a.exam_title ?? '',
        asignatura: a.exam_subject ?? '',
        estudiante: a.student_name ?? '',
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
    if (Number(stats.total_alerts) > ALERTS_LIMIT) {
      s4.addRow({});
      s4.addRow({ fecha: `Nota: se muestran las ${ALERTS_LIMIT} alertas más recientes de ${stats.total_alerts} en total.` });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="reporte_global_proctoteam.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[Report/admin] error generando Excel:', error?.message ?? error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error al generar el reporte' }, { status: 500 });
  }
}
