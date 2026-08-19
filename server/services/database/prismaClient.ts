import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type pg from 'pg';

type DatabaseProvider = 'neon' | 'supabase' | 'postgresql' | 'unknown';
type DatabaseMode = 'pooled' | 'direct' | 'unknown';

function detectDatabaseProvider(hostname: string): DatabaseProvider {
  if (!hostname) return 'unknown';
  if (hostname.endsWith('.neon.tech')) return 'neon';
  if (hostname.includes('supabase.co') || hostname.includes('supabase.com')) return 'supabase';
  return 'postgresql';
}

function detectDatabaseMode(hostname: string): DatabaseMode {
  if (!hostname) return 'unknown';
  if (hostname.includes('-pooler.') || hostname.includes('.pooler.supabase.')) return 'pooled';
  return 'direct';
}

function normalizeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  const usePooler = process.env.DATABASE_USE_POOLER?.trim().toLowerCase() !== 'false';
  if (!raw) return '';

  try {
    const databaseUrl = new URL(raw);
    const provider = detectDatabaseProvider(databaseUrl.hostname);
    const [endpoint, ...domainParts] = databaseUrl.hostname.split('.');
    if (provider === 'neon' && usePooler && endpoint && !endpoint.endsWith('-pooler')) {
      databaseUrl.hostname = [`${endpoint}-pooler`, ...domainParts].join('.');
    }
    if ((provider === 'neon' || provider === 'supabase') && !databaseUrl.searchParams.has('sslmode')) {
      databaseUrl.searchParams.set('sslmode', 'require');
    }
    if (!databaseUrl.searchParams.has('connect_timeout')) {
      databaseUrl.searchParams.set('connect_timeout', process.env.DATABASE_CONNECT_TIMEOUT_SECONDS || '10');
    }
    if (!databaseUrl.searchParams.has('pool_timeout')) {
      databaseUrl.searchParams.set('pool_timeout', process.env.DATABASE_POOL_TIMEOUT_SECONDS || '10');
    }
    if (!databaseUrl.searchParams.has('connection_limit')) {
      const defaultConnectionLimit = provider === 'supabase' && process.env.NODE_ENV === 'production' ? '1' : '5';
      databaseUrl.searchParams.set('connection_limit', process.env.DATABASE_CONNECTION_LIMIT || defaultConnectionLimit);
    }
    process.env.DATABASE_URL = databaseUrl.toString();
    return process.env.DATABASE_URL;
  } catch {
    return raw;
  }
}

function buildPgAdapterConfig(connectionString: string): { config: pg.PoolConfig; schema: string } {
  const databaseUrl = new URL(connectionString);
  const schema = databaseUrl.searchParams.get('schema') || 'public';
  const sslMode = databaseUrl.searchParams.get('sslmode');
  const connectionLimit = Number(databaseUrl.searchParams.get('connection_limit') || process.env.DATABASE_CONNECTION_LIMIT || 5);
  const connectTimeout = Number(databaseUrl.searchParams.get('connect_timeout') || process.env.DATABASE_CONNECT_TIMEOUT_SECONDS || 8);

  for (const key of [
    'schema',
    'connection_limit',
    'pool_timeout',
    'channel_binding',
    'connect_timeout',
    'sslmode',
    'pgbouncer',
    'statement_cache_size'
  ]) {
    databaseUrl.searchParams.delete(key);
  }

  return {
    schema,
    config: {
      connectionString: databaseUrl.toString(),
      max: connectionLimit,
      connectionTimeoutMillis: connectTimeout * 1000,
      idleTimeoutMillis: 30_000,
      ssl: sslMode === 'disable' ? false : { rejectUnauthorized: true }
    }
  };
}

export function createPrismaClient() {
  const connectionString = normalizeDatabaseUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL es requerido para conectar la base de datos.');
  }
  const { config, schema } = buildPgAdapterConfig(connectionString);
  const adapter = new PrismaPg(config, {
    schema,
    onPoolError(error) {
      console.error('[database:pool]', error.message);
    },
    onConnectionError(error) {
      console.error('[database:connection]', error.message);
    }
  });
  return new PrismaClient({ adapter });
}

export function getRuntimeDatabaseHost() {
  try {
    return new URL(process.env.DATABASE_URL || '').hostname;
  } catch {
    return '';
  }
}

export function getRuntimeDatabaseInfo() {
  const host = getRuntimeDatabaseHost();
  return {
    host,
    provider: detectDatabaseProvider(host),
    mode: detectDatabaseMode(host)
  };
}
