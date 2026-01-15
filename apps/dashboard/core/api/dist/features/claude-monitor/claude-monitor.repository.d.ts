import { ClaudeRun, ClaudeEvent, CreateRunDTO, UpdateRunDTO, CreateEventDTO } from './claude-monitor.types';
declare class ClaudeMonitorRepository {
    createRun(data: CreateRunDTO): Promise<ClaudeRun>;
    findRunById(id: string): Promise<ClaudeRun | null>;
    findRunBySessionId(sessionId: string): Promise<ClaudeRun | null>;
    findAllRuns(options: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<ClaudeRun[]>;
    findChildRuns(parentId: string): Promise<ClaudeRun[]>;
    updateRun(id: string, data: UpdateRunDTO): Promise<ClaudeRun | null>;
    deleteRun(id: string): Promise<boolean>;
    countRunning(): Promise<number>;
    countTotal(): Promise<number>;
    findRunningRuns(): Promise<ClaudeRun[]>;
    createEvent(runId: string, data: CreateEventDTO): Promise<ClaudeEvent>;
    findEventById(id: number): Promise<ClaudeEvent | null>;
    findEventsByRunId(runId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<ClaudeEvent[]>;
    findRecentEvents(runId: string, since: number): Promise<ClaudeEvent[]>;
    findLastEvent(runId: string): Promise<ClaudeEvent | null>;
    countEvents(runId: string): Promise<number>;
    getToolCallStats(runId: string): Promise<Record<string, number>>;
    private generateUUID;
}
export declare const claudeMonitorRepository: ClaudeMonitorRepository;
export {};
//# sourceMappingURL=claude-monitor.repository.d.ts.map