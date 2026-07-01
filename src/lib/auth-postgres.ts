import { query } from './db';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  nombre: string;
  role: 'student' | 'instructor' | 'super-admin';
  photo_url?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

// Obtener usuario por UID de Azure AD
export async function getUserByUid(uid: string): Promise<UserProfile | null> {
  try {
    const result = await query(
      'SELECT * FROM users WHERE uid = $1',
      [uid]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as UserProfile;
  } catch (error) {
    console.error('Error fetching user by UID:', error);
    throw error;
  }
}

// Obtener usuario por email
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as UserProfile;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error;
  }
}

// Prefijo del uid centinela para usuarios pre-aprovisionados por un admin que
// todavía no han iniciado sesión por SSO. En el primer login real, upsertUser
// reconcilia por email y reemplaza este uid por el `oid` real de Azure.
export const PENDING_UID_PREFIX = 'pending:';

// Helper para determinar el rol al crear un usuario nuevo.
// Todos los usuarios nuevos parten como 'student' por seguridad.
// El super-admin debe promover manualmente a 'instructor' o 'super-admin' desde el panel.
export function determineUserRole(_email: string): 'student' {
  return 'student';
}

// Crear o actualizar usuario (upsert) reconciliando por uid de Azure y por email.
export async function upsertUser(userData: {
  uid: string;
  email: string;
  nombre: string;
  photo_url?: string;
}): Promise<UserProfile> {
  try {
    const emailLower = userData.email.toLowerCase().trim();

    // 1. Usuario recurrente: ya existe una fila con este uid de Azure.
    //    Actualizamos datos de contacto y PRESERVAMOS su rol.
    const existingByUid = await getUserByUid(userData.uid);
    if (existingByUid) {
      const updated = await query(
        `UPDATE users
            SET email = $2, nombre = $3, photo_url = COALESCE($4, photo_url), updated_at = NOW()
          WHERE uid = $1
        RETURNING *`,
        [userData.uid, emailLower, userData.nombre, userData.photo_url ?? null]
      );
      return updated.rows[0] as UserProfile;
    }

    // 2. Primer login real de un usuario PRE-APROVISIONADO por el admin.
    //    Reconciliamos por email: adoptamos el uid real de Azure y CONSERVAMOS
    //    el rol asignado por el admin (docente/estudiante/super-admin).
    const existingByEmail = await getUserByEmail(emailLower);
    if (existingByEmail && existingByEmail.uid.startsWith(PENDING_UID_PREFIX)) {
      const claimed = await query(
        `UPDATE users
            SET uid = $1, nombre = $2, photo_url = COALESCE($3, photo_url), updated_at = NOW()
          WHERE email = $4
        RETURNING *`,
        [userData.uid, userData.nombre, userData.photo_url ?? null, emailLower]
      );
      return claimed.rows[0] as UserProfile;
    }

    // 3. Usuario totalmente nuevo: se registra como 'student' por defecto.
    const finalRole = determineUserRole(emailLower);
    const inserted = await query(
      `INSERT INTO users (uid, email, nombre, role, photo_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [userData.uid, emailLower, userData.nombre, finalRole, userData.photo_url || null]
    );

    return inserted.rows[0] as UserProfile;
  } catch (error) {
    console.error('Error upserting user:', error);
    throw error;
  }
}

// Crea un usuario PRE-APROVISIONADO por el super-admin (aún sin login SSO).
// Guarda un uid centinela "pending:<email>"; en el primer login real por
// Microsoft, upsertUser lo reconcilia por email y adopta el oid real de Azure
// conservando este rol. El usuario debe entrar con su cuenta institucional para
// activarse (no hay contraseña propia: la autenticación es SSO).
export async function createManagedUser(data: {
  email: string;
  nombre: string;
  role: 'student' | 'instructor' | 'super-admin';
}): Promise<UserProfile> {
  const emailLower = data.email.toLowerCase().trim();
  const pendingUid = `${PENDING_UID_PREFIX}${emailLower}`;

  const result = await query(
    `INSERT INTO users (uid, email, nombre, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING *`,
    [pendingUid, emailLower, data.nombre.trim(), data.role]
  );

  return result.rows[0] as UserProfile;
}

// Actualizar rol de usuario
export async function updateUserRole(
  uid: string,
  role: 'student' | 'instructor' | 'super-admin'
): Promise<void> {
  try {
    await query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE uid = $2',
      [role, uid]
    );
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

// Obtener todos los usuarios por rol
export async function getUsersByRole(role: 'student' | 'instructor' | 'super-admin'): Promise<UserProfile[]> {
  try {
    const result = await query(
      'SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC',
      [role]
    );

    return result.rows as UserProfile[];
  } catch (error) {
    console.error('Error fetching users by role:', error);
    throw error;
  }
}