import { Pool, PoolClient } from 'pg';

let _pool: Pool | null = null;
let signalHandlersRegistered = false;

// Getter function for PostgreSQL connection pool
export function getPostgresPool(): Pool {
  // Only allow server-side usage
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
      // Connection pool settings optimized for Supabase
      max: 10, // Maximum number of clients in pool (reduced for better resource management)
      min: 2,  // Keep minimum connections alive
      idleTimeoutMillis: 60000, // Close idle clients after 60 seconds
      connectionTimeoutMillis: 10000, // Increased timeout to 10 seconds for Supabase
      // SSL configuration for Supabase (always required)
      ssl: { rejectUnauthorized: false },
      // Query timeout
      query_timeout: 30000,
      // Connection keep-alive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });

    // Handle pool errors
    _pool.on('error', (err) => {
      console.error('[DB] PostgreSQL pool error:', err);
      // Reset pool on critical errors
      if (err.message.includes('Connection terminated') || err.message.includes('ECONNRESET')) {
        _pool = null; // This will cause a new pool to be created on next access
      }
    });

    // Register signal handlers only once
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

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1 as test');
    return true;
  } catch (error) {
    console.error('[DB] Connection test failed:', error);
    return false;
  }
}

// Helper function to execute queries with proper error handling and retry logic
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
      // Release client if we got one
      if (client) {
        client.release();
        client = undefined;
      }

      // Check if this is a connection error we should retry
      const shouldRetry = retryCount < maxRetries && (
        error.message.includes('connection timeout') ||
        error.message.includes('Connection terminated') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND'
      );

      if (shouldRetry) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
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

// Helper function for single row queries
export async function executeQuerySingle<T = any>(
  text: string, 
  params?: any[]
): Promise<T | null> {
  const result = await executeQuery<T>(text, params);
  return result.rows[0] || null;
}

// Helper function for transactions
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPostgresPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}