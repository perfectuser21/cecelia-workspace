# Claude Stats Feature

Claude 使用统计模块。

## 功能

- 解析 ~/.claude/projects/ 下的 JSONL 日志
- 计算 Token 使用量和成本
- 按天/按模型聚合统计
- 最近会话列表

## 定价支持

支持以下模型的成本计算：
- claude-opus-4-5-20251101
- claude-sonnet-4-5-20250929
- claude-sonnet-4-20250514
- claude-3-5-sonnet-20241022
- claude-3-5-haiku-20241022
- claude-3-haiku-20240307

## 文件结构

```
claude-stats/
├── index.ts               # 模块入口
├── claude-stats.types.ts  # 类型定义（含定价表）
├── claude-stats.route.ts  # 路由
├── claude-stats.service.ts # 业务逻辑（JSONL 解析）
├── config.yaml            # 配置
└── CLAUDE.md              # 说明文档
```

## 依赖

- 无外部依赖，使用 Node.js 内置 fs/readline 模块
