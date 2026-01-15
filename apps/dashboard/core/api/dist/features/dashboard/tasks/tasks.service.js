"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryTasks = queryTasks;
exports.updateTaskDone = updateTaskDone;
exports.updateTaskDue = updateTaskDue;
exports.createTask = createTask;
exports.getUsers = getUsers;
exports.clearSchemaCache = clearSchemaCache;
const config_1 = require("../../../shared/utils/config");
const tasks_config_1 = require("./tasks.config");
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
// ========== 日期工具函数（America/Los_Angeles 时区）==========
/**
 * 获取 LA 时区的今天日期范围
 */
function getTodayRange() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tasks_config_1.TASKS_CONFIG.timezone,
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
function getWeekRange() {
    const now = new Date();
    // 转换到 LA 时区的日期
    const laDate = new Date(now.toLocaleString('en-US', { timeZone: tasks_config_1.TASKS_CONFIG.timezone }));
    const dayOfWeek = laDate.getDay(); // 0=周日, 1=周一, ...
    // 计算周一（weekStartsOn = 1）
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(laDate);
    monday.setDate(laDate.getDate() + diffToMonday);
    // 计算周日
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const formatDate = (d) => d.toISOString().split('T')[0];
    return { start: formatDate(monday), end: formatDate(sunday) };
}
// ========== Notion API 封装 ==========
async function notionRequest(endpoint, method = 'GET', body) {
    const url = `${NOTION_API_BASE}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${config_1.config.notion.apiKey}`,
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
function extractAssignee(property) {
    if (!property)
        return '';
    switch (property.type) {
        case 'people':
            // people 类型：提取第一个用户的名称
            return property.people?.[0]?.name || '';
        case 'rich_text':
            // rich_text 类型：提取纯文本
            return property.rich_text?.map((t) => t.plain_text).join('') || '';
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
function buildAssigneeFilter(name, propertyType) {
    const fieldName = tasks_config_1.TASKS_CONFIG.fields.assignee;
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
function extractDone(properties) {
    const doneField = tasks_config_1.TASKS_CONFIG.fields.done;
    const statusField = tasks_config_1.TASKS_CONFIG.fields.status;
    // 尝试 checkbox 字段
    const doneProperty = properties[doneField];
    if (doneProperty?.type === 'checkbox') {
        return doneProperty.checkbox === true;
    }
    // 尝试 status/select 字段
    const statusProperty = properties[statusField];
    if (statusProperty) {
        const statusValue = statusProperty.status?.name || statusProperty.select?.name || '';
        return statusValue === tasks_config_1.TASKS_CONFIG.fields.statusDoneValue;
    }
    return false;
}
/**
 * 构建完成状态过滤条件
 */
function buildDoneFilter(includeDone, propertyType) {
    if (includeDone)
        return null; // 不过滤
    const doneField = tasks_config_1.TASKS_CONFIG.fields.done;
    const statusField = tasks_config_1.TASKS_CONFIG.fields.status;
    if (propertyType === 'checkbox') {
        return { property: doneField, checkbox: { equals: false } };
    }
    else if (propertyType === 'status') {
        return { property: statusField, status: { does_not_equal: tasks_config_1.TASKS_CONFIG.fields.statusDoneValue } };
    }
    else if (propertyType === 'select') {
        return { property: statusField, select: { does_not_equal: tasks_config_1.TASKS_CONFIG.fields.statusDoneValue } };
    }
    return null;
}
/**
 * 构建更新完成状态的属性
 */
function buildDoneUpdateProperty(done, propertyType) {
    const doneField = tasks_config_1.TASKS_CONFIG.fields.done;
    const statusField = tasks_config_1.TASKS_CONFIG.fields.status;
    if (propertyType === 'checkbox') {
        return { [doneField]: { checkbox: done } };
    }
    else if (propertyType === 'status') {
        return {
            [statusField]: {
                status: { name: done ? tasks_config_1.TASKS_CONFIG.fields.statusDoneValue : 'Not started' },
            },
        };
    }
    else if (propertyType === 'select') {
        return {
            [statusField]: {
                select: { name: done ? tasks_config_1.TASKS_CONFIG.fields.statusDoneValue : 'Not started' },
            },
        };
    }
    return {};
}
// ========== 日期过滤 ==========
function buildDateFilter(range, includeNoDue) {
    const dueField = tasks_config_1.TASKS_CONFIG.fields.dueDate;
    const filters = [];
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
        }
        else {
            filters.push(dateFilter);
        }
    }
    else if (range === 'week') {
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
        }
        else {
            filters.push(dateFilter);
        }
    }
    return filters;
}
let cachedSchema = null;
/**
 * 检测数据库 schema
 * 注意：链接数据库不支持 /databases/{id} 端点，所以通过查询结果来推断
 */
async function detectDbSchema() {
    if (cachedSchema)
        return cachedSchema;
    // 查询一条记录来获取属性类型
    const result = await notionRequest(`/databases/${config_1.config.notion.tasksDbId}/query`, 'POST', { page_size: 1 });
    if (result.results.length === 0) {
        // 没有数据时使用默认值
        cachedSchema = { assigneeType: 'people', doneType: 'checkbox' };
        return cachedSchema;
    }
    const properties = result.results[0].properties;
    // 检测 Assignee 类型
    const assigneeProp = properties[tasks_config_1.TASKS_CONFIG.fields.assignee];
    const assigneeType = assigneeProp?.type || 'rich_text';
    // 检测 Done 类型（优先 checkbox，其次 status/select）
    const doneProp = properties[tasks_config_1.TASKS_CONFIG.fields.done];
    const statusProp = properties[tasks_config_1.TASKS_CONFIG.fields.status];
    let doneType = 'checkbox';
    if (doneProp?.type === 'checkbox') {
        doneType = 'checkbox';
    }
    else if (statusProp?.type === 'status') {
        doneType = 'status';
    }
    else if (statusProp?.type === 'select') {
        doneType = 'select';
    }
    cachedSchema = { assigneeType, doneType };
    return cachedSchema;
}
// ========== 公开 API ==========
/**
 * 查询任务列表
 */
async function queryTasks(options) {
    const { name, range = 'all', includeDone = false, includeNoDue = false } = options;
    const schema = await detectDbSchema();
    const filters = [];
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
    const query = {
        sorts: [{ property: tasks_config_1.TASKS_CONFIG.fields.dueDate, direction: 'ascending' }],
    };
    if (filters.length > 0) {
        query.filter = filters.length === 1 ? filters[0] : { and: filters };
    }
    const result = await notionRequest(`/databases/${config_1.config.notion.tasksDbId}/query`, 'POST', query);
    // 转换为统一格式
    let tasks = result.results.map((page) => {
        const properties = page.properties;
        const titleProp = properties[tasks_config_1.TASKS_CONFIG.fields.title];
        const dueProp = properties[tasks_config_1.TASKS_CONFIG.fields.dueDate];
        const assigneeProp = properties[tasks_config_1.TASKS_CONFIG.fields.assignee];
        const priorityProp = properties[tasks_config_1.TASKS_CONFIG.fields.priority];
        const highlightProp = properties[tasks_config_1.TASKS_CONFIG.fields.highlight];
        const notesProp = properties[tasks_config_1.TASKS_CONFIG.fields.notes];
        const stageProp = properties[tasks_config_1.TASKS_CONFIG.fields.stage];
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
        tasks = tasks.filter((t) => t.assignee.includes(name));
    }
    return tasks;
}
/**
 * 从 Notion 页面属性提取任务数据
 */
function extractTaskFromPage(page) {
    const props = page.properties;
    const notesProp = props[tasks_config_1.TASKS_CONFIG.fields.notes];
    return {
        id: page.id,
        title: props[tasks_config_1.TASKS_CONFIG.fields.title]?.title?.[0]?.plain_text || '',
        due: props[tasks_config_1.TASKS_CONFIG.fields.dueDate]?.date?.start || null,
        done: extractDone(props),
        url: page.url,
        assignee: extractAssignee(props[tasks_config_1.TASKS_CONFIG.fields.assignee]),
        priority: props[tasks_config_1.TASKS_CONFIG.fields.priority]?.select?.name || null,
        highlight: props[tasks_config_1.TASKS_CONFIG.fields.highlight]?.checkbox || false,
        stage: props[tasks_config_1.TASKS_CONFIG.fields.stage]?.select?.name || null,
        notes: notesProp?.rich_text?.[0]?.plain_text || null,
    };
}
/**
 * 更新任务完成状态
 */
async function updateTaskDone(taskId, done) {
    const schema = await detectDbSchema();
    const properties = buildDoneUpdateProperty(done, schema.doneType);
    const page = await notionRequest(`/pages/${taskId}`, 'PATCH', { properties });
    return extractTaskFromPage(page);
}
/**
 * 更新任务截止日期
 */
async function updateTaskDue(taskId, due) {
    const properties = {
        [tasks_config_1.TASKS_CONFIG.fields.dueDate]: due ? { date: { start: due } } : { date: null },
    };
    const page = await notionRequest(`/pages/${taskId}`, 'PATCH', { properties });
    return extractTaskFromPage(page);
}
/**
 * 创建新任务
 */
async function createTask(data) {
    const schema = await detectDbSchema();
    // 构建属性
    const properties = {
        [tasks_config_1.TASKS_CONFIG.fields.title]: {
            title: [{ text: { content: data.title } }],
        },
    };
    // Due date
    if (data.due) {
        properties[tasks_config_1.TASKS_CONFIG.fields.dueDate] = {
            date: { start: data.due },
        };
    }
    // Priority (select)
    if (data.priority) {
        properties[tasks_config_1.TASKS_CONFIG.fields.priority] = {
            select: { name: data.priority },
        };
    }
    // Highlight (checkbox)
    if (data.highlight !== undefined) {
        properties[tasks_config_1.TASKS_CONFIG.fields.highlight] = {
            checkbox: data.highlight,
        };
    }
    // Assignee（按类型写入）
    const assigneeField = tasks_config_1.TASKS_CONFIG.fields.assignee;
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
            const notionUser = tasks_config_1.TASKS_CONFIG.users.find(u => u.name === data.assigneeName);
            if (notionUser?.notionId) {
                properties[assigneeField] = {
                    people: [{ id: notionUser.notionId }],
                };
            }
            else {
                properties[assigneeField] = { people: [] };
            }
            break;
    }
    // 初始化完成状态为 false
    if (schema.doneType === 'checkbox') {
        properties[tasks_config_1.TASKS_CONFIG.fields.done] = { checkbox: false };
    }
    else if (schema.doneType === 'status') {
        properties[tasks_config_1.TASKS_CONFIG.fields.status] = {
            status: { name: 'Not started' },
        };
    }
    else if (schema.doneType === 'select') {
        properties[tasks_config_1.TASKS_CONFIG.fields.status] = {
            select: { name: 'Not started' },
        };
    }
    const page = await notionRequest('/pages', 'POST', {
        parent: { database_id: config_1.config.notion.tasksDbId },
        properties,
    });
    return extractTaskFromPage(page);
}
/**
 * 获取用户列表
 */
function getUsers() {
    return tasks_config_1.TASKS_CONFIG.users;
}
/**
 * 清除 schema 缓存（用于测试或字段变更后）
 */
function clearSchemaCache() {
    cachedSchema = null;
}
//# sourceMappingURL=tasks.service.js.map