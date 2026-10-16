-- =============================================================================
-- service_role puede leer/escribir las tablas de `proctoteam` por PostgREST.
-- La app no lo necesita (usa exec_sql o conexion directa), pero los scripts de
-- diagnostico (scripts/check-user.cjs, promote-user.cjs, verify-rls.cjs) usan
-- supabase-js `.from('users')` con la secret key.
-- anon/authenticated siguen SIN acceso (ni USAGE sobre el schema).
-- Idempotente. Ejecutar como `postgres`.
-- =============================================================================
SET ROLE proctoteam_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA proctoteam TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA proctoteam
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
RESET ROLE;
NOTIFY pgrst, 'reload schema';
