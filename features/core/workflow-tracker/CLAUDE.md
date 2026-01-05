# Workflow Tracker Feature

工作流执行追踪模块。

## 功能

- 创建和管理工作流运行记录
- 记录执行事件（5 阶段：PREPARE/VALIDATE/EXECUTE/VERIFY/FINALIZE）
- 卡住检测（stuck detection）
- 富事件流（V2）支持

## 事件类型

- prd_read - 读取 PRD
- ai_understand - AI 理解/任务拆分
- task_start - 任务开始
- task_complete - 任务完成
- file_write - 文件写入
- claude_call - Claude API 调用
- qc_result - 质检结果
- decision - 决策点
- error - 错误
- info - 一般信息

## 文件结构

```
workflow-tracker/
├── index.ts                     # 模块入口
├── workflow-tracker.types.ts    # 类型定义
├── workflow-tracker.route.ts    # 路由
├── workflow-tracker.service.ts  # 业务逻辑
├── workflow-tracker.repository.ts # 数据库操作
├── config.yaml                  # 配置
└── CLAUDE.md                    # 说明文档
```

## 依赖

- `../../shared/db/connection` - 数据库连接
- `../../shared/middleware/error.middleware` - 错误处理
- `../../shared/utils/logger` - 日志工具
