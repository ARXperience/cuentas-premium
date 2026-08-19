# Supabase Setup

Esta carpeta documenta la preparacion de Supabase para Centro Digital.

Proyecto creado:

```text
https://nkcfusvgbyhaptdohjga.supabase.co
```

Project ref:

```text
nkcfusvgbyhaptdohjga
```

## 1. Crear Proyecto

En Supabase crea un proyecto PostgreSQL nuevo. Guarda la contrasena de la base de datos; la vas a necesitar en las cadenas de conexion.

## 2. Copiar URLs

Desde `Project Settings > Database > Connection string` copia:

- `Transaction pooler`: va en Hostinger como `DATABASE_URL`.
- `Direct connection`: va en tu computador como `DIRECT_DATABASE_URL` para migraciones.

Ejemplo Hostinger:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"
DATABASE_PROVIDER="supabase"
DATABASE_USE_POOLER="false"
DATABASE_CONNECTION_LIMIT="1"
DATABASE_SSL_REJECT_UNAUTHORIZED="false"
```

Ejemplo local para migrar:

```env
DIRECT_DATABASE_URL="postgresql://postgres:DB_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
```

Para este proyecto, cambia solo `DB_PASSWORD` y `REGION`:

```env
DATABASE_URL="postgresql://postgres.nkcfusvgbyhaptdohjga:DB_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_DATABASE_URL="postgresql://postgres:DB_PASSWORD@db.nkcfusvgbyhaptdohjga.supabase.co:5432/postgres?sslmode=require"
```

Si Supabase muestra la region `us-west-2`, el host correcto debe quedar asi:

```env
DATABASE_URL="postgresql://postgres.nkcfusvgbyhaptdohjga:DB_PASSWORD@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require"
```

No uses `us-west-2.pooler.supabase.com` sin el prefijo `aws-0-`.
En Hostinger usa `DATABASE_SSL_REJECT_UNAUTHORIZED="false"` si `/api/health` muestra `self-signed certificate in certificate chain`.

## 3. Preparar La Base

En la carpeta del proyecto:

```bash
copy .env.supabase.example .env
npm install
npm run db:supabase:deploy
```

El comando aplica migraciones, genera Prisma, carga productos base si faltan y crea usuarios iniciales si estan configurados.

## 3.1. Recuperacion Si Supabase Esta Vacio

Si `/api/health` conecta pero los logs muestran errores como:

```text
The table public.users does not exist
The table public.app_settings does not exist
```

la aplicacion esta apuntando a una base nueva sin migraciones. Tienes dos opciones.

Opcion recomendada desde Hostinger:

1. En variables de entorno deja `DATABASE_URL` apuntando al pooler de Supabase.
2. Agrega temporalmente:

```env
RUN_STARTUP_DB_SETUP="true"
SKIP_STARTUP_DB_SETUP="false"
CLIENT_NAME="Servimil"
CLIENT_EMAIL="cliente@centrodigital.local"
CLIENT_CODE="1111"
PROVIDER_NAME="Proveedor Centro Digital"
PROVIDER_EMAIL="proveedor@centrodigital.local"
PROVIDER_CODE="2222"
ADMIN_NAME="Administrador Centro Digital"
ADMIN_EMAIL="admin@centrodigital.local"
ADMIN_CODE="3333"
```

3. Redespliega una vez. El arranque ejecutara migraciones, productos base y usuarios iniciales.
4. Cuando el deploy quede estable, vuelve a dejar:

```env
RUN_STARTUP_DB_SETUP="false"
SKIP_STARTUP_DB_SETUP="true"
```

Opcion manual desde Supabase:

1. Abre `SQL Editor` en Supabase.
2. Pega y ejecuta `supabase/production-schema.sql`.
3. Luego ejecuta `npm run db:seed` y `npm run bootstrap:production` desde una terminal con `DATABASE_URL` apuntando a Supabase, o usa la opcion recomendada de Hostinger para poblar productos y usuarios.

Nota: `production-schema.sql` crea la estructura. Los productos, codigos de acceso y configuraciones iniciales los cargan `prisma/seed.ts` y `scripts/bootstrap-production.ts`.

## 4. Variables En Hostinger

En Hostinger usa la URL pooler de Supabase como `DATABASE_URL`. No uses la URL directa para runtime.

Tambien configura:

```env
JWT_SECRET="clave-larga-y-segura"
APP_ENCRYPTION_KEY="clave-estable-de-32-caracteres-o-mas"
CORS_ORIGIN="https://cuentas.centrodigitaldediseno.com"
FRONTEND_ORIGIN="https://cuentas.centrodigitaldediseno.com"
```

## 5. Verificar

Despues del deploy abre:

```text
https://cuentas.centrodigitaldediseno.com/api/health
```

Debe mostrar:

```json
{
  "ok": true,
  "database": "connected",
  "databaseProvider": "supabase",
  "databaseMode": "pooled"
}
```
