# AI Factory v3.0

自动化任务执行系统，通过 Git Worktree 实现并行任务隔离。

## 功能

- **Git Worktree 隔离**：每个任务在独立 worktree 中执行，互不干扰
- **Notion 任务集成**：从 Notion 获取任务、更新状态、写执行报告
- **Claude Code 自动执行**：使用 headless 模式执行 Claude Code
- **Ralph 循环模式**：支持迭代执行，自动重试直到任务完成
- **自动合并**：执行成功后自动合并到主分支
- **冲突处理**：检测合并冲突，标记状态并通知

## 目录结构

```
ai-factory/
├── index.ts                 # 模块入口
├── ai-factory.route.ts      # API 路由
├── ai-factory.service.ts    # 业务逻辑（调用 bash 脚本）
├── ai-factory.types.ts      # TypeScript 类型定义
├── CLAUDE.md                # 本文档
└── scripts/                 # Bash 脚本
    ├── main.sh              # 主入口（n8n 调用此脚本）
    ├── config.sh            # 配置变量
    ├── utils.sh             # 共享工具函数
    ├── worktree-manager.sh  # Worktree 管理
    ├── prepare.sh           # 准备阶段
    ├── executor.sh          # 执行阶段
    └── cleanup.sh           # 收尾阶段
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /v1/ai-factory/health | 健康检查 |
| POST | /v1/ai-factory/execute | 执行任务 |
| POST | /v1/ai-factory/prepare | 仅准备任务 |
| GET | /v1/ai-factory/worktrees | 列出活跃 worktree |
| DELETE | /v1/ai-factory/worktrees/:taskId | 清理 worktree |
| GET | /v1/ai-factory/conflicts/:branch | 检查冲突文件 |

## 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Factory v3.0                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [1] 准备阶段 (prepare.sh)                                   │
│  ├─ 从 Notion 获取任务信息                                    │
│  ├─ 创建 Git Worktree                                        │
│  └─ 生成 task-prompt.md                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [2] 执行阶段 (executor.sh)                                  │
│  ├─ 启动 Claude Code (headless)                              │
│  ├─ Ralph 循环检测 <promise>TASK_COMPLETE</promise>          │
│  └─ 记录执行日志                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  [3] 收尾阶段 (cleanup.sh)                                   │
│  ├─ 成功 → 提交更改 → 合并到 master                           │
│  ├─ 冲突 → 标记状态 → 保留 worktree                           │
│  ├─ 失败 → 标记状态 → 保留 worktree                           │
│  ├─ 更新 Notion 状态                                         │
│  └─ 发送飞书通知                                              │
└─────────────────────────────────────────────────────────────┘
```

## 配置

### 目录配置 (config.sh)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PROJECT_DIR | /home/xx/dev/zenithjoy-autopilot | 主仓库目录 |
| WORKTREES_DIR | /home/xx/worktrees | Worktree 根目录 |
| DATA_DIR | /home/xx/data | 数据目录 |
| LOGS_DIR | /home/xx/data/logs | 日志目录 |
| GIT_BASE_BRANCH | master | 基础分支 |
| GIT_BRANCH_PREFIX | task | 任务分支前缀 |

### 环境变量

需要在 `.secrets` 文件中配置：

```bash
NOTION_TOKEN=secret_xxx
FEISHU_WEBHOOK_URL=https://open.feishu.cn/xxx
FEISHU_WEBHOOK_SECRET=xxx
```

## 命令行使用

### 直接执行脚本

```bash
# 执行完整流程
./scripts/executor.sh <task_id> --model opus --budget 100

# 仅准备
./scripts/prepare.sh <task_id>

# 仅清理
./scripts/cleanup.sh <task_id> success

# Worktree 管理
./scripts/worktree-manager.sh create <task_id>
./scripts/worktree-manager.sh list
./scripts/worktree-manager.sh cleanup <task_id>
```

### 通过 API 调用

```bash
# 执行任务
curl -X POST http://localhost:3333/v1/ai-factory/execute \
  -H "Content-Type: application/json" \
  -d '{"taskId": "abc123", "model": "opus"}'

# 列出 worktree
curl http://localhost:3333/v1/ai-factory/worktrees
```

## 任务状态

| 状态 | 说明 |
|------|------|
| AI Done | 执行成功，已合并到主分支 |
| AI Failed | 执行失败 |
| AI Conflict | 合并冲突，需手动处理 |

## 依赖

- Claude CLI (claude) - Claude Code 命令行工具
- jq - JSON 处理
- curl - HTTP 请求
- Git - 版本控制

## 注意事项

1. **主仓库工作区必须干净**：合并前会检查主仓库是否有未提交的更改
2. **Worktree 保留策略**：失败/冲突时保留 worktree 用于调试，成功后自动清理
3. **分支命名**：`task/<notion_page_id>`
4. **日志位置**：`/home/xx/data/logs/`

---

**最后更新**: 2026-01-05
