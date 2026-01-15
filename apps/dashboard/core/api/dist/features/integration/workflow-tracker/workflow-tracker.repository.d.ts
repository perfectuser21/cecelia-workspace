import { WorkflowRun, WorkflowEvent, CreateRunDTO, UpdateRunDTO, EmitEventDTO, Phase } from './workflow-tracker.types';
declare class WorkflowTrackerRepository {
    createRun(data: CreateRunDTO): Promise<WorkflowRun>;
    findRunById(runId: string): Promise<WorkflowRun | null>;
    findAllRuns(options: {
        status?: string;
        bundle?: string;
        limit?: number;
        offset?: number;
    }): Promise<WorkflowRun[]>;
    updateRun(runId: string, data: UpdateRunDTO): Promise<WorkflowRun | null>;
    deleteRun(runId: string): Promise<boolean>;
    countRunning(): Promise<number>;
    countTotal(): Promise<number>;
    createEvent(runId: string, data: EmitEventDTO): Promise<WorkflowEvent>;
    findEventsByRunId(runId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<WorkflowEvent[]>;
    findLastEvent(runId: string): Promise<WorkflowEvent | null>;
    countEvents(runId: string): Promise<number>;
    findStuckStartEvents(thresholdMs?: number): Promise<WorkflowEvent[]>;
    markSubstepStuck(runId: string, phase: Phase, substep: string): Promise<void>;
}
export declare const workflowTrackerRepository: WorkflowTrackerRepository;
export {};
//# sourceMappingURL=workflow-tracker.repository.d.ts.map