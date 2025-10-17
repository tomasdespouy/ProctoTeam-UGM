-- UGM Proctor - PostgreSQL Schema
-- Este archivo contiene el esquema completo de la base de datos

-- Habilitar extensión para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor', 'super-admin')),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas en users
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Tabla de sesiones de examen
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  section TEXT NOT NULL,
  duration INTEGER NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  instructor_id TEXT NOT NULL,
  instructor_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'finished')) DEFAULT 'pending',
  students TEXT[] DEFAULT '{}',
  blocked_students JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para exam_sessions
CREATE INDEX IF NOT EXISTS idx_exam_sessions_access_code ON exam_sessions(access_code);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_instructor ON exam_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);

-- Tabla de alertas (relacionada con exam_sessions)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para alerts
CREATE INDEX IF NOT EXISTS idx_alerts_session ON alerts(exam_session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_student ON alerts(student_id);

-- Tabla de detalles de estudiantes (relacionada con exam_sessions)
CREATE TABLE IF NOT EXISTS student_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  start_time BIGINT NOT NULL,
  finish_time BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para student_details
CREATE INDEX IF NOT EXISTS idx_student_details_session ON student_details(exam_session_id);

-- Comentarios para documentación
COMMENT ON TABLE users IS 'Usuarios del sistema con roles y autenticación Azure AD';
COMMENT ON COLUMN users.uid IS 'UID de Azure AD/Firebase para SSO';
COMMENT ON COLUMN users.role IS 'Rol del usuario: student, instructor, o super-admin';

COMMENT ON TABLE exam_sessions IS 'Sesiones de examen creadas por instructores';
COMMENT ON TABLE alerts IS 'Alertas generadas durante las sesiones de examen';
COMMENT ON TABLE student_details IS 'Detalles de finalización de sesiones de estudiantes';
