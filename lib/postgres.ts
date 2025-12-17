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
      max: 5, // Maximum number of clients in pool
      min: 1,  // Keep minimum connections alive
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds (faster cleanup)
      connectionTimeoutMillis: 10000, // Increased timeout to 10 seconds
      // SSL configuration (always required)
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
        // For MaxClients errors, wait longer to allow connections to free up
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
      // Rollback if transaction was started
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors
        }
      }

      // Check if this is a connection error we should retry
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