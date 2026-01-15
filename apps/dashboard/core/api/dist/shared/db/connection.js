"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
// PostgreSQL database connection pool
const pg_1 = require("pg");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importDefault(require("../utils/logger"));
class Database {
    constructor() {
        this.isConnected = false;
        this.pool = new pg_1.Pool(config_1.default.database);
        this.pool.on('connect', () => {
            logger_1.default.info('New database connection established');
        });
        this.pool.on('error', (err) => {
            logger_1.default.error('Unexpected database error', { error: err.message });
        });
    }
    async connect() {
        try {
            const client = await this.pool.connect();
            logger_1.default.info('Database connection pool initialized', {
                host: config_1.default.database.host,
                database: config_1.default.database.database,
            });
            client.release();
            this.isConnected = true;
        }
        catch (error) {
            logger_1.default.error('Failed to connect to database', {
                error: error.message,
                host: config_1.default.database.host,
            });
            throw error;
        }
    }
    async query(text, params) {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            logger_1.default.debug('Query executed', {
                query: text,
                duration: `${duration}ms`,
                rows: result.rowCount,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Query error', {
                error: error.message,
                query: text,
                params,
            });
            throw error;
        }
    }
    async getClient() {
        return await this.pool.connect();
    }
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
        this.isConnected = false;
        logger_1.default.info('Database connection pool closed');
    }
    getStatus() {
        return {
            connected: this.isConnected,
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
        };
    }
}
exports.db = new Database();
exports.default = exports.db;
//# sourceMappingURL=connection.js.map