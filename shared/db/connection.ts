// PostgreSQL database connection pool
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import config from '../utils/config';
import logger from '../utils/logger';

class Database {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool(config.database);

    this.pool.on('connect', () => {
      logger.info('New database connection established');
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info('Database connection pool initialized', {
        host: config.database.host,
        database: config.database.database,
      });
      client.release();
      this.isConnected = true;
    } catch (error: any) {
      logger.error('Failed to connect to database', {
        error: error.message,
        host: config.database.host,
      });
      throw error;
    }
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        query: text,
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error: any) {
      logger.error('Query error', {
        error: error.message,
        query: text,
        params,
      });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
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

  async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    logger.info('Database connection pool closed');
  }

  getStatus(): { connected: boolean; totalCount: number; idleCount: number; waitingCount: number } {
    return {
      connected: this.isConnected,
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

export const db = new Database();
export default db;
