export interface PublishTask {
    id: string;
    title: string;
    title_zh: string;
    title_en: string;
    content: string | null;
    content_zh: string | null;
    content_en: string | null;
    media_type: 'image' | 'video' | 'text';
    lang: 'zh' | 'en';
    original_files: string[];
    cover_image: string | null;
    processed_files: Record<string, string[]>;
    target_platforms: string[];
    status: 'draft' | 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
    schedule_at: Date | null;
    results: Record<string, {
        success: boolean;
        url?: string;
        error?: string;
    }>;
    created_by: number | null;
    created_at: Date;
    updated_at: Date;
}
export interface MediaFile {
    id: string;
    original_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    width: number | null;
    height: number | null;
    duration: number | null;
    thumbnail_path: string | null;
    created_by: number | null;
    created_at: Date;
}
export declare class PublishRepository {
    createTask(data: {
        title_zh: string;
        title_en: string;
        content_zh?: string;
        content_en?: string;
        media_type: 'image' | 'video' | 'text';
        original_files?: string[];
        cover_image?: string;
        target_platforms: string[];
        schedule_at?: Date;
        created_by?: number;
    }): Promise<PublishTask>;
    findTaskById(id: string): Promise<PublishTask | null>;
    findAllTasks(options?: {
        status?: string;
        createdBy?: number;
        limit?: number;
        offset?: number;
    }): Promise<PublishTask[]>;
    updateTask(id: string, data: Partial<{
        title: string;
        content: string;
        title_zh: string;
        title_en: string;
        content_zh: string;
        content_en: string;
        original_files: string[];
        cover_image: string | null;
        processed_files: Record<string, string[]>;
        target_platforms: string[];
        status: string;
        schedule_at: Date | null;
        results: Record<string, any>;
    }>): Promise<PublishTask | null>;
    deleteTask(id: string): Promise<boolean>;
    createMediaFile(data: {
        original_name: string;
        file_path: string;
        file_size: number;
        mime_type: string;
        width?: number;
        height?: number;
        duration?: number;
        thumbnail_path?: string;
        created_by?: number;
    }): Promise<MediaFile>;
    findMediaFileById(id: string): Promise<MediaFile | null>;
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
        task_id: string;
        platform: string;
        action: string;
        status: string;
        message: string | null;
        created_at: Date;
    }>>;
    private parseTask;
}
export declare const publishRepository: PublishRepository;
export default publishRepository;
//# sourceMappingURL=publish.repository.d.ts.map