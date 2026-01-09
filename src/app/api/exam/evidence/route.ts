import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { Storage } from '@google-cloud/storage';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

const storage = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

async function uploadToObjectStorage(
  base64Image: string,
  filename: string
): Promise<string> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    throw new Error('PRIVATE_OBJECT_DIR not configured');
  }

  const parts = privateDir.split('/').filter(Boolean);
  const bucketName = parts[0];
  const prefix = parts.slice(1).join('/');

  const bucket = storage.bucket(bucketName);
  const objectPath = `${prefix}/evidence/${filename}`;
  const file = bucket.file(objectPath);

  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  await file.save(buffer, {
    metadata: {
      contentType: 'image/jpeg',
    },
  });

  return `/${bucketName}/${objectPath}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const body = await request.json();
    const { 
      participationId, 
      alertType, 
      severity = 'medium', 
      description, 
      snapshot 
    } = body;

    if (!participationId || !alertType) {
      return NextResponse.json(
        { error: 'participationId y alertType son requeridos' },
        { status: 400 }
      );
    }

    const participation = await db.query(
      `SELECT ep.id, ep.student_id, es.id as exam_id
       FROM exam_participations ep
       JOIN exam_sessions es ON ep.exam_session_id = es.id
       WHERE ep.id = $1`,
      [participationId]
    );

    if (participation.rowCount === 0) {
      return NextResponse.json(
        { error: 'Participación no encontrada' },
        { status: 404 }
      );
    }

    let evidenceUrl: string | null = null;

    if (snapshot) {
      const timestamp = Date.now();
      const filename = `${participationId}_${alertType}_${timestamp}.jpg`;
      evidenceUrl = await uploadToObjectStorage(snapshot, filename);
    }

    const result = await db.query(
      `INSERT INTO exam_alerts (
        participation_id,
        alert_type,
        severity,
        description,
        evidence_url,
        timestamp
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, alert_type, severity, description, evidence_url, timestamp`,
      [participationId, alertType, severity, description, evidenceUrl]
    );

    const alert = result.rows[0];

    return NextResponse.json({
      success: true,
      alert: {
        id: alert.id,
        alertType: alert.alert_type,
        severity: alert.severity,
        description: alert.description,
        evidenceUrl: alert.evidence_url,
        timestamp: alert.timestamp,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error guardando evidencia:', error);

    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (user.role !== 'instructor' && user.role !== 'super-admin') {
      return NextResponse.json(
        { error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const participationId = searchParams.get('participationId');

    let query = `
      SELECT 
        ea.id,
        ea.participation_id,
        ea.alert_type,
        ea.severity,
        ea.description,
        ea.evidence_url,
        ea.timestamp,
        ea.reviewed,
        ea.reviewed_by,
        ea.reviewed_at,
        ep.student_name
      FROM exam_alerts ea
      JOIN exam_participations ep ON ea.participation_id = ep.id
    `;

    const params: string[] = [];

    if (participationId) {
      params.push(participationId);
      query += ` WHERE ea.participation_id = $${params.length}`;
    } else if (examId) {
      params.push(examId);
      query += ` JOIN exam_sessions es ON ep.exam_session_id = es.id WHERE es.id = $${params.length}`;
    }

    query += ' ORDER BY ea.timestamp DESC';

    const result = await db.query(query, params);

    return NextResponse.json({
      alerts: result.rows.map(row => ({
        id: row.id,
        participationId: row.participation_id,
        studentName: row.student_name,
        alertType: row.alert_type,
        severity: row.severity,
        description: row.description,
        evidenceUrl: row.evidence_url,
        timestamp: row.timestamp,
        reviewed: row.reviewed,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
      })),
    });

  } catch (error: any) {
    console.error('Error obteniendo alertas:', error);

    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
