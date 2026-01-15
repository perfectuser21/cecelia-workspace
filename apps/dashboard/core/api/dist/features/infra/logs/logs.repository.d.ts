import { Log, CreateLogDTO } from './logs.types';
declare class LogRepository {
    create(data: CreateLogDTO): Promise<Log>;
    findRecent(limit?: number): Promise<Log[]>;
    findByAction(action: string, limit?: number): Promise<Log[]>;
    findByResource(resourceType: string, resourceId: number, limit?: number): Promise<Log[]>;
    findByDateRange(startDate: Date, endDate: Date, limit?: number): Promise<Log[]>;
    deleteOldLogs(daysToKeep?: number): Promise<number>;
}
export declare const logsRepository: LogRepository;
export {};
//# sourceMappingURL=logs.repository.d.ts.map