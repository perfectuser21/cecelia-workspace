import { PoolClient, QueryResult, QueryResultRow } from 'pg';
declare class Database {
    private pool;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
    getClient(): Promise<PoolClient>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    close(): Promise<void>;
    getStatus(): {
        connected: boolean;
        totalCount: number;
        idleCount: number;
        waitingCount: number;
    };
}
export declare const db: Database;
export default db;
//# sourceMappingURL=connection.d.ts.map