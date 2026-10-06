import pg from 'pg';

const { Pool } = pg;

function createPoolConfig(): pg.PoolConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');

  const url = new URL(databaseUrl);
  const socketHost = url.searchParams.get('host');
  if (socketHost?.startsWith('/cloudsql/')) {
    return {
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      host: socketHost,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    };
  }

  return {
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  };
}

export const scriptPool = new Pool(createPoolConfig());

export async function withScriptTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await scriptPool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
