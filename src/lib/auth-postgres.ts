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

// Crear o actualizar usuario (upsert)
export async function upsertUser(userData: {
  uid: string;
  email: string;
  nombre: string;
  role: 'student' | 'instructor' | 'super-admin';
  photo_url?: string;
}): Promise<UserProfile> {
  try {
    const result = await query(
      `INSERT INTO users (uid, email, nombre, role, photo_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (uid) 
       DO UPDATE SET 
         email = EXCLUDED.email,
         nombre = EXCLUDED.nombre,
         photo_url = EXCLUDED.photo_url,
         updated_at = NOW()
       RETURNING *`,
      [userData.uid, userData.email, userData.nombre, userData.role, userData.photo_url || null]
    );
    
    return result.rows[0] as UserProfile;
  } catch (error) {
    console.error('Error upserting user:', error);
    throw error;
  }
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
