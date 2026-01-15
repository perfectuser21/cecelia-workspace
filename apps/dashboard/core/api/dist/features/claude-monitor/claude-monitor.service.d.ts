import { ClaudeRun, ClaudeRunWithChildren, ClaudeEvent, CreateRunDTO, UpdateRunDTO, CreateEventDTO, RunStatistics, RunListResponse, EventListResponse } from './claude-monitor.types';
declare class ClaudeMonitorService {
    createRun(data: CreateRunDTO): Promise<ClaudeRun>;
    getRunById(id: string): Promise<ClaudeRun>;
    getRunByIdOrSessionId(idOrSessionId: string): Promise<ClaudeRun>;
    getRunWithChildren(id: string): Promise<ClaudeRunWithChildren>;
    getAllRuns(options: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<RunListResponse>;
    updateRun(idOrSessionId: string, data: UpdateRunDTO): Promise<ClaudeRun>;
    deleteRun(id: string): Promise<void>;
    killRun(id: string): Promise<{
        success: boolean;
        killed: boolean;
        run: ClaudeRun;
    }>;
    getRunStats(id: string): Promise<RunStatistics>;
    createEvent(runIdOrSessionId: string, data: CreateEventDTO): Promise<ClaudeEvent>;
    getEventsByRunId(runId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<EventListResponse>;
    getRecentEvents(runId: string, since: number): Promise<EventListResponse>;
}
export declare const claudeMonitorService: ClaudeMonitorService;
export {};
//# sourceMappingURL=claude-monitor.service.d.ts.map