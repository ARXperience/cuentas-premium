# Despliegue en Hostinger

Esta plataforma no es una pagina estatica simple. Necesita:

- Backend Node.js/Express.
- PostgreSQL administrado. Recomendado ahora: Supabase.
- Prisma migrations.
- Proceso persistente para WhatsApp Bridge.

Por eso el despliegue recomendado es **Hostinger VPS** o **Hostinger Node.js Web App** si tu plan lo permite. Subir solo `dist/` a `public_html` no sirve para operar el sistema completo.

## Opcion recomendada: Hostinger VPS

### 1. Preparar servidor

En el VPS instala Node.js LTS, npm, PM2 y Nginx. La base recomendada es Supabase PostgreSQL administrado.

```bash
node -v
npm -v
pm2 -v
nginx -v
```

### 2. Subir el proyecto

Sube el ZIP generado por `scripts/build-hostinger-package.ps1` o sube el proyecto por SFTP/Git a:

```bash
/home/USER/premium-accounts-platform
```

No subas:

- `node_modules`
- `.env` con secretos al repositorio
- `.whatsapp-session` vieja si quieres vincular desde cero

### 3. Crear `.env`

Copia:

```bash
cp deploy/hostinger/.env.production.example .env
```

Edita `.env` y completa:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL` si vas a migrar Supabase desde ese servidor
- `JWT_SECRET`
- `APP_ENCRYPTION_KEY`
- `CORS_ORIGIN`
- `FRONTEND_ORIGIN`
- `ADMIN_NOTIFICATION_PHONE`
- SMTP si quieres correo de respaldo

Importante: `ADMIN_NOTIFICATION_PHONE` debe ir en formato internacional, por ejemplo:

```env
ADMIN_NOTIFICATION_PHONE="573001112233"
```

### 4. Instalar dependencias y construir

```bash
npm install
npm run db:generate
npm run build
```

### 5. Migrar base de datos

Si usas Supabase, primero configura `DIRECT_DATABASE_URL` con la conexion directa de Supabase y ejecuta:

```bash
npm run db:supabase:deploy
```

Si usas otra base PostgreSQL administrada:

```bash
npm run db:deploy
```

Si la tabla de productos esta vacia:

```bash
npm run db:seed
```

Si estas preparando una base que tenia pruebas locales y quieres borrar pedidos/datos operativos sin borrar usuarios, productos ni configuracion:

```bash
npm run clear:operational -- --yes
```

Para crear admin/proveedor si no existen:

```bash
npm run create-admin
npm run create-provider
```

### 6. Probar local en el VPS

```bash
NODE_ENV=production PORT=4002 npm run start
```

Abre:

```bash
curl http://127.0.0.1:4002/api/health
```

Debe responder:

```json
{"ok":true}
```

### 7. Configurar PM2

Edita `deploy/hostinger/ecosystem.config.cjs` y cambia:

```js
cwd: '/home/USER/premium-accounts-platform'
```

Luego:

```bash
mkdir -p logs
pm2 start deploy/hostinger/ecosystem.config.cjs
pm2 save
pm2 startup
```

### 8. Configurar Nginx

Copia la plantilla:

```bash
sudo cp deploy/hostinger/nginx-premium-accounts.conf /etc/nginx/sites-available/premium-accounts-platform
sudo ln -s /etc/nginx/sites-available/premium-accounts-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Edita el archivo y cambia `tudominio.com`.

### 9. SSL

Con Certbot:

```bash
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

Luego actualiza `.env`:

```env
CORS_ORIGIN="https://tudominio.com"
FRONTEND_ORIGIN="https://tudominio.com"
```

Reinicia:

```bash
pm2 restart premium-accounts-platform
```

### 10. WhatsApp Bridge

Entra como admin y abre:

```text
WhatsApp admin
```

Escanea el QR.

Recomendacion importante:

- Vincula el Bridge con un numero empresarial/interno.
- Configura `ADMIN_NOTIFICATION_PHONE` con otro numero destino.

Si usas el mismo numero vinculado como destino, WhatsApp puede enviar el mensaje, pero no generar notificacion push.

La carpeta `.whatsapp-session` debe estar en disco persistente. No la borres si no quieres escanear QR otra vez.

## Opcion Hostinger Node.js Web App

Si tu plan muestra la opcion **Node.js Web App**:

1. Sube el repositorio o ZIP.
2. Configura variables de entorno en hPanel. Para Supabase usa `DATABASE_URL` con la URL pooler, no la URL directa.
3. Build command:

```bash
npm install && npm run db:generate && npm run build
```

4. Start command:

```bash
npm run start
```

5. Configura `NODE_ENV=production`.
6. Revisa que el plan permita proceso persistente y escritura en `.whatsapp-session`.

Si el proceso se duerme o no conserva sesion, usa VPS.

### Variables Hostinger Con Supabase

En Hostinger pega estas variables:

```env
NODE_ENV="production"
DATABASE_URL="postgresql://postgres.PROJECT_REF:TU_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"
DATABASE_PROVIDER="supabase"
DATABASE_USE_POOLER="false"
DATABASE_CONNECTION_LIMIT="1"
DATABASE_CONNECT_TIMEOUT_SECONDS="10"
DATABASE_POOL_TIMEOUT_SECONDS="10"
JWT_SECRET="clave-larga-y-segura"
APP_ENCRYPTION_KEY="clave-estable-de-32-caracteres-o-mas"
CORS_ORIGIN="https://cuentas.centrodigitaldediseno.com"
FRONTEND_ORIGIN="https://cuentas.centrodigitaldediseno.com"
VITE_API_URL=""
```

No subas `DIRECT_DATABASE_URL` al frontend. Usala solo para aplicar migraciones desde tu computador o desde una consola segura.

Antes de redeplegar en Hostinger prepara la base desde tu computador:

```bash
copy .env.supabase.example .env
npm install
npm run db:supabase:deploy
```

Luego sube o redepliega el repo. Al abrir:

```text
https://cuentas.centrodigitaldediseno.com/api/health
```

debe aparecer `databaseProvider: "supabase"` y `database: "connected"`.

## Opcion solo frontend

Solo para mostrar la tienda sin backend, API, DB ni WhatsApp:

```bash
npm run build
```

Sube el contenido de `dist/` a `public_html` y agrega `frontend-only.htaccess` como `.htaccess`.

No recomendado para esta plataforma real.

## Checklist final

- `https://tudominio.com/api/health` responde `{"ok":true}`.
- Admin entra con codigo configurado.
- Productos cargan.
- Servimil crea pedido.
- Admin recibe aviso por WhatsApp o correo.
- WhatsApp Bridge queda `connected`.
- `CORS_ORIGIN` usa el dominio real.
- `.whatsapp-session` queda en ruta persistente.
- Base PostgreSQL tiene migraciones aplicadas.
