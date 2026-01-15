import { PublishTask } from './publish.repository';
export declare class PublishService {
    createTask(data: {
        titleZh: string;
        titleEn: string;
        contentZh?: string;
        contentEn?: string;
        mediaType: 'image' | 'video' | 'text';
        originalFiles?: string[];
        coverImage?: string;
        targetPlatforms: string[];
        scheduleAt?: Date;
        createdBy?: number;
    }): Promise<PublishTask>;
    getTaskById(id: string): Promise<PublishTask>;
    getTasks(options?: {
        status?: string;
        createdBy?: number;
        limit?: number;
        offset?: number;
    }): Promise<PublishTask[]>;
    updateTask(id: string, data: Partial<{
        title: string;
        content: string;
        titleZh: string;
        titleEn: string;
        contentZh: string;
        contentEn: string;
        originalFiles: string[];
        targetPlatforms: string[];
        scheduleAt: Date | null;
    }>): Promise<PublishTask>;
    deleteTask(id: string): Promise<void>;
    processAndSubmit(id: string): Promise<PublishTask>;
    private publishToWebsite;
    private generateSlug;
    private triggerN8nWorkflow;
    updateTaskResult(taskId: string, platform: string, result: {
        success: boolean;
        url?: string;
        error?: string;
    }): Promise<PublishTask>;
    getStats(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        byPlatform: Record<string, {
            total: number;
            success: number;
            failed: number;
        }>;
        recentTrend: Array<{
            date: string;
            success: number;
            failed: number;
        }>;
    }>;
    getTaskLogs(taskId: string): Promise<Array<{
        id: string;
        taskId: string;
        platform: string;
        action: string;
        status: string;
        message: string | null;
        createdAt: Date;
    }>>;
    retryPlatform(taskId: string, platform: string): Promise<PublishTask>;
    copyTask(taskId: string, userId?: number): Promise<PublishTask>;
    batchOperation(action: 'delete' | 'submit', ids: string[]): Promise<{
        success: number;
        failed: number;
        results: Array<{
            id: string;
            success: boolean;
            error?: string;
        }>;
    }>;
    formatTaskForApi(task: PublishTask & {
        creator_name?: string;
        creator_avatar?: string;
    }): any;
}
export declare const publishService: PublishService;
export default publishService;
//# sourceMappingURL=publish.service.d.ts.map