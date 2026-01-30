# Dashboard Frontend API 文档

本文档描述了 Dashboard Frontend 所有 API 模块及其功能。

## 目录

- [Client](#client)
- [Accounts API](#accounts-api)
- [Metrics API](#metrics-api)
- [Settings API](#settings-api)
- [Publish API](#publish-api)
- [Dashboard API](#dashboard-api)
- [Instance API](#instance-api)

---

## Client

**文件**: `src/api/client.ts`

基础 HTTP 客户端配置，使用 axios 实现。

### 配置

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `VITE_API_BASE_URL` | API 基础 URL | `/api` |
| `VITE_COLLECTOR_API_KEY` | API 认证密钥 | 空 |

### 请求头

- `Content-Type`: `application/json`
- `Authorization`: `Bearer {API_KEY}`

---

## Accounts API

**文件**: `src/api/accounts.api.ts`

社交媒体账号管理相关功能。

### 类型定义

#### Account

```typescript
interface Account {
  id: string;
  platform: 'xiaohongshu' | 'douyin' | 'bilibili' | 'weibo';
  accountId: string;
  displayName: string;
  avatar?: string;
  isActive: boolean;
  loginStatus: 'valid' | 'expired' | 'unknown';
  lastHealthCheck?: {
    loggedIn: boolean;
    reason?: string;
    checkedAt: string;
  };
  cookies?: any;
  createdAt: string;
  updatedAt: string;
}
```

#### LoginSession

```typescript
interface LoginSession {
  sessionId: string;
  platform: string;
  accountId: string;
  qrCode?: string;
  status: 'pending' | 'scanned' | 'success' | 'failed' | 'expired';
  expiresAt: string;
  createdAt: string;
}
```

### API 函数

| 函数 | 说明 | 参数 | 返回值 |
|-----|------|------|--------|
| `getAccounts(platform?)` | 获取账号列表 | platform: 可选，平台过滤 | `Account[]` |
| `getAccount(id)` | 获取单个账号 | id: 账号 ID | `Account` |
| `addAccount(data)` | 添加账号 | platform, accountId, displayName | `Account` |
| `updateAccount(id, data)` | 更新账号 | id, Partial\<Account\> | `Account` |
| `deleteAccount(id)` | 删除账号 | id: 账号 ID | void |
| `healthCheck(id)` | 单账号健康检查 | id: 账号 ID | `HealthCheckResult` |
| `batchHealthCheck()` | 批量健康检查 | 无 | `Record<string, HealthCheckResult>` |
| `initiateLogin(platform, accountId)` | 发起登录 | platform, accountId | `LoginSession` |
| `getLoginStatus(sessionId)` | 获取登录状态 | sessionId | `LoginSession` |
| `refreshQRCode(sessionId)` | 刷新二维码 | sessionId | `LoginSession` |
| `getAccountMetrics(id, startDate?, endDate?)` | 获取账号指标 | id, 日期范围 | `AccountMetrics` |
| `exportAccountData(id, format?)` | 导出账号数据 | id, 格式(csv/json) | Blob |

---

## Metrics API

**文件**: `src/api/metrics.api.ts`

数据指标和报表相关功能。

### 类型定义

#### MetricsData

```typescript
interface MetricsData {
  platform: string;
  accountId: string;
  date: string;
  followers_total: number;
  followers_delta: number;
  impressions: number;
  engagements: number;
  posts_published: number;
  top_post_url?: string;
  top_post_engagement?: number;
}
```

#### DashboardMetrics

```typescript
interface DashboardMetrics {
  overview: {
    totalFollowers: number;
    totalFollowersDelta: number;
    totalImpressions: number;
    totalEngagements: number;
    engagementRate: number;
  };
  trends: {
    followers: Array<{ date: string; count: number }>;
    impressions: Array<{ date: string; count: number }>;
    engagements: Array<{ date: string; count: number }>;
  };
  byPlatform: Array<{...}>;
  topContent: Array<{...}>;
}
```

### API 函数

| 函数 | 说明 | 参数 | 返回值 |
|-----|------|------|--------|
| `getDashboardMetrics(timeRange?)` | 获取仪表盘指标 | timeRange: 'today'\|'week'\|'month' | `DashboardMetrics` |
| `getMetrics(platform?, accountId?, startDate?, endDate?)` | 获取指标数据 | 过滤参数 | `MetricsData[]` |
| `getDailyReport(date)` | 获取日报 | date: YYYY-MM-DD | `DailyReport` |
| `getWeeklyReport(weekStart)` | 获取周报 | weekStart: 周起始日期 | any |
| `getMonthlyReport(month)` | 获取月报 | month: YYYY-MM | any |
| `triggerCollection(platform?, accountId?)` | 手动触发数据采集 | 可选过滤 | any |
| `getCollectionStatus()` | 获取采集状态 | 无 | `{status, currentTask?, progress?, lastRun?}` |

---

## Settings API

**文件**: `src/api/settings.api.ts`

系统设置和通知管理。

### 类型定义

#### SystemSettings

```typescript
interface SystemSettings {
  notifications: {
    feishu: {
      enabled: boolean;
      webhookUrl: string;
      notifyOnSuccess: boolean;
      notifyOnFailure: boolean;
      notifyOnLogin: boolean;
      notifyOnMetrics: boolean;
    };
  };
  notion: {
    enabled: boolean;
    apiKey: string;
    databaseId: string;
  };
  collection: {
    timeout: number;
    retries: number;
    concurrency: number;
    schedules: {
      dailyMetrics: string;  // Cron 表达式
      healthCheck: string;
    };
  };
  alerts: {
    loginExpiry: { enabled: boolean; daysBeforeExpiry: number; };
    followerDrop: { enabled: boolean; threshold: number; };
    engagementDrop: { enabled: boolean; threshold: number; };
  };
}
```

### API 函数

| 函数 | 说明 | 参数 | 返回值 |
|-----|------|------|--------|
| `getSettings()` | 获取系统设置 | 无 | `SystemSettings` |
| `updateSettings(settings)` | 更新设置 | Partial\<SystemSettings\> | `SystemSettings` |
| `testFeishuWebhook(webhookUrl)` | 测试飞书 Webhook | webhookUrl | `{success, error?}` |
| `testNotionConnection(apiKey, databaseId)` | 测试 Notion 连接 | apiKey, databaseId | `{success, error?}` |
| `getNotifications(unreadOnly?, limit?)` | 获取通知列表 | 过滤参数 | `Notification[]` |
| `markNotificationRead(id)` | 标记已读 | id | void |
| `markAllNotificationsRead()` | 全部标记已读 | 无 | void |
| `deleteNotification(id)` | 删除通知 | id | void |
| `getUnreadCount()` | 获取未读数 | 无 | number |
| `getSystemHealth()` | 获取系统健康状态 | 无 | `{status, components, uptime, version}` |

---

## Publish API

**文件**: `src/api/publish.api.ts`

内容发布任务管理。

### 类型定义

#### PublishTask

```typescript
interface PublishTask {
  id: string;
  title: string;
  titleZh?: string;
  titleEn?: string;
  content: string | null;
  contentZh?: string | null;
  contentEn?: string | null;
  mediaType: 'image' | 'video' | 'text';
  originalFiles: string[];
  coverImage?: string | null;
  processedFiles: Record<string, string[]>;
  targetPlatforms: string[];
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  scheduleAt: string | null;
  results: Record<string, { success: boolean; url?: string; error?: string }>;
  createdAt: string;
  updatedAt: string;
  progress?: { total: number; completed: number; success: number; failed: number; };
}
```

### API 函数

| 函数 | 说明 | 参数 | 返回值 |
|-----|------|------|--------|
| `getPlatforms()` | 获取平台规格列表 | 无 | `PlatformSpec[]` |
| `getPlatform(platform)` | 获取单个平台规格 | platform | `PlatformSpec` |
| `uploadFiles(files)` | 上传文件 | File[] | `UploadedFile[]` |
| `getTasks(options?)` | 获取任务列表 | status?, limit?, offset? | `PublishTask[]` |
| `getTask(id)` | 获取单个任务 | id | `PublishTask` |
| `createTask(data)` | 创建任务 | 任务数据 | `PublishTask` |
| `updateTask(id, data)` | 更新任务 | id, 部分数据 | `PublishTask` |
| `deleteTask(id)` | 删除任务 | id | void |
| `submitTask(id)` | 提交发布 | id | `PublishTask` |
| `getFileUrl(filePath)` | 获取文件 URL | filePath | string |
| `retryPlatform(taskId, platform)` | 重试失败平台 | taskId, platform | `PublishTask` |
| `copyTask(taskId)` | 复制任务 | taskId | `PublishTask` |
| `getStats()` | 获取发布统计 | 无 | 统计数据 |

---

## Dashboard API

**文件**: `src/api/dashboard.api.ts`

Dashboard 首页聚合数据。

### 类型定义

#### DashboardStats

```typescript
interface DashboardStats {
  todayPublished: { value: number; delta: number; };
  pendingTasks: { value: number; delta: number; };
  activeAccounts: { value: number; delta: number; };
  aiExecutions: { value: number; delta: number; };
}
```

### API 函数

| 函数 | 说明 | 参数 | 返回值 |
|-----|------|------|--------|
| `fetchDashboardStats()` | 获取首页统计 | 无 | `DashboardStats` |

该函数聚合以下数据源：
- 发布统计（从 publishApi）
- 账号状态（从 accountsApi）
- AI 员工执行情况（从 n8n-live-status）

---

## Instance API

**文件**: `src/api/instance.api.ts`

实例配置管理。

### API 函数

| 函数 | 说明 | 参数 | 返回值 |
|-----|------|------|--------|
| `getConfig()` | 获取当前实例配置 | 无 | `InstanceConfigResponse` |

返回值包含：
- `success`: 是否成功
- `config`: 实例配置（主题、功能开关等）
- `matched_domain`: 匹配的域名
- `error`: 错误信息（如有）

---

## 使用示例

```typescript
import { accountsApi, metricsApi, publishApi } from '@/api';

// 获取账号列表
const accounts = await accountsApi.getAccounts();

// 获取仪表盘指标
const metrics = await metricsApi.getDashboardMetrics('week');

// 创建发布任务
const task = await publishApi.createTask({
  titleZh: '测试内容',
  titleEn: 'Test Content',
  mediaType: 'image',
  targetPlatforms: ['xiaohongshu', 'douyin'],
});
```
