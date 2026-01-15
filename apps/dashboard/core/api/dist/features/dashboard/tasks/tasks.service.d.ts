/**
 * Tasks Service - Notion 任务库代理
 *
 * 核心功能：
 * 1. 查询任务（按负责人、日期范围过滤）
 * 2. 更新任务完成状态
 * 3. 创建新任务
 *
 * Assignee 字段兼容：支持 people / rich_text / select / multi_select
 */
export interface Task {
    id: string;
    title: string;
    due: string | null;
    done: boolean;
    url: string;
    assignee: string;
    priority: string | null;
    highlight: boolean;
    stage: string | null;
    notes: string | null;
}
export interface QueryOptions {
    name?: string;
    range?: 'today' | 'week' | 'all';
    includeDone?: boolean;
    includeNoDue?: boolean;
}
/**
 * 查询任务列表
 */
export declare function queryTasks(options: QueryOptions): Promise<Task[]>;
/**
 * 更新任务完成状态
 */
export declare function updateTaskDone(taskId: string, done: boolean): Promise<Task>;
/**
 * 更新任务截止日期
 */
export declare function updateTaskDue(taskId: string, due: string | null): Promise<Task>;
/**
 * 创建新任务
 */
export declare function createTask(data: {
    title: string;
    due?: string;
    assigneeName: string;
    priority?: string;
    highlight?: boolean;
}): Promise<Task>;
/**
 * 获取用户列表
 */
export declare function getUsers(): Array<{
    id: string;
    name: string;
}>;
/**
 * 清除 schema 缓存（用于测试或字段变更后）
 */
export declare function clearSchemaCache(): void;
//# sourceMappingURL=tasks.service.d.ts.map