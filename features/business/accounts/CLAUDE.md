# Accounts Feature

账号管理功能模块，负责多平台社媒账号的 CRUD 操作。

## 文件结构

```
accounts/
├── index.ts              # 模块入口，导出 router, basePath, requiresAuth
├── accounts.route.ts     # 路由定义
├── accounts.service.ts   # 业务逻辑
├── accounts.repository.ts # 数据库操作
├── accounts.types.ts     # 类型定义
├── config.yaml           # 功能配置
└── CLAUDE.md             # 本文档
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /v1/accounts | 获取所有账号 |
| GET | /v1/accounts/stats/by-platform | 按平台统计账号数量 |
| GET | /v1/accounts/:id | 获取单个账号 |
| POST | /v1/accounts | 创建账号 |
| PATCH | /v1/accounts/:id | 更新账号 |
| DELETE | /v1/accounts/:id | 删除账号 |

## 依赖

- `../../shared/db/connection` - 数据库连接
- `../../shared/types` - 共享类型（Platform）
- `../../shared/middleware/error.middleware` - 错误处理
- `../../shared/utils/logger` - 日志工具

## 导出

- `accountsService` - 业务逻辑服务
- `accountsRepository` - 数据库操作
- `Account`, `CreateAccountDTO`, `UpdateAccountDTO`, `AccountApiResponse` - 类型
