import pkg from 'pg';
const { Pool } = pkg;
import { config } from './config.js';
import { logger } from './logger.js';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/**
 * Execute a single query against the pool
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Execute operations within an explicit database transaction
 * Automatically rolls back on error and releases the connection
 */
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Check database health by executing SELECT 1
 */
export const checkHealth = async () => {
  const client = await pool.connect();
  try {
    await client.query({ text: 'SELECT 1', timeout: 2000 });
    return true;
  } finally {
    client.release();
  }
};

export const close = () => pool.end();

