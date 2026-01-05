# Tasks Feature

Notion 任务库代理模块。

## 功能

- 查询任务列表（按负责人、日期范围过滤）
- 更新任务完成状态
- 更新任务截止日期
- 创建新任务

## Assignee 字段兼容性

支持多种 Notion 字段类型：
- people
- rich_text
- select
- multi_select

## 文件结构

```
tasks/
├── index.ts           # 模块入口
├── tasks.config.ts    # 任务配置（字段映射、用户列表）
├── tasks.route.ts     # 路由
├── tasks.service.ts   # 业务逻辑
├── config.yaml        # 配置
└── CLAUDE.md          # 说明文档
```

## 依赖

- `../../shared/utils/config` - 配置工具
