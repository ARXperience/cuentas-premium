import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL || process.env.SUPABASE_DIRECT_DATABASE_URL || '';
const runtimeDatabaseUrl = process.env.DATABASE_URL || '';
const migrationDatabaseUrl = directDatabaseUrl || runtimeDatabaseUrl;
const allowPoolerMigrations = process.env.ALLOW_SUPABASE_POOLER_MIGRATIONS === 'true';

function parseHost(connectionString: string) {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return '';
  }
}

function commandName(command: string) {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(commandName(command), args, {
    env,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!migrationDatabaseUrl) {
  console.error('DATABASE_URL o DIRECT_DATABASE_URL es requerido para preparar Supabase.');
  process.exit(1);
}

const migrationHost = parseHost(migrationDatabaseUrl);
if (migrationHost.includes('.pooler.supabase.') && !allowPoolerMigrations) {
  console.error('Para migraciones de Supabase usa DIRECT_DATABASE_URL, no la URL pooler.');
  console.error('Copia la cadena directa tipo db.PROJECT_REF.supabase.co:5432 y vuelve a ejecutar npm run db:supabase:deploy.');
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: migrationDatabaseUrl,
  DATABASE_USE_POOLER: 'false'
};

console.log(`Preparando Supabase con conexion de migracion: ${migrationHost || 'host desconocido'}`);
run('npx', ['prisma', 'migrate', 'deploy'], env);
run('npx', ['prisma', 'generate'], env);
run('npx', ['tsx', 'prisma/seed.ts'], env);
run('npx', ['tsx', 'scripts/bootstrap-production.ts'], env);

console.log('Supabase quedo preparado. En Hostinger usa DATABASE_URL con la URL pooler de Supabase.');
