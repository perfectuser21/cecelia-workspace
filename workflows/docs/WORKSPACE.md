# 工作目录规范

## 目录结构

```
/home/xx/
├── dev/                              # 所有项目（Git 管理）
│   └── zenithjoy-autopilot/          # Monorepo
│       ├── apps/
│       │   ├── dashboard/
│       │   │   ├── frontend/         # Frontend 代码
│       │   │   ├── core/api/         # Backend API 代码
│       │   │   └── douyin-api/       # 抖音登录服务
│       │   └── ...
│       ├── workflows/                # n8n 相关
│       │   ├── exports/              # Workflow JSON
│       │   │   └── bundles/          # 按功能分组
│       │   ├── scripts/
│       │   │   ├── v2/               # 新架构脚本
│       │   │   │   ├── main.sh       # 主入口
│       │   │   │   ├── shared/       # 共享脚本
│       │   │   │   ├── n8n/          # n8n 专用
│       │   │   │   ├── backend/      # Backend 专用
│       │   │   │   └── frontend/     # Frontend 专用
│       │   │   └── (旧脚本)
│       │   ├── templates/            # 模板
│       │   ├── docs/                 # 文档
│       │   └── workflow-factory.sh   # 旧脚本（待废弃）
│       ├── CLAUDE.md
│       └── .claude/
│
├── data/                             # 运行时数据（不进 Git）
│   ├── runs/{run_id}/                # 每次执行的临时目录
│   │   ├── env.sh                    # 环境变量
│   │   ├── task_info.json            # 任务详情
│   │   ├── result.json               # 执行结果
│   │   ├── quality_report.json       # 质检报告
│   │   └── logs/                     # 日志
│   ├── logs/                         # 全局日志
│   └── cache/                        # 缓存
│
└── .locks/                           # 锁文件
    └── claude-factory.lock
```

---

## 任务粒度定义

每个任务产出一个**可独立验收的成果包**：

| 类型 | 一个任务 = | 示例 |
|------|-----------|------|
| n8n | 一个 Workflow | 「社媒数据抓取 - 抖音」 |
| Backend | 一个 API 模块（可含多个文件） | 「用户登录 API」(api.ts, service.ts, db.ts) |
| Frontend | 一个页面或功能模块 | 「登录页面」 |

---

## Notion Task 字段规范

### 必需字段

| 字段 | 类型 | 值 | 说明 |
|------|------|-----|------|
| Name | Title | 任务名称 | 简短描述任务目标 |
| Status | Select | Next Action / In Progress / Waiting / Completed / Eliminated | 状态流转 |
| Coding Type | Select | n8n / Backend / Frontend / AI Assist | AI Assist 不触发自动执行 |
| AI Task | Checkbox | Yes / No | 是否由 AI 工厂执行 |
| Content | Text | 小 PRD | 任务详细描述 |

### 可选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| Blocked by | Relation | 关联前置任务 |
| Area | Select | 所属领域 |
| Project | Relation | 关联项目 |

### 状态流转

```
Next Action  →  In Progress  →  Waiting  →  Completed
     ↑              │              │
     │              ↓              │
     └──────── (返工) ←────────────┘
                                   │
                                   ↓
                              Eliminated (取消)
```

| 状态 | 含义 | 触发者 |
|------|------|--------|
| Next Action | 等待执行 | 人工创建 |
| In Progress | 正在执行 | n8n 主控 |
| Waiting | 执行完成，等待人工确认 | Claude Code |
| Completed | 任务完成 | 人工确认 |
| Eliminated | 任务取消 | 人工操作 |

---

## Task Content 格式

任务的 Content 字段应包含以下结构：

```markdown
## 目标
简述要实现什么

## 需求
- 需求点 1
- 需求点 2

## 技术要求（可选）
- 使用 xxx 库
- 遵循 xxx 规范

## 验收标准
- [ ] 条件 1
- [ ] 条件 2
```

---

## 运行目录结构

每次任务执行创建 `/home/xx/data/runs/{run_id}/`：

```
/home/xx/data/runs/{run_id}/
├── env.sh                  # 环境变量（供后续脚本 source）
├── task_info.json          # 从 Notion 读取的任务详情
├── result.json             # 执行阶段的产出物信息
├── quality_report.json     # 质检报告
└── logs/
    ├── prepare.log         # 准备阶段日志
    ├── execute.log         # 执行阶段日志
    ├── quality.log         # 质检阶段日志
    └── cleanup.log         # 收尾阶段日志
```

### env.sh 内容

```bash
export RUN_ID="20251227-abc123"
export TASK_ID="notion-page-id"
export CODING_TYPE="n8n"
export WORK_DIR="/home/xx/data/runs/20251227-abc123"
export PROJECT_DIR="/home/xx/dev/zenithjoy-autopilot"
export BRANCH_NAME="feature/notion-page-id"
```

### task_info.json 结构

```json
{
  "task_id": "notion-page-id",
  "task_name": "创建抖音数据抓取 Workflow",
  "coding_type": "n8n",
  "status": "In Progress",
  "content": "## 目标\n...",
  "blocked_by": [],
  "created_at": "2025-12-27T10:00:00Z",
  "fetched_at": "2025-12-27T10:05:00Z"
}
```

### result.json 结构

```json
{
  "success": true,
  "artifacts": [
    {
      "type": "workflow",
      "id": "n8n-workflow-id",
      "name": "抖音数据抓取",
      "path": "exports/bundles/data-collection/douyin.json"
    }
  ],
  "created_at": "2025-12-27T10:10:00Z"
}
```

### quality_report.json 结构

```json
{
  "passed": true,
  "score": 85,
  "checks": [
    {"name": "existence", "passed": true, "message": "Workflow 存在"},
    {"name": "quality_score", "passed": true, "score": 85},
    {"name": "security", "passed": true},
    {"name": "git", "passed": true}
  ],
  "checked_at": "2025-12-27T10:12:00Z"
}
```

---

## 日志规范

### 日志格式

```
[2025-12-27 10:05:32] [INFO] 消息内容
[2025-12-27 10:05:33] [WARN] 警告内容
[2025-12-27 10:05:34] [ERROR] 错误内容
```

### 日志级别

| 级别 | 用途 |
|------|------|
| INFO | 正常执行信息 |
| WARN | 警告但不影响执行 |
| ERROR | 错误，可能导致失败 |
| DEBUG | 调试信息（仅开发时使用） |

### 日志保留

- 成功的运行：保留 7 天
- 失败的运行：保留 30 天
- 清理由夜间维护任务执行

---

## 锁机制

### 锁文件位置

```
/home/xx/.locks/claude-factory.lock
```

### 锁获取规则

1. 尝试获取锁
2. 如果失败，等待 60 秒后重试
3. 最多重试 3 次
4. 超过后报错退出

### 锁内容

```
PID: 12345
TASK_ID: notion-page-id
STARTED_AT: 2025-12-27T10:05:00Z
```

### 死锁检测

- 锁文件超过 30 分钟视为死锁
- 自动清理并重新获取

---

## 更新记录

| 日期 | 变更 |
|------|------|
| 2025-12-27 | 初始创建：定义目录结构、任务粒度、Notion 字段规范 |
