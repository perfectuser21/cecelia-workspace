# AI 工厂机制

## 概述

AI 工厂是 Vibe Coding 系统的核心，由 n8n 主控启动 Claude Code 执行任务。

## 架构

```
n8n 主控
    ↓ 查询符合条件的 Task
Notion Tasks 数据库
    ↓ 读取 Task Page Content
Claude Code (Headless)
    ↓ 执行开发 + 质检
Notion 更新 + Git Commit
```

## 任务筛选条件

n8n 主控查询 Tasks 时的筛选条件：

| 字段 | 条件 |
|------|------|
| Area | = "AI Systems & Automation" |
| Status | = "Next Action" |
| AI Task | = YES |
| Coding Type | 有值 (Workflow / Frontend) |

## 输入格式

n8n 传入 Claude Code 的数据：

```json
{
  "task_id": "notion-page-id",
  "task_name": "创建 xxx workflow",
  "task_content": "PRD 内容...",
  "run_id": "unique-run-id",
  "coding_type": "Workflow",
  "project_id": "optional-project-id"
}
```

## 执行流程

```
1. 接收任务
   ├── 解析 task_id, task_content
   └── 生成 run_id

2. 执行开发
   ├── 读取相关模板
   ├── 创建 Workflow JSON
   └── 保存到 bundles/{bundle_name}/

3. 8 路质检
   ├── 硬检查、软检查、安全扫描...
   └── 详见 WORKFLOW.md

4. 质检通过
   ├── 获取锁 → 更新 bundle.json → 释放锁
   ├── Git Commit
   ├── 更新 Notion Task
   └── 如有经验 → 创建 XX_ProjectNotes

5. 质检失败
   ├── 返工（最多 2 次）
   └── 仍失败 → 报告人工处理
```

## 状态流转

```
Next Action → In Progress → Waiting → Completed/Eliminated
     ↑                         ↓
     └─────── 返工 ────────────┘
```

| 状态 | 含义 |
|------|------|
| Next Action | 等待 AI 执行 |
| In Progress | AI 正在执行（n8n 设置） |
| Waiting | AI 完成，等待人工确认 |
| Completed | 任务完成 |
| Eliminated | 任务取消 |

## 返工机制

```
第 1 次失败 → 收集失败原因 → 修复 → 重新质检
第 2 次失败 → 收集失败原因 → 修复 → 重新质检
第 3 次仍失败 → 停止 → 写报告 → Status = Waiting → 等待人工
```

## Notion 数据库

### Tasks 数据库
- Database ID: `54fe0d4cf4344e918bb0e33967661c42`

### XX_ProjectNotes 数据库（经验库）
- Database ID: `1fb0ec1cc75b482bbe0cffd4fdb5fd4d`

### Projects 数据库
- Database ID: `2671de5885064d64bad723fae2737e74`

## 可用工具

### Notion 更新

```bash
# 更新任务 + 追加执行报告
/home/xx/bin/notion-task-reporter.sh update-task \
  --task-id "{task_id}" \
  --status "Waiting" \
  --result "✅ 成功" \
  --did-what "创建了 xxx.json" \
  --problems "无" \
  --files "bundles/xxx/workflow.json"

# 创建经验笔记
/home/xx/bin/notion-task-reporter.sh create-note \
  --name "[模块] 经验标题" \
  --content "详细内容" \
  --task-id "{task_id}"
```

## 并行规则

- 同一 Bundle 的任务串行执行（通过锁机制）
- 不同 Bundle 的任务可并行
- 详见 BUNDLE.md 锁机制章节

## n8n 主控 Workflow

### 基本信息

| 属性 | 值 |
|------|-----|
| 名称 | Vibe Coding 主控 |
| n8n ID | `BO6V3MYDHVp2bkvd` |
| 触发方式 | 每小时定时 / 手动触发 |
| Bundle | ai-factory |

### 节点流程

```
定时/手动触发
    ↓
查询待执行任务 (Notion Query)
    ↓
有任务? → 无任务 → 结束
    ↓
逐个处理 (SplitInBatches)
    ↓
获取任务详情 (Notion Get Blocks)
    ↓
更新状态: In Progress
    ↓
准备 Claude 命令 (Code)
    ↓
执行 Claude Code (SSH)
    ↓
解析执行结果 (Code)
    ↓
执行成功? → 通知: 成功 / 通知: 失败
    ↓
继续下一个任务
```

### 配置要求

1. **Notion 凭据**: 需要在 n8n 中创建 Notion Internal Integration 凭据
   - 名称建议: `Notion API`
   - API Key: 使用 `VPS_ClaudeCode` integration 的 token

2. **SSH 凭据**: 已配置 (`vvJsQOZ95sqzemla`)

3. **飞书 Webhook**: 已硬编码

---

## 更新记录

| 日期 | 变更描述 |
|------|----------|
| 2025-12-26 | 初始创建：定义核心流程、状态流转、输入格式 |
| 2025-12-26 | 添加 n8n 主控 Workflow (JLoLvhS9xal57yLC) |
