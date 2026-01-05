# Shared Module

Monorepo 共享代码库，提供跨项目使用的工具、中间件、类型定义和配置。

## 目录结构

```
shared/
├── db/
│   └── connection.ts      # PostgreSQL 数据库连接池
├── middleware/
│   ├── auth.middleware.ts    # API Key 认证中间件
│   ├── error.middleware.ts   # 错误处理中间件
│   └── logger.middleware.ts  # 请求日志中间件
├── utils/
│   ├── config.ts          # 环境变量配置管理
│   └── logger.ts          # Winston 日志工具
├── types/
│   └── index.ts           # TypeScript 类型定义
├── config/
│   └── platforms.config.ts # 平台规格配置
├── index.ts               # 统一导出入口
└── CLAUDE.md              # 本文档
```

## 使用方式

### 导入方式

```typescript
// 推荐：从统一入口导入
import { db, config, logger, authMiddleware, Platform } from '@zenithjoy/shared';

// 或直接导入具体模块
import { db } from '@zenithjoy/shared/db/connection';
import { config } from '@zenithjoy/shared/utils/config';
```

### 数据库连接

```typescript
import { db } from '@zenithjoy/shared';

// 初始化连接
await db.connect();

// 执行查询
const result = await db.query('SELECT * FROM accounts WHERE platform = $1', ['xhs']);

// 事务处理
await db.transaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
});
```

### 中间件使用

```typescript
import express from 'express';
import { authMiddleware, errorHandler, requestLogger } from '@zenithjoy/shared';

const app = express();

// 请求日志
app.use(requestLogger);

// 需要认证的路由
app.use('/api', authMiddleware);

// 错误处理（放在最后）
app.use(errorHandler);
```

### 配置访问

```typescript
import { config } from '@zenithjoy/shared';

console.log(config.database.host);
console.log(config.notion.apiKey);
```

### 类型使用

```typescript
import type { Platform, Account, Metric } from '@zenithjoy/shared';

const platform: Platform = 'xhs';
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| NODE_ENV | development | 运行环境 |
| COLLECTOR_API_KEY | dev-api-key-change-me | API 认证密钥 |
| DB_HOST | localhost | 数据库主机 |
| DB_PORT | 5432 | 数据库端口 |
| DB_NAME | n8n_social_metrics | 数据库名称 |
| DB_USER | postgres | 数据库用户 |
| DB_PASSWORD | postgres | 数据库密码 |
| LOG_LEVEL | info | 日志级别 |
| NOTION_API_KEY | - | Notion API 密钥 |

## 导出列表

### 数据库
- `db` - 数据库连接池实例

### 中间件
- `authMiddleware` - API Key 认证
- `errorHandler` - 全局错误处理
- `notFoundHandler` - 404 处理
- `requestLogger` - 请求日志记录

### 工具
- `config` - 配置对象
- `logger` - Winston 日志实例

### 类型
- `Platform` - 平台类型
- `Account` - 账号接口
- `Metric` - 指标接口
- `DailyReport` - 日报接口
- 更多类型见 `types/index.ts`

### 配置
- `platformSpecs` - 平台规格配置
- `getPlatformSpec()` - 获取单个平台规格
- `getAllPlatforms()` - 获取所有平台规格

---

**最后更新**: 2025-01-05
