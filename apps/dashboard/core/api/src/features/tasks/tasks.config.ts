/**
 * Tasks 模块配置
 *
 * 字段映射配置 - 如果你的 Notion 字段名不一样，只需修改这里
 * 支持的 Assignee 字段类型：people / rich_text / select / multi_select
 */

export const TASKS_CONFIG = {
  // ========== 字段名映射 ==========
  // 根据 Notion 任务库实际字段名配置
  fields: {
    // 任务标题（title 类型）
    title: '名称',

    // 截止日期（date 类型，可为空）
    dueDate: '预期完成日期',

    // 完成状态 - 支持两种方式：
    // 方式1: checkbox 字段（如 "已完成"）
    // 方式2: status/select 字段（如 "状态"，完成值为 "完成"）
    done: '已完成',         // checkbox 字段名
    status: '状态',         // status/select 字段名（作为 done 的备选）
    statusDoneValue: '完成', // status 字段中表示"完成"的值

    // 负责人 - people 类型
    assignee: '负责人',

    // 额外字段
    priority: '优先级',     // select: 高/中/低
    highlight: '每日亮点',  // checkbox
    stage: '阶段',          // select
    notes: '备注',          // rich_text
  },

  // ========== 用户列表 ==========
  // 公司成员（notionId 用于创建任务时设置负责人）
  users: [
    { id: 'xuxiao', name: '徐啸', notionId: 'c9b81af2-8dfb-4738-8996-06d5c67f3217' },
    { id: 'suyanqing', name: '苏彦卿', notionId: '94e86c72-2720-4560-a012-bc49efc17582' },
    { id: 'yujin', name: '于瑾', notionId: '76917884-8fd7-421c-be22-fd95a912eeda' },
  ],

  // ========== 时区配置 ==========
  // 使用北京时间
  timezone: 'Asia/Shanghai',

  // ========== 周起始日 ==========
  // 0 = 周日, 1 = 周一
  weekStartsOn: 1 as const, // 周一为每周第一天
};

export type TasksConfig = typeof TASKS_CONFIG;
