/**
 * Tasks 模块配置
 *
 * 字段映射配置 - 如果你的 Notion 字段名不一样，只需修改这里
 * 支持的 Assignee 字段类型：people / rich_text / select / multi_select
 */
export declare const TASKS_CONFIG: {
    fields: {
        title: string;
        dueDate: string;
        done: string;
        status: string;
        statusDoneValue: string;
        assignee: string;
        priority: string;
        highlight: string;
        stage: string;
        notes: string;
    };
    users: {
        id: string;
        name: string;
        notionId: string;
    }[];
    timezone: string;
    weekStartsOn: 1;
};
export type TasksConfig = typeof TASKS_CONFIG;
//# sourceMappingURL=tasks.config.d.ts.map