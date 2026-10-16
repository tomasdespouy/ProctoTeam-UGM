-- =============================================================================
-- ProctoTeam UGM -> proyecto Supabase compartido "UGM HUB" (xupfxuwtcrgosxhgpcug)
--
-- Convencion del HUB: cada app vive en su PROPIO schema; nunca se toca `public`.
-- Este script crea:
--   1. Rol `proctoteam_app` (LOGIN) con permisos SOLO sobre el schema `proctoteam`
--      y search_path fijo: la app usa SQL sin prefijo y no ve otras apps.
--   2. Schema `proctoteam` con las tablas (dueno: proctoteam_app).
--   3. `proctoteam.exec_sql` (fallback REST), SECURITY DEFINER con dueno
--      proctoteam_app: aunque se filtre la secret key, no alcanza otros schemas.
--   4. Expone `proctoteam` en PostgREST SIN pisar la lista existente.
--   5. Bucket privado `evidences`.
--
-- La contrasena del rol NO va aqui. Fijarla aparte:
--   ALTER ROLE proctoteam_app PASSWORD '<secreto>';
-- Conexion (pooler, IPv4, modo transaccion):
--   postgresql://proctoteam_app.xupfxuwtcrgosxhgpcug:<secreto>@aws-1-us-west-1.pooler.supabase.com:6543/postgres
--
-- Idempotente. Ejecutar como `postgres` dentro de una transaccion.
-- =============================================================================

-- 1) Rol de la app ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proctoteam_app') THEN
    CREATE ROLE proctoteam_app LOGIN NOINHERIT;
  END IF;
END $$;
ALTER ROLE proctoteam_app SET search_path = proctoteam;
ALTER ROLE proctoteam_app SET statement_timeout = '30s';
GRANT proctoteam_app TO postgres;  -- permite a postgres administrar sus objetos

-- 2) Schema y tablas ----------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS proctoteam AUTHORIZATION proctoteam_app;
REVOKE ALL ON SCHEMA proctoteam FROM PUBLIC;
GRANT USAGE ON SCHEMA extensions TO proctoteam_app;
SET LOCAL ROLE proctoteam_app;
SET LOCAL search_path = proctoteam, extensions;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  role TEXT NOT NULL CONSTRAINT users_role_check
    CHECK (role IN ('student', 'instructor', 'admin', 'super-admin')),
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  section TEXT NOT NULL,
  duration INTEGER NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  instructor_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  instructor_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished')),
  faculty TEXT,
  school TEXT,
  audio_disabled BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_instructor ON exam_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);

CREATE TABLE IF NOT EXISTS exam_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'in-progress', 'submitted', 'blocked')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  last_snapshot TEXT,
  ip_address TEXT,
  user_agent TEXT,
  UNIQUE (exam_session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_participations_student ON exam_participations(student_id);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT NOT NULL,
  evidence_url TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_session_severity ON alerts(exam_session_id, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_student ON alerts(student_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(student_id) WHERE is_read = FALSE;

-- RLS deny-by-default para anon/authenticated (el dueno no esta sujeto a RLS).
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;

-- 3) exec_sql (fallback REST) -------------------------------------------------
CREATE OR REPLACE FUNCTION proctoteam.exec_sql(sql_text text, params text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'proctoteam'
AS $function$
  DECLARE
    processed text := sql_text;
    i integer;
    rec record;
    rows jsonb := '[]'::jsonb;
  BEGIN
    FOR i IN REVERSE COALESCE(array_length(params, 1), 0)..1 LOOP
      processed := replace(processed, '$' || i::text, COALESCE(quote_literal(params[i]), 'NULL'));
    END LOOP;

    IF processed ~* '^\s*(INSERT|UPDATE|DELETE)' AND processed !~* 'RETURNING' THEN
      EXECUTE processed;
    ELSE
      FOR rec IN EXECUTE processed LOOP
        rows := rows || jsonb_build_array(row_to_json(rec));
      END LOOP;
    END IF;

    RETURN rows;
  END;
$function$;
RESET ROLE;

REVOKE EXECUTE ON FUNCTION proctoteam.exec_sql(text, text[]) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA proctoteam TO service_role;
GRANT EXECUTE ON FUNCTION proctoteam.exec_sql(text, text[]) TO service_role;

-- 4) Exponer `proctoteam` en PostgREST sin pisar la lista del HUB --------------
DO $$
DECLARE actuales text;
BEGIN
  SELECT replace(cfg, 'pgrst.db_schemas=', '') INTO actuales
    FROM pg_db_role_setting s, LATERAL unnest(s.setconfig) cfg
   WHERE s.setrole = 'authenticator'::regrole AND cfg LIKE 'pgrst.db_schemas=%'
   LIMIT 1;
  IF actuales IS NULL THEN actuales := 'public, graphql_public'; END IF;
  IF actuales NOT LIKE '%proctoteam%' THEN
    EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', actuales || ', proctoteam');
  END IF;
END $$;
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- 5) Bucket privado de evidencias y grabaciones -------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidences', 'evidences', false)
ON CONFLICT (id) DO NOTHING;
