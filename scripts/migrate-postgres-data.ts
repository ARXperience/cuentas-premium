import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.NEON_DATABASE_URL || '';
const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '';

const tables = [
  'users',
  'products',
  'app_settings',
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

async function copyTable(source: pg.Client, target: pg.Client, table: string) {
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

  const columnSql = sharedColumns.map(quoteIdentifier).join(', ');
  const valueSql = sharedColumns.map((_, index) => `$${index + 1}`).join(', ');
  const insertSql = `
    INSERT INTO ${quoteIdentifier(table)} (${columnSql})
    VALUES (${valueSql})
    ON CONFLICT DO NOTHING
  `;

  let inserted = 0;
  for (const row of sourceResult.rows) {
    const values = sharedColumns.map((column) => row[column]);
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
    for (const table of tables) {
      await copyTable(source, target, table);
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
