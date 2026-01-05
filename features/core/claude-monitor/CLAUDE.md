# Claude Monitor Feature

Claude 会话监控模块。

## 功能

- 记录 Claude 会话信息
- 追踪会话消息
- 查询会话历史

## 文件结构

```
claude-monitor/
├── index.ts                   # 模块入口
├── claude-monitor.types.ts    # 类型定义
├── claude-monitor.route.ts    # 路由
├── claude-monitor.service.ts  # 业务逻辑
├── claude-monitor.repository.ts # 数据库操作
├── config.yaml                # 配置
└── CLAUDE.md                  # 说明文档
```

## 依赖

- `../../shared/db/connection` - 数据库连接
- `../../shared/middleware/error.middleware` - 错误处理
- `../../shared/utils/logger` - 日志工具
