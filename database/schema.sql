-- UGM Proctor - PostgreSQL Schema
-- Versión: 2.1 (Completa: Normalizada + Mensajería + Snapshots)

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tabla de Usuarios (Centralizada)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL, -- ID proveniente de Azure AD
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor', 'super-admin')),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. Tabla de Sesiones de Examen
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  section TEXT NOT NULL,
  duration INTEGER NOT NULL, -- Duración en minutos
  access_code TEXT UNIQUE NOT NULL,

  -- Relación con el instructor (usando el UID de Azure)
  instructor_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  instructor_name TEXT, 

  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'finished')) DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para sesiones
CREATE INDEX IF NOT EXISTS idx_exam_sessions_code ON exam_sessions(access_code);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_instructor ON exam_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);

-- 4. Tabla de Participación 
-- Esta tabla gestiona individualmente a cada alumno dentro de un examen
CREATE TABLE IF NOT EXISTS exam_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  student_name TEXT NOT NULL,

  -- Estado individual del alumno
  status TEXT NOT NULL CHECK (status IN ('joined', 'in-progress', 'submitted', 'blocked')) DEFAULT 'joined',

  -- Tiempos precisos
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,

  -- Auditoría visual y de conexión
  last_snapshot TEXT, -- Base64 o URL de la última foto del alumno (NUEVO)
  ip_address TEXT,
  user_agent TEXT,

  -- Evitar que un alumno entre dos veces al mismo examen
  UNIQUE(exam_session_id, student_id)
);

-- Índices para participaciones
CREATE INDEX IF NOT EXISTS idx_participations_session ON exam_participations(exam_session_id);
CREATE INDEX IF NOT EXISTS idx_participations_student ON exam_participations(student_id);

-- 5. Tabla de Alertas
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,

  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT NOT NULL,
  evidence_url TEXT, 

  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para alertas
CREATE INDEX IF NOT EXISTS idx_alerts_session_severity ON alerts(exam_session_id, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_student ON alerts(student_id);

-- 6. Tabla de Mensajes (Chat Profesor -> Alumno) (NUEVO)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,

  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mensajes
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(student_id) WHERE is_read = FALSE;

-- Comentarios para documentación automática
COMMENT ON TABLE users IS 'Registro central de usuarios autenticados vía Azure AD';
COMMENT ON TABLE exam_sessions IS 'Configuración general de los exámenes';
COMMENT ON TABLE exam_participations IS 'Registro individual de cada alumno en un examen';
COMMENT ON COLUMN exam_participations.last_snapshot IS 'Última imagen capturada del estudiante (persistencia ligera)';
COMMENT ON TABLE alerts IS 'Incidencias de proctoring detectadas por la IA o el sistema';
COMMENT ON TABLE messages IS 'Comunicación unidireccional o bidireccional durante el examen';