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

import { config } from '../../shared/utils/config';
import { TASKS_CONFIG } from './tasks.config';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// ========== 类型定义 ==========

export interface Task {
  id: string;
  title: string;
  due: string | null;
  done: boolean;
  url: string;
  assignee: string;
  priority: string | null;  // 高/中/低
  highlight: boolean;       // 每日亮点
  stage: string | null;     // 阶段
  notes: string | null;     // 备注
}

export interface QueryOptions {
  name?: string;
  range?: 'today' | 'week' | 'all';
  includeDone?: boolean;
  includeNoDue?: boolean;
}

interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, any>;
}

// ========== 日期工具函数（America/Los_Angeles 时区）==========

/**
 * 获取 LA 时区的今天日期范围
 */
function getTodayRange(): { start: string; end: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TASKS_CONFIG.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = formatter.format(new Date());
  return { start: today, end: today };
}

/**
 * 获取 LA 时区的本周日期范围
 * 周一到周日（weekStartsOn = 1）
 */
function getWeekRange(): { start: string; end: string } {
  const now = new Date();

  // 转换到 LA 时区的日期
  const laDate = new Date(now.toLocaleString('en-US', { timeZone: TASKS_CONFIG.timezone }));
  const dayOfWeek = laDate.getDay(); // 0=周日, 1=周一, ...

  // 计算周一（weekStartsOn = 1）
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(laDate);
  monday.setDate(laDate.getDate() + diffToMonday);

  // 计算周日
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  return { start: formatDate(monday), end: formatDate(sunday) };
}

// ========== Notion API 封装 ==========

async function notionRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: any
): Promise<any> {
  const url = `${NOTION_API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.notion.apiKey}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Notion API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

// ========== Assignee 字段处理（核心兼容逻辑）==========

/**
 * 从 Notion 属性中提取 Assignee 名称
 * 兼容 people / rich_text / select / multi_select 类型
 */
function extractAssignee(property: any): string {
  if (!property) return '';

  switch (property.type) {
    case 'people':
      // people 类型：提取第一个用户的名称
      return property.people?.[0]?.name || '';

    case 'rich_text':
      // rich_text 类型：提取纯文本
      return property.rich_text?.map((t: any) => t.plain_text).join('') || '';

    case 'select':
      // select 类型：提取选中的值
      return property.select?.name || '';

    case 'multi_select':
      // multi_select 类型：提取第一个选中的值
      return property.multi_select?.[0]?.name || '';

    default:
      return '';
  }
}

/**
 * 构建 Assignee 过滤条件
 * 不同字段类型使用不同的过滤语法
 *
 * 注意：Notion API 对 people 字段不支持按名称过滤
 * 所以 people 类型只能在查询后做二次过滤
 */
function buildAssigneeFilter(name: string, propertyType: string): any | null {
  const fieldName = TASKS_CONFIG.fields.assignee;

  switch (propertyType) {
    case 'rich_text':
      return { property: fieldName, rich_text: { contains: name } };

    case 'select':
      return { property: fieldName, select: { equals: name } };

    case 'multi_select':
      return { property: fieldName, multi_select: { contains: name } };

    case 'people':
      // people 类型不支持按名称过滤，返回 null 表示需要后过滤
      return null;

    default:
      return null;
  }
}

// ========== 完成状态处理 ==========

/**
 * 从 Notion 属性中提取完成状态
 * 优先使用 Done (checkbox)，其次 Status (select/status)
 */
function extractDone(properties: Record<string, any>): boolean {
  const doneField = TASKS_CONFIG.fields.done;
  const statusField = TASKS_CONFIG.fields.status;

  // 尝试 checkbox 字段
  const doneProperty = properties[doneField];
  if (doneProperty?.type === 'checkbox') {
    return doneProperty.checkbox === true;
  }

  // 尝试 status/select 字段
  const statusProperty = properties[statusField];
  if (statusProperty) {
    const statusValue = statusProperty.status?.name || statusProperty.select?.name || '';
    return statusValue === TASKS_CONFIG.fields.statusDoneValue;
  }

  return false;
}

/**
 * 构建完成状态过滤条件
 */
function buildDoneFilter(includeDone: boolean, propertyType: string): any | null {
  if (includeDone) return null; // 不过滤

  const doneField = TASKS_CONFIG.fields.done;
  const statusField = TASKS_CONFIG.fields.status;

  if (propertyType === 'checkbox') {
    return { property: doneField, checkbox: { equals: false } };
  } else if (propertyType === 'status') {
    return { property: statusField, status: { does_not_equal: TASKS_CONFIG.fields.statusDoneValue } };
  } else if (propertyType === 'select') {
    return { property: statusField, select: { does_not_equal: TASKS_CONFIG.fields.statusDoneValue } };
  }

  return null;
}

/**
 * 构建更新完成状态的属性
 */
function buildDoneUpdateProperty(done: boolean, propertyType: string): Record<string, any> {
  const doneField = TASKS_CONFIG.fields.done;
  const statusField = TASKS_CONFIG.fields.status;

  if (propertyType === 'checkbox') {
    return { [doneField]: { checkbox: done } };
  } else if (propertyType === 'status') {
    return {
      [statusField]: {
        status: { name: done ? TASKS_CONFIG.fields.statusDoneValue : 'Not started' },
      },
    };
  } else if (propertyType === 'select') {
    return {
      [statusField]: {
        select: { name: done ? TASKS_CONFIG.fields.statusDoneValue : 'Not started' },
      },
    };
  }

  return {};
}

// ========== 日期过滤 ==========

function buildDateFilter(range: 'today' | 'week', includeNoDue: boolean): any[] {
  const dueField = TASKS_CONFIG.fields.dueDate;
  const filters: any[] = [];

  if (range === 'today') {
    const { start, end } = getTodayRange();
    const dateFilter = {
      and: [
        { property: dueField, date: { on_or_after: start } },
        { property: dueField, date: { on_or_before: end } },
      ],
    };

    if (includeNoDue) {
      filters.push({
        or: [dateFilter, { property: dueField, date: { is_empty: true } }],
      });
    } else {
      filters.push(dateFilter);
    }
  } else if (range === 'week') {
    const { start, end } = getWeekRange();
    const dateFilter = {
      and: [
        { property: dueField, date: { on_or_after: start } },
        { property: dueField, date: { on_or_before: end } },
      ],
    };

    if (includeNoDue) {
      filters.push({
        or: [dateFilter, { property: dueField, date: { is_empty: true } }],
      });
    } else {
      filters.push(dateFilter);
    }
  }

  return filters;
}

// ========== 数据库 Schema 检测 ==========

interface DbSchema {
  assigneeType: 'people' | 'rich_text' | 'select' | 'multi_select';
  doneType: 'checkbox' | 'status' | 'select';
}

let cachedSchema: DbSchema | null = null;

/**
 * 检测数据库 schema
 * 注意：链接数据库不支持 /databases/{id} 端点，所以通过查询结果来推断
 */
async function detectDbSchema(): Promise<DbSchema> {
  if (cachedSchema) return cachedSchema;

  // 查询一条记录来获取属性类型
  const result = await notionRequest(
    `/databases/${config.notion.tasksDbId}/query`,
    'POST',
    { page_size: 1 }
  );

  if (result.results.length === 0) {
    // 没有数据时使用默认值
    cachedSchema = { assigneeType: 'people', doneType: 'checkbox' };
    return cachedSchema;
  }

  const properties = result.results[0].properties;

  // 检测 Assignee 类型
  const assigneeProp = properties[TASKS_CONFIG.fields.assignee];
  const assigneeType = assigneeProp?.type || 'rich_text';

  // 检测 Done 类型（优先 checkbox，其次 status/select）
  const doneProp = properties[TASKS_CONFIG.fields.done];
  const statusProp = properties[TASKS_CONFIG.fields.status];

  let doneType: 'checkbox' | 'status' | 'select' = 'checkbox';
  if (doneProp?.type === 'checkbox') {
    doneType = 'checkbox';
  } else if (statusProp?.type === 'status') {
    doneType = 'status';
  } else if (statusProp?.type === 'select') {
    doneType = 'select';
  }

  cachedSchema = { assigneeType, doneType };
  return cachedSchema;
}

// ========== 公开 API ==========

/**
 * 查询任务列表
 */
export async function queryTasks(options: QueryOptions): Promise<Task[]> {
  const { name, range = 'all', includeDone = false, includeNoDue = false } = options;

  const schema = await detectDbSchema();
  const filters: any[] = [];

  // Assignee 过滤
  if (name) {
    const assigneeFilter = buildAssigneeFilter(name, schema.assigneeType);
    if (assigneeFilter) {
      filters.push(assigneeFilter);
    }
  }

  // Done 过滤
  const doneFilter = buildDoneFilter(includeDone, schema.doneType);
  if (doneFilter) {
    filters.push(doneFilter);
  }

  // 日期范围过滤
  if (range !== 'all') {
    const dateFilters = buildDateFilter(range, includeNoDue);
    filters.push(...dateFilters);
  }

  // 构建查询
  const query: any = {
    sorts: [{ property: TASKS_CONFIG.fields.dueDate, direction: 'ascending' }],
  };

  if (filters.length > 0) {
    query.filter = filters.length === 1 ? filters[0] : { and: filters };
  }

  const result = await notionRequest(
    `/databases/${config.notion.tasksDbId}/query`,
    'POST',
    query
  );

  // 转换为统一格式
  let tasks = result.results.map((page: NotionPage) => {
    const properties = page.properties;
    const titleProp = properties[TASKS_CONFIG.fields.title];
    const dueProp = properties[TASKS_CONFIG.fields.dueDate];
    const assigneeProp = properties[TASKS_CONFIG.fields.assignee];
    const priorityProp = properties[TASKS_CONFIG.fields.priority];
    const highlightProp = properties[TASKS_CONFIG.fields.highlight];

    const notesProp = properties[TASKS_CONFIG.fields.notes];
    const stageProp = properties[TASKS_CONFIG.fields.stage];

    return {
      id: page.id,
      title: titleProp?.title?.[0]?.plain_text || '',
      due: dueProp?.date?.start || null,
      done: extractDone(properties),
      url: page.url,
      assignee: extractAssignee(assigneeProp),
      priority: priorityProp?.select?.name || null,
      highlight: highlightProp?.checkbox || false,
      stage: stageProp?.select?.name || null,
      notes: notesProp?.rich_text?.[0]?.plain_text || null,
    };
  });

  // 对于 people 类型，需要做二次过滤
  if (name && schema.assigneeType === 'people') {
    tasks = tasks.filter((t: Task) => t.assignee.includes(name));
  }

  return tasks;
}

/**
 * 从 Notion 页面属性提取任务数据
 */
function extractTaskFromPage(page: NotionPage): Task {
  const props = page.properties;
  const notesProp = props[TASKS_CONFIG.fields.notes];
  return {
    id: page.id,
    title: props[TASKS_CONFIG.fields.title]?.title?.[0]?.plain_text || '',
    due: props[TASKS_CONFIG.fields.dueDate]?.date?.start || null,
    done: extractDone(props),
    url: page.url,
    assignee: extractAssignee(props[TASKS_CONFIG.fields.assignee]),
    priority: props[TASKS_CONFIG.fields.priority]?.select?.name || null,
    highlight: props[TASKS_CONFIG.fields.highlight]?.checkbox || false,
    stage: props[TASKS_CONFIG.fields.stage]?.select?.name || null,
    notes: notesProp?.rich_text?.[0]?.plain_text || null,
  };
}

/**
 * 更新任务完成状态
 */
export async function updateTaskDone(taskId: string, done: boolean): Promise<Task> {
  const schema = await detectDbSchema();
  const properties = buildDoneUpdateProperty(done, schema.doneType);
  const page = await notionRequest(`/pages/${taskId}`, 'PATCH', { properties });
  return extractTaskFromPage(page);
}

/**
 * 更新任务截止日期
 */
export async function updateTaskDue(taskId: string, due: string | null): Promise<Task> {
  const properties: Record<string, any> = {
    [TASKS_CONFIG.fields.dueDate]: due ? { date: { start: due } } : { date: null },
  };
  const page = await notionRequest(`/pages/${taskId}`, 'PATCH', { properties });
  return extractTaskFromPage(page);
}

/**
 * 创建新任务
 */
export async function createTask(data: {
  title: string;
  due?: string;
  assigneeName: string;
  priority?: string;
  highlight?: boolean;
}): Promise<Task> {
  const schema = await detectDbSchema();

  // 构建属性
  const properties: Record<string, any> = {
    [TASKS_CONFIG.fields.title]: {
      title: [{ text: { content: data.title } }],
    },
  };

  // Due date
  if (data.due) {
    properties[TASKS_CONFIG.fields.dueDate] = {
      date: { start: data.due },
    };
  }

  // Priority (select)
  if (data.priority) {
    properties[TASKS_CONFIG.fields.priority] = {
      select: { name: data.priority },
    };
  }

  // Highlight (checkbox)
  if (data.highlight !== undefined) {
    properties[TASKS_CONFIG.fields.highlight] = {
      checkbox: data.highlight,
    };
  }

  // Assignee（按类型写入）
  const assigneeField = TASKS_CONFIG.fields.assignee;
  switch (schema.assigneeType) {
    case 'rich_text':
      properties[assigneeField] = {
        rich_text: [{ text: { content: data.assigneeName } }],
      };
      break;
    case 'select':
      properties[assigneeField] = {
        select: { name: data.assigneeName },
      };
      break;
    case 'multi_select':
      properties[assigneeField] = {
        multi_select: [{ name: data.assigneeName }],
      };
      break;
    case 'people':
      // people 类型需要 Notion 用户 ID
      const notionUser = TASKS_CONFIG.users.find(u => u.name === data.assigneeName);
      if (notionUser?.notionId) {
        properties[assigneeField] = {
          people: [{ id: notionUser.notionId }],
        };
      } else {
        properties[assigneeField] = { people: [] };
      }
      break;
  }

  // 初始化完成状态为 false
  if (schema.doneType === 'checkbox') {
    properties[TASKS_CONFIG.fields.done] = { checkbox: false };
  } else if (schema.doneType === 'status') {
    properties[TASKS_CONFIG.fields.status] = {
      status: { name: 'Not started' },
    };
  } else if (schema.doneType === 'select') {
    properties[TASKS_CONFIG.fields.status] = {
      select: { name: 'Not started' },
    };
  }

  const page = await notionRequest('/pages', 'POST', {
    parent: { database_id: config.notion.tasksDbId },
    properties,
  });

  return extractTaskFromPage(page);
}

/**
 * 获取用户列表
 */
export function getUsers(): Array<{ id: string; name: string }> {
  return TASKS_CONFIG.users;
}

/**
 * 清除 schema 缓存（用于测试或字段变更后）
 */
export function clearSchemaCache(): void {
  cachedSchema = null;
}
