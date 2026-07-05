-- ─────────────────────────────────────────────────────────────────────────────
-- Función exec_sql  (recuperada de la DB en vivo y versionada — auditoría 2026-07)
--
-- La usa el fallback REST de src/lib/db.ts cuando la conexión directa a Postgres
-- no está disponible. Es SECURITY DEFINER (corre como owner, bypass RLS) y está
-- BLOQUEADA: EXECUTE revocado a anon/authenticated, concedido solo a service_role
-- (ver database/security-rls.sql; verificado con scripts/verify-rls.cjs).
--
-- NOTA DE ENDURECIMIENTO (follow-up): sustituye los parámetros por string con
--   replace() + quote_literal() en vez de `EXECUTE ... USING params`. quote_literal
--   escapa los valores (seguro contra inyección por VALOR), pero el patrón es
--   frágil. Migrar a `EXECUTE ... USING` sería más robusto. No es una
--   vulnerabilidad activa dado el lockdown + quote_literal.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.exec_sql(sql_text text, params text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
