# AI Factory v3.3

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
│                      AI Factory v3.3                        │
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

## 执行约束

### 超时限制

| 阶段 | 默认超时 | 说明 |
|------|----------|------|
| prepare.sh | 5分钟 | 准备阶段超时 |
| executor.sh | 30分钟 | Claude Code 执行超时 |
| cleanup.sh | 5分钟 | 清理阶段超时 |
| 单次合并 | 2分钟 | Git 合并操作超时 |

### 资源限制

- **Claude Code 预算**：单任务最大 $100 USD
- **重试次数**：Ralph 循环最多 3 次
- **并发任务**：最多 5 个并行任务
- **Worktree 保留**：最多保留 10 个未清理的 worktree

### 执行规则

1. **互斥操作**
   - 同一任务 ID 不能同时执行多次
   - 主分支合并操作需要获取锁（flock）
   - Worktree 创建/删除需要串行执行

2. **失败处理**
   - 执行失败时自动保留现场（worktree + 日志）
   - 超时任务会被强制终止（SIGTERM → SIGKILL）
   - 失败任务不会自动重试，需手动触发

3. **安全约束**
   - 禁止删除 scripts/ 目录下的任何文件
   - 禁止修改 config.sh 中的基础路径
   - 禁止直接操作主仓库工作区

## 版本管理

### 版本号规则

遵循语义化版本 `MAJOR.MINOR.PATCH`：

- **MAJOR**：架构级重构（如 v2 → v3 Git Worktree 隔离）
- **MINOR**：新增功能（如添加并行执行支持）
- **PATCH**：bug 修复、文档更新

### 版本文件

版本信息存储在 `scripts/config.sh` 中：

```bash
AI_FACTORY_VERSION="3.3.0"
```

### 升级策略

1. **向后兼容**：新版本保持 API 接口兼容
2. **平滑迁移**：提供迁移脚本 `migrate-v2-to-v3.sh`
3. **版本检查**：executor.sh 启动时检查版本匹配

### 变更日志

版本变更记录在 `CHANGELOG.md` 中：

```
## [3.3.0] - 2026-01-07
- 改进合并逻辑：合并前先 rebase 到最新 master，防止分叉冲突
- 统一版本管理：所有脚本使用统一版本号常量
- 完善配置参数化：使用 ${VAR:-default} 语法
- 增强文档：添加执行约束、版本管理、并行执行详细说明

## [3.2.1] - 2026-01-06
- 修复 executor.sh 参数解析
- 优化 Ralph 循环性能

## [3.2.0] - 2026-01-05
- 添加并行执行支持
- 新增任务优先级队列
```

## 并行执行

### 并行模式

支持三种并行执行模式：

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| 独立并行 | 任务完全独立，无依赖关系 | 批量处理不同模块 |
| 有序并行 | 任务有依赖顺序，但可部分并行 | 流水线式处理 |
| 互斥并行 | 任务可并行但需要互斥资源 | 数据库迁移、主分支合并 |

### 并行控制

```bash
# 启动并行任务（通过 n8n 或 API）
parallel_tasks=(
  "task_id_1:opus:100"
  "task_id_2:sonnet:50"
  "task_id_3:haiku:20"
)

for task in "${parallel_tasks[@]}"; do
  IFS=':' read -r task_id model budget <<< "$task"
  ./scripts/executor.sh "$task_id" --model "$model" --budget "$budget" &
done

# 等待所有任务完成
wait
```

### 资源分配

1. **CPU 分配**
   - 每个 Claude Code 进程限制 2 个 CPU 核心
   - 使用 `taskset` 绑定 CPU 亲和性

2. **内存限制**
   - 单任务最大内存 4GB
   - 使用 cgroups 进行内存隔离

3. **磁盘 IO**
   - Worktree 分散到不同磁盘分区（如果可用）
   - 日志写入使用缓冲以减少 IO 竞争

### 冲突处理

并行执行时的冲突处理策略：

1. **Git 冲突**
   - 检测到合并冲突时，标记为 `AI Conflict`
   - 保留 worktree，等待人工介入
   - 后续任务自动跳过冲突文件

2. **资源竞争**
   - 使用文件锁（flock）保护关键操作
   - 主分支合并使用排他锁
   - Notion API 调用使用限流（5 req/s）

3. **依赖管理**
   - 任务元数据中定义依赖关系
   - 依赖未完成时任务进入等待队列
   - 超时后自动取消依赖链

### 监控指标

并行执行时需要监控的关键指标：

| 指标 | 阈值 | 告警条件 |
|------|------|----------|
| 活跃任务数 | ≤ 5 | 超过 5 个发送告警 |
| CPU 使用率 | < 80% | 持续 5 分钟 > 80% |
| 内存使用率 | < 90% | 超过 90% 终止最早任务 |
| 任务队列长度 | ≤ 20 | 超过 20 暂停接收新任务 |
| 冲突率 | < 10% | 超过 10% 通知人工介入 |

---

## 禁止删除的文件

**执行 AI Factory 任务时，严禁删除以下文件**：

```
features/core/ai-factory/scripts/
├── main.sh              # 主入口脚本 - 禁止删除
├── config.sh            # 配置变量 - 禁止删除
├── utils.sh             # 工具函数 - 禁止删除
├── worktree-manager.sh  # Worktree 管理 - 禁止删除
├── prepare.sh           # 准备阶段 - 禁止删除
├── executor.sh          # 执行阶段 - 禁止删除
└── cleanup.sh           # 收尾阶段 - 禁止删除
```

**此外，禁止删除项目中的以下关键目录**：
- `features/business/` - 业务模块
- `features/core/` - 核心模块
- 任何 `*.sh` 脚本文件
- 任何 `index.ts` 入口文件

如果任务需要修改这些文件，应该编辑内容而不是删除重建。

---

**最后更新**: 2026-01-07
