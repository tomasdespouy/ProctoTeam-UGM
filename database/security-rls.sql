-- ============================================================================
-- Hardening de seguridad — Supabase linter (RLS + exec_sql)
-- ProctoTeam UGM
--
-- Ejecutar en: Supabase Studio → SQL Editor (o psql con la DATABASE_URL).
-- Seguro de re-ejecutar (idempotente).
--
-- Contexto: TODO el acceso server-side usa la conexión Postgres directa
-- (rol `postgres`, BYPASSRLS) o la service_role key (BYPASSRLS). Ambos ignoran
-- RLS, así que activar RLS sin políticas NO rompe el backend; solo cierra el
-- acceso directo de `anon`/`authenticated` vía PostgREST.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) CRÍTICO: cerrar exec_sql al público.
--    La clave anon es pública (NEXT_PUBLIC_), por lo que exec_sql expuesto a
--    `anon` = ejecución de SQL arbitrario por cualquiera en internet.
--    El servidor lo invoca con service_role, así que solo ese rol lo conserva.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.exec_sql(text, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text, text[]) FROM authenticated;

-- El fallback REST de src/lib/db.ts depende de esto (service_role):
GRANT EXECUTE ON FUNCTION public.exec_sql(text, text[]) TO service_role;

-- ----------------------------------------------------------------------------
-- 2) Activar Row Level Security en las 6 tablas marcadas por el linter.
--    Sin políticas => deny-by-default para anon/authenticated.
--    El backend (postgres / service_role) sigue funcionando por BYPASSRLS.
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_alerts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages            ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Verificación (opcional): correr para confirmar el estado.
--
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('users','exam_sessions','exam_participations',
--                     'exam_alerts','alerts','messages');
--   -- relrowsecurity debe ser true en todas.
--
--   SELECT has_function_privilege('anon', 'public.exec_sql(text, text[])', 'EXECUTE');
--   -- debe devolver false.
-- ============================================================================
