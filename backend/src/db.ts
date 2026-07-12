import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

function createPoolConfig(): pg.PoolConfig {
  const url = new URL(config.DATABASE_URL);
  const socketHost = url.searchParams.get('host');

  if (socketHost?.startsWith('/cloudsql/')) {
    return {
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      host: socketHost,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    };
  }

  return {
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  };
}

export const pool = new Pool({
  ...createPoolConfig(),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export type DbClient = pg.PoolClient | pg.Pool;

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
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
