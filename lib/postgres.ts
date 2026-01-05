import { Pool, PoolClient } from 'pg';

let _pool: Pool | null = null;
let signalHandlersRegistered = false;

export function getPostgresPool(): Pool {
  if (typeof window !== 'undefined') {
    throw new Error('PostgreSQL pool can only be used on the server side (API routes, server components)');
  }

  if (!_pool) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.error('Server-side environment variables check:', {
        DATABASE_URL: !!databaseUrl,
        NODE_ENV: process.env.NODE_ENV,
        isServer: typeof window === 'undefined'
      });
      throw new Error(`Missing DATABASE_URL environment variable. Check your .env.local file for: DATABASE_URL`);
    }

    _pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      min: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
      query_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });

    _pool.on('error', (err) => {
      console.error('[DB] PostgreSQL pool error:', err);
      if (err.message.includes('Connection terminated') || err.message.includes('ECONNRESET')) {
        _pool = null;
      }
    });

    if (!signalHandlersRegistered) {
      signalHandlersRegistered = true;

      process.on('SIGTERM', async () => {
        if (_pool) {
          await _pool.end();
          _pool = null;
        }
      });

      process.on('SIGINT', async () => {
        if (_pool) {
          await _pool.end();
          _pool = null;
        }
      });
    }
  }
  
  return _pool;
}

export async function testConnection(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1 as test');
    return true;
  } catch (error) {
    console.error('[DB] Connection test failed:', error);
    return false;
  }
}

export async function executeQuery<T = any>(
  text: string, 
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPostgresPool();
  let client: PoolClient | undefined;
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount <= maxRetries) {
    try {
      client = await pool.connect();
      const result = await client.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error: any) {
      if (client) {
        client.release();
        client = undefined;
      }

      const isMaxClientsError = error.message.includes('MaxClientsInSessionMode') || 
                                 error.message.includes('max clients reached');
      
      const shouldRetry = retryCount < maxRetries && (
        isMaxClientsError ||
        error.message.includes('connection timeout') ||
        error.message.includes('Connection terminated') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND'
      );

      if (shouldRetry) {
        retryCount++;
        const waitTime = isMaxClientsError ? 2000 : 1000;
        console.log(`[DB] Connection pool exhausted, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      } else {
        console.error('[DB] Query failed:', error);
        throw error;
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }
  
  throw new Error('Query failed after all retry attempts');
}

export async function executeQuerySingle<T = any>(
  text: string, 
  params?: any[]
): Promise<T | null> {
  const result = await executeQuery<T>(text, params);
  return result.rows[0] || null;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPostgresPool();
  let client: PoolClient | undefined;
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount <= maxRetries) {
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error: any) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
        }
      }

      const isMaxClientsError = error.message.includes('MaxClientsInSessionMode') || 
                                 error.message.includes('max clients reached');
      
      const shouldRetry = retryCount < maxRetries && (
        isMaxClientsError ||
        error.message.includes('connection timeout') ||
        error.message.includes('Connection terminated') ||
        error.message.includes('ECONNRESET') ||
        error.code === 'ECONNRESET'
      );

      if (shouldRetry) {
        retryCount++;
        const waitTime = isMaxClientsError ? 2000 : 1000;
        console.log(`[DB] Transaction connection pool exhausted, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      } else {
        throw error;
      }
    } finally {
      if (client) {
        client.release();
        client = undefined;
      }
    }
  }
  
  throw new Error('Transaction failed after all retry attempts');
}