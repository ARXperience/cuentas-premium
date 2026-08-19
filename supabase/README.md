# Supabase Setup

Esta carpeta documenta la preparacion de Supabase para Centro Digital.

Proyecto creado:

```text
https://deqdxwvnjrwwzfhkmeng.supabase.co
```

Project ref:

```text
deqdxwvnjrwwzfhkmeng
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
```

Ejemplo local para migrar:

```env
DIRECT_DATABASE_URL="postgresql://postgres:DB_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
```

Para este proyecto, cambia solo `DB_PASSWORD` y `REGION`:

```env
DATABASE_URL="postgresql://postgres.deqdxwvnjrwwzfhkmeng:DB_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_DATABASE_URL="postgresql://postgres:DB_PASSWORD@db.deqdxwvnjrwwzfhkmeng.supabase.co:5432/postgres?sslmode=require"
```

## 3. Preparar La Base

En la carpeta del proyecto:

```bash
copy .env.supabase.example .env
npm install
npm run db:supabase:deploy
```

El comando aplica migraciones, genera Prisma, carga productos base si faltan y crea usuarios iniciales si estan configurados.

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
