import { WorkflowRun, WorkflowEvent, RunWithProgress, CreateRunDTO, UpdateRunDTO, EmitEventDTO, RunListResponse, EventListResponse, EventStreamResponse } from './workflow-tracker.types';
declare class WorkflowTrackerService {
    createRun(data: CreateRunDTO): Promise<WorkflowRun>;
    getRunById(runId: string): Promise<WorkflowRun>;
    getAllRuns(options: {
        status?: string;
        bundle?: string;
        limit?: number;
        offset?: number;
    }): Promise<RunListResponse>;
    getRunWithProgress(runId: string): Promise<RunWithProgress>;
    updateRun(runId: string, data: UpdateRunDTO): Promise<WorkflowRun>;
    deleteRun(runId: string): Promise<void>;
    emitEvent(runId: string, data: EmitEventDTO): Promise<WorkflowEvent>;
    getEventsByRunId(runId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<EventListResponse>;
    detectAndMarkStuck(thresholdMs?: number): Promise<number>;
    private buildPhaseProgress;
    private mapEventStatus;
    getEventStream(runId: string): Promise<EventStreamResponse>;
    private formatEventToStream;
    private getEventDisplay;
    private getEventContent;
}
export declare const workflowTrackerService: WorkflowTrackerService;
export {};
//# sourceMappingURL=workflow-tracker.service.d.ts.map