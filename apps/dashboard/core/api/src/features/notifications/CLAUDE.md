# Notifications Feature

通知服务功能模块，通过飞书和 Slack 发送告警和通知。

## 文件结构

```
notifications/
├── index.ts                  # 模块入口
├── notifications.route.ts    # 路由定义
├── notifications.service.ts  # 通知服务
├── notifications.types.ts    # 类型定义
├── config.yaml               # 功能配置
└── CLAUDE.md                 # 本文档
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /v1/notify/login_required | 登录失效告警 |
| POST | /v1/notify/team_daily | 每日团队通知 |
| POST | /v1/notify/ops_alert | 运维告警 |

## 依赖

- `../../shared/utils/config` - 配置（Webhook URL）
- `../../shared/utils/logger` - 日志工具
- `../../shared/middleware/error.middleware` - 错误处理

## 通知渠道

### 飞书 (Feishu)
- 通过 Webhook URL 发送
- 消息格式：text

### Slack
- 通过 Webhook URL 发送
- 消息格式：text

## 通知类型

### 1. 登录失效 (login_required)
```typescript
{
  platform: string;
  accountId: string;
  reason: string;
  loginUrl: string;
}
```

### 2. 每日报表 (team_daily)
```typescript
{
  date: string;
  summaryText: string;
  notionUrl?: string;
}
```

### 3. 运维告警 (ops_alert)
```typescript
{
  where: string;
  workflow: string;
  node: string;
  platform: string;
  accountId: string;
  error: string;
  meta?: Record<string, any>;
}
```

## 导出

- `notificationsService` - 通知服务
- 各种请求/响应类型
