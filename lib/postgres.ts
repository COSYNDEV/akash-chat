import { Pool, PoolClient } from 'pg';

let _pool: Pool | null = null;

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
      // Connection pool settings
      max: 20, // Maximum number of clients in pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
      // For development with local postgres or cloud providers
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Handle pool errors
    _pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });
  }
  
  return _pool;
}

// Helper function to execute queries with proper error handling
export async function executeQuery<T = any>(
  text: string, 
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPostgresPool();
  let client: PoolClient | undefined;
  
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0
    };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
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