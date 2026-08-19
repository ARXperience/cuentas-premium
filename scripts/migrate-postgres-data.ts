import 'dotenv/config';
import crypto from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.NEON_DATABASE_URL || '';
const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '';

const tables = [
  'orders',
  'client_wallets',
  'provider_payment_configs',
  'provider_payouts',
  'payments',
  'order_items',
  'wallet_movements',
  'delivered_accounts',
  'movements',
  'notifications',
  'whatsapp_outbox',
  'whatsapp_inbound_messages',
  'delivery_drafts'
];

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function makeClient(connectionString: string) {
  return new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000
  });
}

async function getColumns(client: pg.Client, table: string) {
  const result = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

function insertSqlFor(table: string, columns: string[]) {
  const columnSql = columns.map(quoteIdentifier).join(', ');
  const valueSql = columns.map((_, index) => `$${index + 1}`).join(', ');
  return `
    INSERT INTO ${quoteIdentifier(table)} (${columnSql})
    VALUES (${valueSql})
    ON CONFLICT DO NOTHING
  `;
}

async function copyUsers(source: pg.Client, target: pg.Client) {
  const columns = await getColumns(source, 'users');
  const targetColumns = await getColumns(target, 'users');
  const sharedColumns = columns.filter((column) => targetColumns.includes(column));
  const sourceResult = await source.query(`SELECT ${sharedColumns.map(quoteIdentifier).join(', ')} FROM "users"`);
  const userIdMap = new Map<string, string>();
  const insertSql = insertSqlFor('users', sharedColumns);

  let inserted = 0;
  let mapped = 0;
  for (const row of sourceResult.rows) {
    const values = sharedColumns.map((column) => row[column]);
    try {
      const result = await target.query(insertSql, values);
      inserted += result.rowCount || 0;
      if (result.rowCount) {
        userIdMap.set(row.id, row.id);
      } else {
        const existing = await target.query<{ id: string }>(
          'SELECT id FROM "users" WHERE id = $1 OR email = $2 OR access_code = $3 LIMIT 1',
          [row.id, row.email, row.access_code]
        );
        if (!existing.rows[0]) throw new Error(`No se pudo mapear usuario ${row.id}.`);
        userIdMap.set(row.id, existing.rows[0].id);
        mapped += 1;
      }
      continue;
    } catch (error) {
      const existing = await target.query<{ id: string }>(
        'SELECT id FROM "users" WHERE id = $1 OR email = $2 OR access_code = $3 LIMIT 1',
        [row.id, row.email, row.access_code]
      );
      if (!existing.rows[0]) throw error;
      userIdMap.set(row.id, existing.rows[0].id);
      mapped += 1;
    }
  }

  console.log(`- users: ${inserted}/${sourceResult.rows.length} registros copiados, ${mapped} mapeados a usuarios existentes.`);
  return userIdMap;
}

async function copyProducts(source: pg.Client, target: pg.Client) {
  const columns = await getColumns(source, 'products');
  const targetColumns = await getColumns(target, 'products');
  const sharedColumns = columns.filter((column) => targetColumns.includes(column));
  const sourceResult = await source.query(`SELECT ${sharedColumns.map(quoteIdentifier).join(', ')} FROM "products"`);
  const productIdMap = new Map<string, string>();
  const insertSql = insertSqlFor('products', sharedColumns);

  let inserted = 0;
  let mapped = 0;
  for (const row of sourceResult.rows) {
    const values = sharedColumns.map((column) => row[column]);
    try {
      const result = await target.query(insertSql, values);
      inserted += result.rowCount || 0;
      if (result.rowCount) {
        productIdMap.set(row.id, row.id);
      } else {
        const existing = await target.query<{ id: string }>(
          'SELECT id FROM "products" WHERE id = $1 OR name = $2 LIMIT 1',
          [row.id, row.name]
        );
        if (!existing.rows[0]) throw new Error(`No se pudo mapear producto ${row.id}.`);
        productIdMap.set(row.id, existing.rows[0].id);
        mapped += 1;
      }
      continue;
    } catch (error) {
      const existing = await target.query<{ id: string }>(
        'SELECT id FROM "products" WHERE id = $1 OR name = $2 LIMIT 1',
        [row.id, row.name]
      );
      if (!existing.rows[0]) throw error;
      productIdMap.set(row.id, existing.rows[0].id);
      mapped += 1;
    }
  }

  console.log(`- products: ${inserted}/${sourceResult.rows.length} registros copiados, ${mapped} mapeados a productos existentes.`);
  return productIdMap;
}

async function copyAppSettings(source: pg.Client, target: pg.Client) {
  const sourceResult = await source.query('SELECT key, value, private, updated_at FROM "app_settings"');
  if (!sourceResult.rows.length) {
    console.log('- app_settings: 0 registros.');
    return;
  }

  let upserted = 0;
  for (const row of sourceResult.rows) {
    const result = await target.query(
      `
        INSERT INTO "app_settings" (id, key, value, private, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          private = EXCLUDED.private,
          updated_at = EXCLUDED.updated_at
      `,
      [crypto.randomUUID(), row.key, row.value, row.private, row.updated_at]
    );
    upserted += result.rowCount || 0;
  }

  console.log(`- app_settings: ${upserted}/${sourceResult.rows.length} registros sincronizados.`);
}

function requireMapped(map: Map<string, string>, value: string | null | undefined, table: string, column: string) {
  if (!value) return value;
  const mapped = map.get(value);
  if (!mapped) throw new Error(`No se encontro mapeo para ${table}.${column}=${value}`);
  return mapped;
}

function transformRow(table: string, row: Record<string, unknown>, userIdMap: Map<string, string>, productIdMap: Map<string, string>) {
  const next = { ...row };

  if (table === 'orders') {
    next.user_id = requireMapped(userIdMap, row.user_id as string, table, 'user_id');
    next.provider_id = requireMapped(userIdMap, row.provider_id as string | null, table, 'provider_id');
    next.deleted_by = requireMapped(userIdMap, row.deleted_by as string | null, table, 'deleted_by');
  }
  if (table === 'client_wallets') {
    next.user_id = requireMapped(userIdMap, row.user_id as string, table, 'user_id');
  }
  if (table === 'provider_payment_configs') {
    next.provider_id = requireMapped(userIdMap, row.provider_id as string | null, table, 'provider_id');
  }
  if (table === 'provider_payouts') {
    next.provider_id = requireMapped(userIdMap, row.provider_id as string | null, table, 'provider_id');
    next.admin_marked_by = requireMapped(userIdMap, row.admin_marked_by as string | null, table, 'admin_marked_by');
  }
  if (table === 'order_items') {
    next.product_id = requireMapped(productIdMap, row.product_id as string, table, 'product_id');
  }
  if (table === 'wallet_movements') {
    next.user_id = requireMapped(userIdMap, row.user_id as string, table, 'user_id');
  }
  if (table === 'delivered_accounts') {
    next.product_id = requireMapped(productIdMap, row.product_id as string, table, 'product_id');
    next.delivered_by = requireMapped(userIdMap, row.delivered_by as string, table, 'delivered_by');
  }
  if (table === 'movements') {
    next.user_id = requireMapped(userIdMap, row.user_id as string | null, table, 'user_id');
  }
  if (table === 'notifications') {
    next.user_id = requireMapped(userIdMap, row.user_id as string, table, 'user_id');
  }
  if (table === 'delivery_drafts') {
    next.created_by = requireMapped(userIdMap, row.created_by as string | null, table, 'created_by');
    next.approved_by = requireMapped(userIdMap, row.approved_by as string | null, table, 'approved_by');
  }

  return next;
}

async function copyTable(
  source: pg.Client,
  target: pg.Client,
  table: string,
  userIdMap: Map<string, string>,
  productIdMap: Map<string, string>
) {
  const columns = await getColumns(source, table);
  if (!columns.length) {
    console.log(`- ${table}: no existe en origen, omitida.`);
    return;
  }

  const targetColumns = await getColumns(target, table);
  if (!targetColumns.length) {
    throw new Error(`La tabla ${table} no existe en destino. Ejecuta primero las migraciones en Supabase.`);
  }

  const sharedColumns = columns.filter((column) => targetColumns.includes(column));
  const sourceResult = await source.query(`SELECT ${sharedColumns.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(table)}`);
  if (!sourceResult.rows.length) {
    console.log(`- ${table}: 0 registros.`);
    return;
  }

  const insertSql = insertSqlFor(table, sharedColumns);

  let inserted = 0;
  for (const row of sourceResult.rows) {
    const transformed = transformRow(table, row, userIdMap, productIdMap);
    const values = sharedColumns.map((column) => transformed[column]);
    const result = await target.query(insertSql, values);
    inserted += result.rowCount || 0;
  }

  console.log(`- ${table}: ${inserted}/${sourceResult.rows.length} registros copiados.`);
}

async function main() {
  if (!sourceUrl) {
    throw new Error('SOURCE_DATABASE_URL o NEON_DATABASE_URL es requerido para copiar datos desde Neon.');
  }
  if (!targetUrl) {
    throw new Error('TARGET_DATABASE_URL o DATABASE_URL es requerido para copiar datos hacia Supabase.');
  }
  if (sourceUrl === targetUrl) {
    throw new Error('La URL origen y destino son iguales. Revisa SOURCE_DATABASE_URL y TARGET_DATABASE_URL.');
  }

  const source = makeClient(sourceUrl);
  const target = makeClient(targetUrl);

  await source.connect();
  await target.connect();

  try {
    const userIdMap = await copyUsers(source, target);
    const productIdMap = await copyProducts(source, target);
    await copyAppSettings(source, target);

    for (const table of tables) {
      await copyTable(source, target, table, userIdMap, productIdMap);
    }
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
