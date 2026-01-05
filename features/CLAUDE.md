# Features Module

模块化功能架构，将 API 功能按业务类型组织为独立、可插拔的模块。

## 目录结构

```
features/
├── index.ts                    # 模块自动加载器
├── CLAUDE.md                   # 本文档
├── business/                   # 客户端业务模块 (12个)
│   ├── accounts/               # 账号管理
│   ├── auth/                   # 认证授权
│   ├── collect/                # 数据采集
│   ├── contents/               # 内容管理
│   ├── douyin/                 # 抖音集成
│   ├── logs/                   # 日志查看
│   ├── metrics/                # 数据指标
│   ├── notifications/          # 通知管理
│   ├── platform-data/          # 平台数据
│   ├── publish/                # 内容发布
│   ├── session/                # 会话管理
│   └── webhook-validator/      # Webhook 验证
└── core/                       # 内部核心模块 (8个)
    ├── ai-factory/             # AI Factory 自动化执行
    ├── claude-monitor/         # Claude 会话监控
    ├── claude-stats/           # Claude 统计
    ├── n8n-workflows/          # n8n 工作流集成
    ├── panorama/               # 项目全景视图
    ├── tasks/                  # 任务管理
    ├── vps-monitor/            # VPS 监控
    └── workflow-tracker/       # 工作流追踪
```

## 模块结构

每个 feature 模块遵循统一结构：

```
{feature-name}/
├── index.ts               # 模块入口，导出 router, basePath, requiresAuth
├── {name}.route.ts        # Express 路由定义
├── {name}.service.ts      # 业务逻辑
├── {name}.repository.ts   # 数据库操作（可选）
├── {name}.types.ts        # TypeScript 类型定义
├── config.yaml            # 模块配置（可选）
└── CLAUDE.md              # 模块文档（可选）
```

### index.ts 模板

```typescript
import { Router } from 'express';
import route from './{name}.route';

export const router: Router = route;
export const basePath = '/v1/{name}';  // 或 /api/{name}
export const requiresAuth = true;      // 是否需要认证

export { service } from './{name}.service';
export * from './{name}.types';
```

## 使用方式

### 自动注册所有模块

```typescript
import express from 'express';
import { registerFeatures } from './features';
import { authMiddleware } from './shared/middleware/auth.middleware';

const app = express();

// 自动发现并注册所有 feature 模块
await registerFeatures(app, authMiddleware);
```

### 直接导入特定模块

```typescript
// 导入整个模块
import { accounts, auth, metrics } from './features';

// 使用模块的 service
const accountList = await accounts.service.getAll();

// 导入特定类型
import type { Account } from './features/business/accounts';
```

### 列出所有可用模块

```typescript
import { listFeatures } from './features';

const features = listFeatures();
// [
//   { category: 'business', features: ['accounts', 'auth', ...] },
//   { category: 'core', features: ['panorama', 'tasks', ...] }
// ]
```

## 模块分类

### Business (业务模块)

面向客户端的功能模块，处理用户数据和业务逻辑：

| 模块 | 路径 | 说明 |
|------|------|------|
| accounts | /v1/accounts | 多平台账号管理 |
| auth | /v1/auth | 飞书 OAuth 认证 |
| collect | /v1/collect | 数据采集接口 |
| contents | /v1/contents | 内容库管理 |
| douyin | /v1/douyin | 抖音登录集成 |
| logs | /v1/logs | 系统日志查看 |
| metrics | /v1/metrics | 数据指标聚合 |
| notifications | /v1/notifications | 飞书通知 |
| platform-data | /v1/platform-data | 平台原始数据 |
| publish | /v1/publish | 内容发布调度 |
| session | /v1/session | 登录会话监控 |
| webhook-validator | /v1/webhook-validator | Webhook 签名验证 |

### Core (核心模块)

内部监控和工具模块：

| 模块 | 路径 | 说明 |
|------|------|------|
| ai-factory | /v1/ai-factory | 自动化任务执行 |
| claude-monitor | /v1/claude-monitor | Claude 会话监控 |
| claude-stats | /v1/claude-stats | Claude 使用统计 |
| n8n-workflows | /v1/n8n-workflows | n8n 工作流管理 |
| panorama | /v1/panorama | 项目全景可视化 |
| tasks | /v1/tasks | Notion 任务集成 |
| vps-monitor | /v1/vps-monitor | VPS 资源监控 |
| workflow-tracker | /v1/workflow-tracker | 工作流执行追踪 |

## 跨模块依赖

模块间调用应通过 index.ts 导出：

```typescript
// ✅ 正确：从模块入口导入
import { service as accountsService } from '../accounts';

// ❌ 错误：直接导入内部文件
import { AccountsRepository } from '../accounts/accounts.repository';
```

## 共享代码

所有模块共用 `../shared/` 目录下的代码：

```typescript
import { db } from '../../../shared/db/connection';
import logger from '../../../shared/utils/logger';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
```

## 新增模块

1. 在 `business/` 或 `core/` 下创建目录
2. 创建 index.ts 并导出 `router`, `basePath`, `requiresAuth`
3. 实现 route, service, repository（可选）
4. 模块会在下次启动时自动注册

---

**最后更新**: 2026-01-05
