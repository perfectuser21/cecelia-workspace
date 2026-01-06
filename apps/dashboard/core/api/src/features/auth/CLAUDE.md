# Auth Feature

登录认证功能模块，管理多平台账号的登录流程和会话状态。

## 文件结构

```
auth/
├── index.ts           # 模块入口
├── auth.route.ts      # 路由定义
├── auth.service.ts    # 业务逻辑（含内存会话存储）
├── auth.types.ts      # 类型定义
├── config.yaml        # 功能配置
└── CLAUDE.md          # 本文档
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /v1/accounts/:id/start-login | 开始登录流程 |
| GET | /v1/accounts/:id/login-status | 查询登录状态 |
| POST | /v1/accounts/:id/save-session | 保存登录会话 |

## 依赖

- `../../shared/types` - 共享类型（Platform）
- `../../shared/middleware/error.middleware` - 错误处理
- `../../shared/utils/logger` - 日志工具
- `../accounts` - 账号服务（验证账号存在、更新登录状态）

## 会话管理

- 使用内存存储登录会话（生产环境可改用 Redis）
- 会话超时时间：5 分钟
- 会话状态：pending / success / failed / expired

## 导出

- `authService` - 认证服务
- `LoginSession`, `StartLoginResponse`, `LoginStatusResponse` - 类型
