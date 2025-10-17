# Database Setup

## PostgreSQL Schema

Este directorio contiene el esquema de base de datos PostgreSQL para UGM Proctor.

## Inicialización

Para inicializar la base de datos en un nuevo entorno:

```bash
# Conectarse a PostgreSQL de Replit
psql $DATABASE_URL -f database/schema.sql
```

O usar el comando npm:

```bash
npm run db:init
```

## Estructura de la Base de Datos

### Tablas

1. **users** - Perfiles de usuario con autenticación Azure AD
   - Campos: id, uid, email, nombre, role, photo_url, created_at, updated_at
   - Roles: 'student', 'instructor', 'super-admin'

2. **exam_sessions** - Sesiones de examen creadas por instructores
   - Campos: id, title, subject, section, duration, access_code, instructor_id, instructor_name, status, students, blocked_students, created_at, updated_at
   - Estados: 'pending', 'active', 'finished'

3. **alerts** - Alertas de proctoring generadas durante los exámenes
   - Campos: id, exam_session_id, student_id, student_name, severity, description, timestamp
   - Relación: FK a exam_sessions

4. **student_details** - Detalles de finalización de sesiones de estudiantes
   - Campos: id, exam_session_id, student_id, student_name, start_time, finish_time, created_at
   - Relación: FK a exam_sessions

### Índices

Todos los índices están definidos en `schema.sql` para optimizar las consultas frecuentes:

- Búsquedas por UID y email en users
- Búsquedas por código de acceso y instructor en exam_sessions
- Búsquedas por sesión en alerts y student_details

## Variables de Entorno Requeridas

```bash
DATABASE_URL=postgresql://...
PGHOST=...
PGPORT=...
PGUSER=...
PGPASSWORD=...
PGDATABASE=...
```

Estas variables están automáticamente disponibles en Replit PostgreSQL.

## Migraciones

Este proyecto NO usa migraciones manuales. El esquema se define en `schema.sql` y se aplica directamente.

Para cambios en el esquema:
1. Editar `schema.sql`
2. Ejecutar `psql $DATABASE_URL -f database/schema.sql`
3. O usar `npm run db:init`

## Seguridad

- Todas las APIs requieren autenticación con Firebase/Azure AD tokens
- Verificación de roles implementada en cada endpoint
- Políticas de acceso basadas en roles (RBAC)
