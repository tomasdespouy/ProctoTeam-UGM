-- ============================================================
-- DDL real extraído de la base de datos actual de Replit
-- Fecha: 2026-03-26T04:08:57.543Z
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tablas encontradas: alerts, exam_alerts, exam_participations, exam_sessions, messages, users


-- ── Tabla: alerts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  exam_session_id uuid NOT NULL,
  student_id text NOT NULL,
  severity text NOT NULL,
  description text NOT NULL,
  evidence_url text,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT alerts_severity_check CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])),
  CONSTRAINT alerts_exam_session_id_fkey FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  CONSTRAINT alerts_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT alerts_pkey PRIMARY KEY (id)
);

-- Índices
CREATE INDEX idx_alerts_session_severity ON public.alerts USING btree (exam_session_id, severity);
CREATE INDEX idx_alerts_student ON public.alerts USING btree (student_id);

-- ── Tabla: exam_alerts ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_alerts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  participation_id uuid NOT NULL,
  alert_type text NOT NULL,
  severity text DEFAULT 'medium'::text,
  description text,
  evidence_url text,
  timestamp timestamp with time zone DEFAULT now(),
  reviewed boolean DEFAULT false,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  CONSTRAINT exam_alerts_severity_check CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
  CONSTRAINT exam_alerts_participation_id_fkey FOREIGN KEY (participation_id) REFERENCES exam_participations(id) ON DELETE CASCADE,
  CONSTRAINT exam_alerts_pkey PRIMARY KEY (id)
);

-- ── Tabla: exam_participations ───────────────────────────────
CREATE TABLE IF NOT EXISTS exam_participations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  exam_session_id uuid NOT NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  status text DEFAULT 'joined'::text NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  last_snapshot text,
  ip_address text,
  user_agent text,
  CONSTRAINT exam_participations_status_check CHECK (status = ANY (ARRAY['joined'::text, 'in-progress'::text, 'submitted'::text, 'blocked'::text])),
  CONSTRAINT exam_participations_exam_session_id_fkey FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  CONSTRAINT exam_participations_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT exam_participations_pkey PRIMARY KEY (id),
  CONSTRAINT exam_participations_exam_session_id_student_id_key UNIQUE (exam_session_id, student_id)
);

-- Índices
CREATE INDEX idx_participations_session ON public.exam_participations USING btree (exam_session_id);
CREATE INDEX idx_participations_student ON public.exam_participations USING btree (student_id);

-- Comentarios
COMMENT ON COLUMN exam_participations.last_snapshot IS 'Última imagen capturada del estudiante (persistencia ligera)';

-- ── Tabla: exam_sessions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  section text NOT NULL,
  duration integer NOT NULL,
  access_code text NOT NULL,
  instructor_id text NOT NULL,
  instructor_name text,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exam_sessions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'finished'::text])),
  CONSTRAINT exam_sessions_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_sessions_access_code_key UNIQUE (access_code)
);

-- Índices
CREATE INDEX idx_exam_sessions_code ON public.exam_sessions USING btree (access_code);
CREATE INDEX idx_exam_sessions_instructor ON public.exam_sessions USING btree (instructor_id);
CREATE INDEX idx_exam_sessions_status ON public.exam_sessions USING btree (status);

-- ── Tabla: messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  exam_session_id uuid,
  student_id text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_exam_session_id_fkey FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  CONSTRAINT messages_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);

-- Índices
CREATE INDEX idx_messages_unread ON public.messages USING btree (student_id) WHERE (is_read = false);

-- ── Tabla: users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  uid text NOT NULL,
  email text NOT NULL,
  nombre text NOT NULL,
  role text NOT NULL,
  photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['student'::text, 'instructor'::text, 'super-admin'::text])),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_uid_key UNIQUE (uid)
);

-- Índices
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_role ON public.users USING btree (role);
CREATE INDEX idx_users_uid ON public.users USING btree (uid);

-- ============================================================
-- Fin del dump
-- ============================================================
