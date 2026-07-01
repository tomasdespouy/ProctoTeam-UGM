import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-middleware';
import { createManagedUser, getUserByEmail, setUserActive, deleteUser } from '@/lib/auth-postgres';
import { isProtectedEmail } from '@/lib/protected-users';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Seleccionamos `active` de forma tolerante: si la columna todavía no existe
    // (migración pendiente), reintentamos sin ella y asumimos active=true.
    const selectUsers = (withActive: boolean) => db.query(`
      SELECT
        u.id,
        u.uid,
        u.email,
        u.nombre,
        u.role,
        ${withActive ? 'u.active,' : 'true AS active,'}
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM exam_sessions es WHERE es.instructor_id = u.uid) AS exams_created
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 200
    `);

    // Reintento robusto: si la consulta con `active` falla por CUALQUIER motivo
    // (típicamente porque la columna aún no está migrada — y en la ruta REST el
    // error NO trae `.code`), reintentamos sin ella. Si el reintento también
    // falla, ese error se propaga al catch externo.
    let result;
    try {
      result = await selectUsers(true);
    } catch (e: any) {
      console.warn('[admin/users] SELECT con `active` falló, reintentando sin ella:', e?.message ?? e);
      result = await selectUsers(false);
    }

    return NextResponse.json({ users: result.rows });
  } catch (error: any) {
    console.error('Admin users API error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { email, nombre, role } = await request.json();
    const validRoles = ['student', 'instructor', 'super-admin'];

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email válido requerido' }, { status: 400 });
    }
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const existing = await getUserByEmail(emailLower);
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese email' },
        { status: 409 }
      );
    }

    const created = await createManagedUser({ email: emailLower, nombre, role });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error: any) {
    console.error('Admin POST user error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    // 23505 = unique_violation (email duplicado, carrera con otra petición)
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { uid, role, active } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: 'uid es requerido' }, { status: 400 });
    }

    // ── Cuenta protegida (super-admin dueño): no se puede degradar ni desactivar ──
    const targetRow = await db.query('SELECT email FROM users WHERE uid = $1', [uid]);
    if (targetRow.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    if (isProtectedEmail(targetRow.rows[0].email)) {
      const isDemotion = (typeof active === 'boolean' && !active) || (typeof role === 'string' && role !== 'super-admin');
      if (isDemotion) {
        return NextResponse.json(
          { error: 'Esta cuenta está protegida (super-admin dueño) y no puede cambiarse de rol ni desactivarse desde el panel.' },
          { status: 403 }
        );
      }
    }

    // ── Rama 1: activar / desactivar cuenta ──────────────────────────────────
    if (typeof active === 'boolean') {
      if (!active) {
        if (uid === user.uid) {
          return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 });
        }
        const check = await db.query(
          `SELECT COUNT(*) FROM users WHERE role = 'super-admin' AND active IS DISTINCT FROM false AND uid != $1`,
          [uid]
        );
        if (parseInt(check.rows[0].count) === 0) {
          return NextResponse.json({ error: 'No puedes desactivar al último super-admin activo' }, { status: 400 });
        }
      }
      try {
        await setUserActive(uid, active);
      } catch (e: any) {
        const missingColumn = e?.code === '42703' || /column .*active.* does not exist/i.test(e?.message ?? '');
        if (missingColumn) {
          return NextResponse.json(
            { error: 'Falta aplicar la migración en la BD: ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;' },
            { status: 503 }
          );
        }
        throw e;
      }
      return NextResponse.json({ user: { uid, active } });
    }

    // ── Rama 2: cambiar rol ──────────────────────────────────────────────────
    const validRoles = ['student', 'instructor', 'super-admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'role válido es requerido' }, { status: 400 });
    }

    // Prevent demoting the last super-admin
    if (role !== 'super-admin') {
      const check = await db.query(
        `SELECT COUNT(*) FROM users WHERE role = 'super-admin' AND uid != $1`,
        [uid]
      );
      if (parseInt(check.rows[0].count) === 0) {
        return NextResponse.json({ error: 'No puedes cambiar el rol del último super-admin' }, { status: 400 });
      }
    }

    const result = await db.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE uid = $2 RETURNING id, uid, email, nombre, role`,
      [role, uid]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ user: result.rows[0] });
  } catch (error: any) {
    console.error('Admin PATCH user error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const uid = new URL(request.url).searchParams.get('uid');
    if (!uid) {
      return NextResponse.json({ error: 'uid es requerido' }, { status: 400 });
    }
    if (uid === user.uid) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
    }

    // No permitir eliminar al último super-admin.
    const check = await db.query(
      `SELECT role, email FROM users WHERE uid = $1`,
      [uid]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    if (isProtectedEmail(check.rows[0].email)) {
      return NextResponse.json(
        { error: 'Esta cuenta está protegida (super-admin dueño) y no puede eliminarse desde el panel.' },
        { status: 403 }
      );
    }
    if (check.rows[0].role === 'super-admin') {
      const others = await db.query(
        `SELECT COUNT(*) FROM users WHERE role = 'super-admin' AND uid != $1`,
        [uid]
      );
      if (parseInt(others.rows[0].count) === 0) {
        return NextResponse.json({ error: 'No puedes eliminar al último super-admin' }, { status: 400 });
      }
    }

    await deleteUser(uid);
    return NextResponse.json({ success: true, uid });
  } catch (error: any) {
    console.error('Admin DELETE user error:', error);
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
