# Plan técnico — Tiering de grabaciones a Cloudflare R2

> Objetivo: que Supabase Storage guarde solo la **evidencia caliente** (últimos X días) y
> que las grabaciones más viejas vivan en **Cloudflare R2** hasta cumplir la **retención de 6 meses**,
> con reproducción transparente y borrado automático al vencer. Ver costos en
> `Estimacion_Storage_ProctoTeam_UGM.xlsx`.

## Estado actual (verificado en el código)

- **Se graba solo la webcam** (640×480, VP8/opus, ~0.432 Mbps) en chunks de 15 s.
  `src/components/proctoring/StudentCam.tsx`
- **Subida** → Supabase Storage, bucket `evidences`, clave `recordings/<participationId>/<index>.webm`.
  `src/app/api/exam/recording/route.ts` (POST)
- **Reproducción** → el mismo endpoint (GET) lista la carpeta y devuelve URLs firmadas (1 h);
  el cliente descarga los chunks en orden y los concatena.
- **Borrado por usuario** (derecho al olvido) → `src/lib/storage-cleanup.ts` (`deleteUserStorage`).
- **Cron** → `vercel.json` tiene 1 cron diario (`/api/cron/auto-close`, `0 6 * * *`).
  Plan **Hobby**: los crons deben ser **diarios** y hay un cupo limitado (~2). Con este plan quedamos en 2.

## Decisión de arquitectura

- **No tocar la escritura durante el examen.** Sigue subiendo a Supabase (baja latencia, resiliente,
  ya probado). R2 es solo para archivo frío.
- **Un cron diario migra** lo que ya cumplió `X días` de Supabase → R2 y lo borra de Supabase.
- **La reproducción decide el origen** por un flag en la participación (`recording_storage`).
- R2 es **S3-compatible** → se reutiliza casi toda la lógica actual (listar + firmar + concatenar),
  solo cambia el cliente.

**X recomendado: 7 días** (configurable por env `RECORDING_HOT_DAYS`). Con ~58 GB/mes de entrada,
Supabase sostiene solo ~13–14 GB en caliente en régimen → muy por debajo de los 100 GB incluidos.

## Componentes a construir

### 1. Infra / env (Cloudflare)
- Crear bucket R2 `proctoteam-evidences`.
- Crear API Token R2 (Access Key ID + Secret).
- Env vars (Vercel · producción y preview):
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET=proctoteam-evidences`
  - `R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`
  - `RECORDING_HOT_DAYS=7`
- Dep: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.

### 2. Migración de esquema (DDL vía SQL editor de Supabase)
```sql
ALTER TABLE exam_participations
  ADD COLUMN IF NOT EXISTS recording_storage text NOT NULL DEFAULT 'supabase',  -- 'supabase' | 'r2' | 'purged'
  ADD COLUMN IF NOT EXISTS recording_migrated_at timestamptz;
-- Confirmar la columna de "fin de examen" para calcular la antigüedad
-- (finished_at / ended_at / created_at). El cron filtra por esa fecha.
```

### 3. Cliente R2 — `src/lib/r2.ts`
Wrapper S3 con la misma interfaz que usamos hoy: `putObject`, `listObjects`, `createSignedUrl` (presigner),
`deleteObjects`. Devuelve `null`/no-throw si falta config (igual patrón que el helper de Supabase).

### 4. Cron de migración — `src/app/api/cron/migrate-recordings/route.ts`
- Auth: mismo patrón que `auto-close` (`Authorization: Bearer $CRON_SECRET`).
- `maxDuration` alto (p. ej. 300) y **procesar por lote** (ej. 20 participaciones/corrida) → idempotente.
- Por cada participación con `recording_storage='supabase'` y `fin < now() - RECORDING_HOT_DAYS`:
  1. Listar `recordings/<pid>/*.webm` en Supabase.
  2. Descargar cada chunk y subirlo a R2 con **la misma clave** (no hace falta concatenar).
  3. Verificar tamaños/conteo. Si OK → borrar de Supabase.
  4. `UPDATE ... SET recording_storage='r2', recording_migrated_at=now()`.
- Registrar en `vercel.json` un cron diario:
  ```json
  { "path": "/api/cron/migrate-recordings", "schedule": "30 6 * * *" }
  ```

### 5. Reproducción — actualizar `src/app/api/exam/recording/route.ts` (GET)
- Leer `recording_storage` de la participación.
- `'r2'` → firmar desde R2 (`getSignedUrl` del presigner). `'supabase'` → ruta actual.
- El contrato con el cliente **no cambia**: sigue recibiendo un array de URLs firmadas.

### 6. Purga a los 6 meses (retención)
- Extender el cron (o uno nuevo diario si el cupo Hobby lo permite) para borrar de R2 lo que supere
  `finished_at < now() - 6 months` y marcar `recording_storage='purged'`.
- Alternativa nativa: **regla de lifecycle de R2** a 180 días sobre el prefijo `recordings/`
  (más simple, sin código) + un job que solo actualice el flag en DB.

### 7. Borrado por usuario — `src/lib/storage-cleanup.ts`
- Extender `deleteUserStorage` para borrar también en R2 (intentar en ambos según `recording_storage`).

## Consideraciones

- **Egress de migración**: leer 58 GB/mes desde Supabase entra en los 250 GB/mes incluidos del Pro.
- **Costo R2**: egress gratis → reproducir evidencia no genera cargos por banda.
- **Riesgo de pérdida**: borrar de Supabase **solo tras confirmar** subida a R2 (verificar conteo/tamaño).
- **Rollback**: mientras `recording_storage='supabase'` no se toca nada; migración gradual y reversible.

## Plan de pruebas
1. Preview env con bucket R2 de prueba.
2. Migrar 1 participación de prueba → verificar reproducción desde R2 y borrado en Supabase.
3. Verificar expiración de URLs firmadas y permisos (solo docente dueño / admin).
4. Simular fallo a mitad de subida → confirmar que NO borra de Supabase (idempotencia).

## Orden sugerido de implementación
1. Env + `@aws-sdk/client-s3` + `src/lib/r2.ts`.
2. Migración DDL (flags).
3. GET de reproducción con doble origen (aún todo en Supabase → sin efecto).
4. Cron de migración + entrada en `vercel.json`.
5. Purga a 6 meses (lifecycle R2 o cron).
6. Extender `deleteUserStorage`.
