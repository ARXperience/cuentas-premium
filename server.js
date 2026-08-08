import { spawnSync } from 'node:child_process';

function runStartupCommand(command, args) {
  const executable = process.platform === 'win32' && command === 'npx' ? 'npx.cmd' : command;
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    throw new Error(`Startup command failed: ${command} ${args.join(' ')}`);
  }
}

function prepareDatabase() {
  const shouldSkip =
    process.env.SKIP_STARTUP_DB_SETUP === 'true' ||
    process.env.NODE_ENV !== 'production' ||
    !process.env.DATABASE_URL;

  if (shouldSkip) return;

  runStartupCommand('npx', ['prisma', 'migrate', 'deploy']);
  runStartupCommand('npx', ['tsx', 'prisma/seed.ts']);
  runStartupCommand('npx', ['tsx', 'scripts/bootstrap-production.ts']);
}

try {
  prepareDatabase();
  void import('./build/server/index.js').catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
